const db = require('./connection');

function log({ userId, username, action, fileName, fileType, durationSeconds, details }) {
  db.prepare(
    `INSERT INTO activity_log (user_id, username, action, file_name, file_type, duration_seconds, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId || null,
    username,
    action,
    fileName || null,
    fileType || null,
    durationSeconds || null,
    details || null
  );
}

function listRecent(limit = 200) {
  return db
    .prepare('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?')
    .all(limit);
}

module.exports = { log, listRecent };
