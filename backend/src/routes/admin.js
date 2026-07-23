const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const userModel = require('../db/userModel');
const activityLogModel = require('../db/activityLogModel');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/users', (req, res) => {
  res.json({ users: userModel.listAll() });
});

router.post('/users', async (req, res) => {
  const { username, email } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: 'El nombre de usuario es requerido' });
  }

  if (userModel.findByUsername(username)) {
    return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });
  }

  const tempPassword = crypto.randomBytes(6).toString('base64url');
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = userModel.create({
    username,
    email,
    passwordHash,
    role: 'user',
    mustChangePassword: 1,
  });

  activityLogModel.log({
    userId: req.user.id,
    username: req.user.username,
    action: 'user_created',
    details: `Usuario creado: ${username}`,
  });

  res.status(201).json({
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
    tempPassword,
  });
});

router.patch('/users/:id/revoke', (req, res) => {
  const user = userModel.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  if (user.role === 'admin') {
    return res.status(400).json({ error: 'No se puede revocar al administrador' });
  }

  userModel.setActive(user.id, false);

  activityLogModel.log({
    userId: req.user.id,
    username: req.user.username,
    action: 'user_revoked',
    details: `Acceso revocado: ${user.username}`,
  });

  res.json({ message: 'Acceso revocado' });
});

router.delete('/users/:id', (req, res) => {
  const user = userModel.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  if (user.role === 'admin') {
    return res.status(400).json({ error: 'No se puede eliminar al administrador' });
  }

  userModel.deleteUser(user.id);

  activityLogModel.log({
    userId: req.user.id,
    username: req.user.username,
    action: 'user_deleted',
    details: `Usuario eliminado: ${user.username}`,
  });

  res.json({ message: 'Usuario eliminado' });
});

router.get('/activity-log', (req, res) => {
  res.json({ log: activityLogModel.listRecent() });
});

module.exports = router;
