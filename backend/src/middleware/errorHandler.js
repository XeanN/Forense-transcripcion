const multer = require('multer');
const activityLogModel = require('../db/activityLogModel');
const { MAX_FILE_SIZE_MB } = require('./uploadValidation');

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
}

function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      if (req.user) {
        activityLogModel.log({
          userId: req.user.id,
          username: req.user.username,
          action: 'upload_rejected',
          details: `Archivo rechazado: excede el limite de tamano (${MAX_FILE_SIZE_MB} MB)`,
        });
      }
      return res.status(413).json({
        error: `El archivo excede el tamano maximo permitido (${MAX_FILE_SIZE_MB} MB).`,
      });
    }
    return res.status(400).json({ error: `Error de subida: ${err.message}` });
  }

  if (err && err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error('Error no controlado:', err && err.message ? err.message : err);
  res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { notFoundHandler, errorHandler };
