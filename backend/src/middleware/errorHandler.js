const multer = require('multer');

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
}

function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'El archivo excede el tamano maximo permitido' });
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
