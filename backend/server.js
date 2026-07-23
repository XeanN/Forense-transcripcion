require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/auth');
const adminRoutes = require('./src/routes/admin');
const uploadRoutes = require('./src/routes/upload');
const jobRoutes = require('./src/routes/job');
const jobManager = require('./src/processing/jobManager');
const { TEMP_ROOT } = require('./src/middleware/uploadValidation');
const { notFoundHandler, errorHandler } = require('./src/middleware/errorHandler');

// Privacidad: cualquier archivo que haya quedado de una ejecucion anterior
// (por un cierre inesperado del servidor) se borra al iniciar.
jobManager.purgeAllOnStartup(TEMP_ROOT);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/job', jobRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor forense escuchando en http://localhost:${PORT}`);
});
