const db = require('./connection');

function findByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function findByResetToken(token) {
  return db
    .prepare('SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?')
    .get(token, Date.now());
}

function listAll() {
  return db
    .prepare(
      'SELECT id, username, email, role, must_change_password, is_active, created_at FROM users ORDER BY created_at DESC'
    )
    .all();
}

function create({ username, email, passwordHash, role = 'user', mustChangePassword = 0 }) {
  const result = db
    .prepare(
      `INSERT INTO users (username, email, password_hash, role, must_change_password)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(username, email || null, passwordHash, role, mustChangePassword ? 1 : 0);
  return findById(result.lastInsertRowid);
}

function setActive(id, isActive) {
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
}

function deleteUser(id) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

function setResetToken(id, token, expiresAt) {
  db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(
    token,
    expiresAt,
    id
  );
}

function updatePassword(id, passwordHash) {
  db.prepare(
    'UPDATE users SET password_hash = ?, must_change_password = 0, reset_token = NULL, reset_token_expires = NULL WHERE id = ?'
  ).run(passwordHash, id);
}

module.exports = {
  findByUsername,
  findById,
  findByResetToken,
  listAll,
  create,
  setActive,
  deleteUser,
  setResetToken,
  updatePassword,
};
