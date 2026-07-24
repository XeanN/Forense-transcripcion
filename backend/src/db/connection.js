const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH
  ? path.resolve(__dirname, '../..', process.env.DB_PATH)
  : path.join(__dirname, 'forense.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    must_change_password INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    reset_token TEXT,
    reset_token_expires INTEGER,
    security_question TEXT,
    security_answer_hash TEXT,
    security_attempts INTEGER NOT NULL DEFAULT 0,
    security_locked_until INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    file_name TEXT,
    file_type TEXT,
    duration_seconds REAL,
    file_hash TEXT,
    started_at TEXT,
    completed_at TEXT,
    processing_seconds REAL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    previous_hash TEXT,
    entry_hash TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );
`);

// Migracion idempotente para bases de datos creadas antes de agregar columnas
// nuevas (pregunta de seguridad, hash de integridad, tiempos de procesamiento).
function addColumnIfMissing(table, name, definition) {
  const existingColumns = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!existingColumns.includes(name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}
addColumnIfMissing('users', 'security_question', 'security_question TEXT');
addColumnIfMissing('users', 'security_answer_hash', 'security_answer_hash TEXT');
addColumnIfMissing('users', 'security_attempts', 'security_attempts INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('users', 'security_locked_until', 'security_locked_until INTEGER');
addColumnIfMissing('activity_log', 'file_hash', 'file_hash TEXT');
addColumnIfMissing('activity_log', 'started_at', 'started_at TEXT');
addColumnIfMissing('activity_log', 'completed_at', 'completed_at TEXT');
addColumnIfMissing('activity_log', 'processing_seconds', 'processing_seconds REAL');
addColumnIfMissing('activity_log', 'previous_hash', 'previous_hash TEXT');
addColumnIfMissing('activity_log', 'entry_hash', 'entry_hash TEXT');

module.exports = db;
