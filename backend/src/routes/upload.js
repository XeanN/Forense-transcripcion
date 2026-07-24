const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const { upload, MAX_FILE_SIZE_MB } = require('../middleware/uploadValidation');
const { isValidMediaFile } = require('../processing/fileTypeValidator');
const jobManager = require('../processing/jobManager');
const activityLogModel = require('../db/activityLogModel');

const router = express.Router();

router.use(requireAuth);

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// El frontend usa esto para rechazar archivos demasiado grandes antes de
// empezar a subirlos, sin tener que duplicar el numero a mano.
router.get('/limits', (req, res) => {
  res.json({ maxFileSizeMB: MAX_FILE_SIZE_MB });
});

router.post('/', upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibio ningun archivo' });
  }

  try {
    // No confiar solo en la extension del nombre: se lee el contenido real
    // del archivo (magic bytes) para confirmar que es un video/audio valido.
    const { valid, detected } = await isValidMediaFile(req.file.path);
    if (!valid) {
      fs.rm(req.jobDir, { recursive: true, force: true }, () => {});

      activityLogModel.log({
        userId: req.user.id,
        username: req.user.username,
        action: 'upload_rejected',
        fileName: req.file.originalname,
        details: `Archivo rechazado: el contenido no coincide con un video/audio valido (detectado: ${detected ? detected.mime : 'desconocido'})`,
      });

      return res.status(400).json({
        error: 'El archivo no parece ser un video o audio valido (el contenido no coincide con su extension). Verificalo e intenta de nuevo.',
      });
    }

    // Cadena de custodia: hash del archivo tal como fue recibido, antes de
    // cualquier procesamiento o borrado.
    const fileHash = await hashFile(req.file.path);

    const job = jobManager.createJob({
      userId: req.user.id,
      username: req.user.username,
      mediaType: req.mediaType,
      originalName: req.file.originalname,
      jobDir: req.jobDir,
      originalPath: req.file.path,
      fileHash,
    });

    res.status(201).json({
      jobId: job.id,
      mediaType: job.mediaType,
      originalName: job.originalName,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
