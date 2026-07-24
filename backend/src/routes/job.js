const express = require('express');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const jobManager = require('../processing/jobManager');
const { streamTextAsPdf } = require('../processing/pdfService');

const router = express.Router();

router.use(requireAuth);

function loadOwnedJob(req, res) {
  const job = jobManager.getJob(req.params.jobId);
  if (!job || job.userId !== req.user.id) {
    res.status(404).json({ error: 'Job no encontrado' });
    return null;
  }
  return job;
}

router.post('/:jobId/action', (req, res) => {
  const job = loadOwnedJob(req, res);
  if (!job) return;

  const { action } = req.body || {};
  if (!['transcribe', 'extract_audio'].includes(action)) {
    return res.status(400).json({ error: 'Accion invalida' });
  }
  if (action === 'extract_audio' && job.mediaType !== 'video') {
    return res.status(400).json({ error: 'Extraer audio solo aplica a videos' });
  }
  if (job.action) {
    return res.status(409).json({ error: 'Este job ya esta siendo procesado' });
  }

  jobManager.enqueueAction(job.id, action);
  res.status(202).json({ jobId: job.id, status: job.status });
});

router.get('/:jobId/status', (req, res) => {
  const job = loadOwnedJob(req, res);
  if (!job) return;

  res.json({
    jobId: job.id,
    mediaType: job.mediaType,
    action: job.action,
    status: job.status,
    progress: job.progress,
    error: job.error,
  });
});

router.get('/:jobId/result', (req, res) => {
  const job = loadOwnedJob(req, res);
  if (!job) return;

  if (job.action !== 'transcribe' || job.status !== 'done') {
    return res.status(409).json({ error: 'El resultado todavia no esta disponible' });
  }

  res.json({ text: job.resultText, fileHash: job.fileHash });
});

router.get('/:jobId/download', (req, res) => {
  const job = loadOwnedJob(req, res);
  if (!job) return;

  if (job.status !== 'done') {
    return res.status(409).json({ error: 'El job todavia no ha finalizado' });
  }

  const format = req.query.format;

  if (job.action === 'transcribe') {
    if (!['txt', 'pdf'].includes(format)) {
      return res.status(400).json({ error: 'Formato invalido, use txt o pdf' });
    }
    const baseName = job.originalName.replace(/\.[^.]+$/, '') || 'transcripcion';

    // Cadena de custodia: el hash queda documentado tambien en el archivo
    // descargado, no solo en pantalla, por si se cita como evidencia.
    // Se usa ISO 8601 (UTC) para la fecha, sin ambiguedad dia/mes.
    const footer = job.fileHash
      ? `\n\n---\nArchivo original: ${job.originalName}\nSHA-256: ${job.fileHash}\nTranscrito (UTC): ${new Date(job.completedAt).toISOString()}\n`
      : '';
    const fullText = (job.resultText || '') + footer;

    if (format === 'txt') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}.txt"`);
      return res.send(Buffer.from(fullText, 'utf8'));
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);
    return streamTextAsPdf(fullText, res);
  }

  if (job.action === 'extract_audio') {
    if (!job.downloadPath || !fs.existsSync(job.downloadPath)) {
      return res.status(410).json({ error: 'El archivo ya no esta disponible' });
    }

    res.setHeader('Content-Type', job.downloadMime);
    res.setHeader('Content-Disposition', `attachment; filename="audio.${job.downloadExt}"`);

    const stream = fs.createReadStream(job.downloadPath);
    stream.pipe(res);
    res.on('finish', () => jobManager.finalizeExtractDownload(job.id));
    return undefined;
  }

  return res.status(409).json({ error: 'Accion no reconocida' });
});

module.exports = router;
