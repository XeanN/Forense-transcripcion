const db = require('./connection');

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
  db.prepare(
    `INSERT INTO activity_log
       (user_id, username, action, file_name, file_type, duration_seconds,
        file_hash, started_at, completed_at, processing_seconds, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
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
    details || null
  );
}

function listRecent(limit = 200) {
  return db
    .prepare('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?')
    .all(limit);
}

module.exports = { log, listRecent };
