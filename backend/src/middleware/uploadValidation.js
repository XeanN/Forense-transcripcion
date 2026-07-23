const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.m4a']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv']);

const TEMP_ROOT = path.join(__dirname, '../../temp');

function ensureTempRoot() {
  if (!fs.existsSync(TEMP_ROOT)) {
    fs.mkdirSync(TEMP_ROOT, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureTempRoot();
    const jobId = crypto.randomUUID();
    const jobDir = path.join(TEMP_ROOT, jobId);
    fs.mkdirSync(jobDir, { recursive: true });
    req.jobId = jobId;
    req.jobDir = jobDir;
    cb(null, jobDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `original${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`Tipo de archivo no permitido: ${ext}`));
  }
  req.mediaType = VIDEO_EXTENSIONS.has(ext) ? 'video' : 'audio';
  cb(null, true);
}

const maxSizeBytes = (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 2048) * 1024 * 1024;

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSizeBytes },
});

module.exports = { upload, TEMP_ROOT, ALLOWED_EXTENSIONS };
