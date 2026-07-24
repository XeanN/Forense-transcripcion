const fs = require('fs');
const path = require('path');
const ffmpegService = require('./ffmpegService');
const transcriptionService = require('./transcriptionService');
const activityLogModel = require('../db/activityLogModel');

const CHUNK_MINUTES = parseFloat(process.env.CHUNK_DURATION_MINUTES) || 15;
const RESULT_TTL_MS = 2 * 60 * 60 * 1000; // purga texto en memoria tras 2 horas
const DOWNLOAD_TTL_MS = 30 * 60 * 1000; // purga audio extraido no descargado tras 30 min

// Mensaje generico para el usuario cuando un job falla. El detalle tecnico
// real (excepcion, stderr de ffmpeg/python, etc.) nunca se le muestra al
// usuario: solo queda en la consola del servidor y en activity_log, visible
// unicamente para el admin.
const GENERIC_PROCESSING_ERROR =
  'No se pudo procesar el archivo. Verifica que no este corrupto o en un formato no soportado, e intenta de nuevo.';

const jobs = new Map();
const queue = [];
let workerRunning = false;

function createJob({ userId, username, mediaType, originalName, jobDir, originalPath, fileHash }) {
  const jobId = path.basename(jobDir);
  const job = {
    id: jobId,
    userId,
    username,
    mediaType,
    originalName,
    jobDir,
    originalPath,
    fileHash: fileHash || null,
    action: null,
    status: 'uploaded',
    progress: 0,
    error: null,
    durationSeconds: null,
    resultText: null,
    downloadPath: null,
    downloadMime: null,
    downloadExt: null,
    createdAt: Date.now(),
    startedAt: null,
    completedAt: null,
    purgeTimer: null,
  };
  jobs.set(jobId, job);
  return job;
}

function getJob(jobId) {
  return jobs.get(jobId);
}

function safeCleanupDir(dir) {
  fs.rm(dir, { recursive: true, force: true }, (err) => {
    if (err) {
      console.error(`No se pudo limpiar el directorio temporal ${dir}: ${err.message}`);
    }
  });
}

function schedulePurge(jobId, delayMs) {
  const job = jobs.get(jobId);
  if (!job) return;
  if (job.purgeTimer) clearTimeout(job.purgeTimer);
  job.purgeTimer = setTimeout(() => {
    const current = jobs.get(jobId);
    if (current && current.jobDir) {
      safeCleanupDir(current.jobDir);
    }
    jobs.delete(jobId);
  }, delayMs);
}

function enqueueAction(jobId, action) {
  const job = jobs.get(jobId);
  if (!job) throw new Error('Job no encontrado');
  if (job.action) throw new Error('Este job ya tiene una accion en curso o finalizada');

  job.action = action;
  job.status = 'queued';
  queue.push(jobId);
  runWorker();
  return job;
}

async function runWorker() {
  if (workerRunning) return;
  workerRunning = true;

  while (queue.length > 0) {
    const jobId = queue.shift();
    const job = jobs.get(jobId);
    if (!job) continue;

    try {
      if (job.action === 'transcribe') {
        await processTranscribe(job);
      } else if (job.action === 'extract_audio') {
        await processExtractAudio(job);
      }
    } catch (err) {
      job.status = 'error';
      job.error = GENERIC_PROCESSING_ERROR;
      console.error(`Job ${job.id} fallo: ${err.message}`);

      // El detalle tecnico queda en el log de actividad (solo lo ve el
      // admin), nunca se lo mostramos al usuario que subio el archivo.
      activityLogModel.log({
        userId: job.userId,
        username: job.username,
        action: job.action === 'transcribe' ? 'transcribe_failed' : 'extract_audio_failed',
        fileName: job.originalName,
        fileType: job.mediaType,
        fileHash: job.fileHash,
        details: `Job ${job.id} fallo: ${err.message}`,
      });

      // Aunque el job haya fallado, no deben quedar archivos huerfanos.
      safeCleanupDir(job.jobDir);
    }
  }

  workerRunning = false;
}

async function processTranscribe(job) {
  job.status = 'preparing';
  job.progress = 5;
  job.startedAt = Date.now();

  job.durationSeconds = await ffmpegService.probeDurationSeconds(job.originalPath);

  const chunksDir = path.join(job.jobDir, 'chunks');
  const chunkPaths = await ffmpegService.splitIntoAudioChunks(job.originalPath, chunksDir, CHUNK_MINUTES);

  job.status = 'transcribing';
  job.progress = 10;

  const result = await transcriptionService.transcribeChunks(chunkPaths, ({ completed, total }) => {
    job.progress = 10 + Math.round((completed / total) * 85);
  });

  job.resultText = result.text || '';
  job.status = 'done';
  job.progress = 100;
  job.completedAt = Date.now();

  // Privacidad: se borra el archivo original y todos los chunks inmediatamente
  // al terminar. El texto solo vive en memoria hasta que se purga por TTL.
  safeCleanupDir(job.jobDir);

  activityLogModel.log({
    userId: job.userId,
    username: job.username,
    action: 'transcribe',
    fileName: job.originalName,
    fileType: job.mediaType,
    durationSeconds: job.durationSeconds,
    fileHash: job.fileHash,
    startedAt: new Date(job.startedAt).toISOString(),
    completedAt: new Date(job.completedAt).toISOString(),
    processingSeconds: (job.completedAt - job.startedAt) / 1000,
    details: `Job ${job.id} completado`,
  });

  console.log(`Job ${job.id} completado (transcripcion)`);
  schedulePurge(job.id, RESULT_TTL_MS);
}

async function processExtractAudio(job) {
  job.status = 'extracting';
  job.progress = 20;
  job.startedAt = Date.now();

  job.durationSeconds = await ffmpegService.probeDurationSeconds(job.originalPath);

  const outputPath = path.join(job.jobDir, 'audio.mp3');
  await ffmpegService.extractAudioFile(job.originalPath, outputPath);

  // El video original ya no se necesita una vez extraido el audio.
  fs.rm(job.originalPath, { force: true }, () => {});

  job.downloadPath = outputPath;
  job.downloadMime = 'audio/mpeg';
  job.downloadExt = 'mp3';
  job.status = 'done';
  job.progress = 100;
  job.completedAt = Date.now();

  activityLogModel.log({
    userId: job.userId,
    username: job.username,
    action: 'extract_audio',
    fileName: job.originalName,
    fileType: job.mediaType,
    durationSeconds: job.durationSeconds,
    fileHash: job.fileHash,
    startedAt: new Date(job.startedAt).toISOString(),
    completedAt: new Date(job.completedAt).toISOString(),
    processingSeconds: (job.completedAt - job.startedAt) / 1000,
    details: `Job ${job.id} completado`,
  });

  console.log(`Job ${job.id} completado (extraccion de audio)`);
  schedulePurge(job.id, DOWNLOAD_TTL_MS);
}

function finalizeExtractDownload(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  if (job.purgeTimer) clearTimeout(job.purgeTimer);
  safeCleanupDir(job.jobDir);
  jobs.delete(jobId);
}

function purgeAllOnStartup(tempRoot) {
  safeCleanupDir(tempRoot);
  fs.mkdirSync(tempRoot, { recursive: true });
}

module.exports = {
  createJob,
  getJob,
  enqueueAction,
  finalizeExtractDownload,
  purgeAllOnStartup,
};
