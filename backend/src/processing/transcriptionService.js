const path = require('path');
const { spawn } = require('child_process');

const PYTHON_BIN = process.env.PYTHON_BIN
  ? path.resolve(__dirname, '../..', process.env.PYTHON_BIN)
  : 'python';
const TRANSCRIBE_SCRIPT = path.join(__dirname, '../../python/transcribe.py');
const MODEL_SIZE = process.env.WHISPER_MODEL_SIZE || 'small';
const COMPUTE_TYPE = process.env.WHISPER_COMPUTE_TYPE || 'int8';
const LANGUAGE = process.env.WHISPER_LANGUAGE || '';

function transcribeChunks(chunkPaths, onProgress) {
  return new Promise((resolve, reject) => {
    const args = [
      TRANSCRIBE_SCRIPT,
      '--model-size', MODEL_SIZE,
      '--compute-type', COMPUTE_TYPE,
      ...(LANGUAGE ? ['--language', LANGUAGE] : []),
      ...chunkPaths,
    ];

    const proc = spawn(PYTHON_BIN, args, { windowsHide: true });

    let stdout = '';
    let stderrTail = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderrTail = (stderrTail + text).slice(-2000);

      text.split(/\r?\n/).forEach((line) => {
        const progressMatch = line.match(/^PROGRESS (\d+)\/(\d+)/);
        if (progressMatch && onProgress) {
          onProgress({
            completed: parseInt(progressMatch[1], 10),
            total: parseInt(progressMatch[2], 10),
          });
        }
      });
    });

    proc.on('error', (err) => {
      reject(new Error(`No se pudo iniciar el proceso de Python: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`El script de transcripcion fallo: ${stderrTail.trim().slice(-500)}`));
        return;
      }
      try {
        const result = JSON.parse(stdout.trim());
        resolve(result);
      } catch (err) {
        reject(new Error('No se pudo interpretar la salida del script de transcripcion'));
      }
    });
  });
}

module.exports = { transcribeChunks };
