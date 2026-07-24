const fs = require('fs');
const path = require('path');
const db = require('./connection');

const BACKUPS_DIR = path.join(__dirname, '../../backups');
const MAX_BACKUPS = 7;
const BACKUP_FILENAME_PATTERN = /^forense_\d{4}-\d{2}-\d{2}\.db$/;

function todayDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function rotateOldBackups() {
  const files = fs
    .readdirSync(BACKUPS_DIR)
    .filter((name) => BACKUP_FILENAME_PATTERN.test(name))
    .sort(); // orden alfabetico = orden cronologico (nombre = YYYY-MM-DD)

  const excess = files.length - MAX_BACKUPS;
  if (excess <= 0) return;

  files.slice(0, excess).forEach((name) => {
    fs.rmSync(path.join(BACKUPS_DIR, name), { force: true });
  });
}

// Se corre una vez al iniciar el servidor. Un backup por dia calendario: si
// el servidor se reinicia varias veces el mismo dia, pisa el backup de ese
// dia en vez de acumular copias identicas.
async function runBackup() {
  try {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    const backupPath = path.join(BACKUPS_DIR, `forense_${todayDateString()}.db`);

    // db.backup() usa la API de backup online de SQLite: es segura incluso
    // con journal_mode=WAL y con el servidor escribiendo en la base al mismo
    // tiempo. Copiar el archivo .db a mano (fs.copyFile) podria producir un
    // backup incompleto si hay cambios todavia sin volcar del .db-wal.
    await db.backup(backupPath);

    rotateOldBackups();
    console.log(`Backup de la base de datos creado: ${path.basename(backupPath)}`);
  } catch (err) {
    // Un backup fallido no debe impedir que el servidor arranque.
    console.error(`No se pudo crear el backup de la base de datos: ${err.message}`);
  }
}

module.exports = { runBackup, BACKUPS_DIR };
