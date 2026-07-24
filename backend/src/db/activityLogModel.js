const crypto = require('crypto');
const db = require('./connection');

// Hash de referencia para la primera entrada de la cadena (no hay una
// entrada anterior). Mismo largo que un SHA-256 real para que el formato
// de la columna sea consistente.
const GENESIS_HASH = '0'.repeat(64);

// Orden fijo de campos usado para calcular el hash de cada fila. Debe
// incluir TODOS los campos relevantes de la fila (menos entry_hash, que es
// el resultado) para que cualquier alteracion, de cualquier campo, rompa
// la cadena.
function computeEntryHash(row) {
  const payload = JSON.stringify([
    row.id,
    row.user_id,
    row.username,
    row.action,
    row.file_name,
    row.file_type,
    row.duration_seconds,
    row.file_hash,
    row.started_at,
    row.completed_at,
    row.processing_seconds,
    row.details,
    row.created_at,
    row.previous_hash,
  ]);
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function getLastEntryHash() {
  const last = db.prepare('SELECT entry_hash FROM activity_log ORDER BY id DESC LIMIT 1').get();
  return (last && last.entry_hash) || GENESIS_HASH;
}

function log({
  userId,
  username,
  action,
  fileName,
  fileType,
  durationSeconds,
  fileHash,
  startedAt,
  completedAt,
  processingSeconds,
  details,
}) {
  const previousHash = getLastEntryHash();

  const result = db
    .prepare(
      `INSERT INTO activity_log
         (user_id, username, action, file_name, file_type, duration_seconds,
          file_hash, started_at, completed_at, processing_seconds, details, previous_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId || null,
      username,
      action,
      fileName || null,
      fileType || null,
      durationSeconds || null,
      fileHash || null,
      startedAt || null,
      completedAt || null,
      processingSeconds != null ? processingSeconds : null,
      details || null,
      previousHash
    );

  // Se calcula el hash a partir de la fila ya insertada (leida de vuelta de
  // la base), no de los valores en JS, para que el hash refleje exactamente
  // lo que quedo persistido (mismos tipos/precision que vera la verificacion).
  const row = db.prepare('SELECT * FROM activity_log WHERE id = ?').get(result.lastInsertRowid);
  const entryHash = computeEntryHash(row);
  db.prepare('UPDATE activity_log SET entry_hash = ? WHERE id = ?').run(entryHash, row.id);
}

function listRecent(limit = 200) {
  return db
    .prepare('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?')
    .all(limit);
}

// Recalcula la cadena para filas que quedaron sin entry_hash (entradas
// creadas antes de que existiera esta funcionalidad). Se corre una sola vez:
// si ya no quedan filas sin hash, no hace nada.
function backfillChainIfNeeded() {
  const pending = db.prepare('SELECT COUNT(*) AS n FROM activity_log WHERE entry_hash IS NULL').get();
  if (!pending || pending.n === 0) return;

  const rows = db.prepare('SELECT * FROM activity_log ORDER BY id ASC').all();
  let previousHash = GENESIS_HASH;

  const updateStmt = db.prepare('UPDATE activity_log SET previous_hash = ?, entry_hash = ? WHERE id = ?');
  const backfillTx = db.transaction(() => {
    for (const row of rows) {
      row.previous_hash = previousHash;
      const entryHash = computeEntryHash(row);
      updateStmt.run(previousHash, entryHash, row.id);
      previousHash = entryHash;
    }
  });
  backfillTx();

  console.log(`Log de actividad: se calculo la cadena de integridad retroactiva para ${rows.length} entradas existentes.`);
}

// Recorre toda la tabla en orden y confirma que cada entry_hash coincide con
// el contenido de su fila, y que cada previous_hash coincide con el
// entry_hash de la fila anterior. Si alguien edita una fila vieja a mano en
// la base, esto lo detecta.
function verifyIntegrity() {
  const rows = db.prepare('SELECT * FROM activity_log ORDER BY id ASC').all();
  let expectedPrevious = GENESIS_HASH;

  for (const row of rows) {
    if (row.previous_hash !== expectedPrevious) {
      return {
        ok: false,
        brokenAt: row.id,
        reason: 'El hash de la entrada anterior no coincide (la cadena esta rota antes de esta entrada).',
        checked: rows.length,
      };
    }

    const recomputed = computeEntryHash(row);
    if (recomputed !== row.entry_hash) {
      return {
        ok: false,
        brokenAt: row.id,
        reason: 'El contenido de esta entrada no coincide con su hash guardado (fue modificada).',
        checked: rows.length,
      };
    }

    expectedPrevious = row.entry_hash;
  }

  return { ok: true, checked: rows.length };
}

backfillChainIfNeeded();

module.exports = { log, listRecent, verifyIntegrity };
