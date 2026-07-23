const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/uploadValidation');
const jobManager = require('../processing/jobManager');

const router = express.Router();

router.use(requireAuth);

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibio ningun archivo' });
  }

  const job = jobManager.createJob({
    userId: req.user.id,
    username: req.user.username,
    mediaType: req.mediaType,
    originalName: req.file.originalname,
    jobDir: req.jobDir,
    originalPath: req.file.path,
  });

  res.status(201).json({
    jobId: job.id,
    mediaType: job.mediaType,
    originalName: job.originalName,
  });
});

module.exports = router;
