const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/uploadValidation');
const jobManager = require('../processing/jobManager');

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

router.post('/', upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibio ningun archivo' });
  }

  try {
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
