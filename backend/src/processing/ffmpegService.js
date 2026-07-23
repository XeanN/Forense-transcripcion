const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { windowsHide: true });
    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`No se pudo ejecutar ${command}: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} termino con codigo ${code}: ${stderr.slice(-500)}`));
        return;
      }
      resolve(stderr);
    });
  });
}

function probeDurationSeconds(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ];
    const proc = spawn('ffprobe', args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => (stdout += chunk.toString()));
    proc.stderr.on('data', (chunk) => (stderr += chunk.toString()));

    proc.on('error', (err) => reject(new Error(`No se pudo ejecutar ffprobe: ${err.message}`)));

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe fallo: ${stderr.slice(-500)}`));
        return;
      }
      const seconds = parseFloat(stdout.trim());
      if (Number.isNaN(seconds)) {
        reject(new Error('No se pudo determinar la duracion del archivo'));
        return;
      }
      resolve(seconds);
    });
  });
}

async function splitIntoAudioChunks(inputPath, outputDir, chunkMinutes) {
  fs.mkdirSync(outputDir, { recursive: true });
  const chunkSeconds = Math.max(1, Math.round(chunkMinutes * 60));
  const pattern = path.join(outputDir, 'chunk_%04d.wav');

  await runCommand('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-c:a', 'pcm_s16le',
    '-f', 'segment',
    '-segment_time', String(chunkSeconds),
    '-reset_timestamps', '1',
    pattern,
  ]);

  const files = fs
    .readdirSync(outputDir)
    .filter((name) => name.startsWith('chunk_') && name.endsWith('.wav'))
    .sort()
    .map((name) => path.join(outputDir, name));

  if (files.length === 0) {
    throw new Error('ffmpeg no genero ningun chunk de audio');
  }

  return files;
}

async function extractAudioFile(inputPath, outputPath) {
  await runCommand('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-vn',
    '-acodec', 'libmp3lame',
    '-q:a', '2',
    outputPath,
  ]);
  return outputPath;
}

module.exports = { probeDurationSeconds, splitIntoAudioChunks, extractAudioFile };
