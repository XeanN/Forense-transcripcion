// Extensiones que file-type puede detectar leyendo los primeros bytes del
// archivo (magic bytes), confirmadas empiricamente con muestras reales
// generadas por ffmpeg para cada uno de nuestros formatos soportados:
// wav->audio/wav, mp3->audio/mpeg, m4a->audio/x-m4a, mp4->video/mp4,
// mov->video/quicktime, avi->video/vnd.avi, mkv->video/matroska.
const ALLOWED_DETECTED_EXTENSIONS = new Set(['mp4', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'm4a']);

// file-type es un paquete ESM puro; se importa dinamicamente para poder
// usarlo desde este archivo CommonJS.
async function detectRealFileType(filePath) {
  const { fileTypeFromFile } = await import('file-type');
  return fileTypeFromFile(filePath);
}

// No confia en la extension del nombre de archivo: lee el contenido real.
// Devuelve { valid, detected } donde detected es undefined si el contenido
// no coincide con ningun formato reconocido (ej. un .txt renombrado a .mp3).
async function isValidMediaFile(filePath) {
  const detected = await detectRealFileType(filePath);
  return {
    valid: !!detected && ALLOWED_DETECTED_EXTENSIONS.has(detected.ext),
    detected,
  };
}

module.exports = { isValidMediaFile, ALLOWED_DETECTED_EXTENSIONS };
