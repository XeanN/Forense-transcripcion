const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../db/userModel');
const { sendPasswordResetEmail } = require('./mailer');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

async function login(req, res) {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contrasena son requeridos' });
  }

  const user = userModel.findByUsername(username);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Credenciales invalidas' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Credenciales invalidas' });
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: !!user.must_change_password,
    },
  });
}

async function forgotPassword(req, res) {
  const { username } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: 'Usuario es requerido' });
  }

  const user = userModel.findByUsername(username);

  // Siempre responder igual, exista o no el usuario, para no filtrar informacion
  if (!user || !user.email) {
    return res.json({
      message: 'Si el usuario existe y tiene un correo asociado, se envio un link de recuperacion.',
    });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + RESET_TOKEN_TTL_MS;
  userModel.setResetToken(user.id, token, expiresAt);

  const resetLink = `${process.env.FRONTEND_URL}/login/reset-password.html?token=${token}`;

  try {
    await sendPasswordResetEmail(user.email, resetLink);
  } catch (err) {
    console.error('Error enviando correo de recuperacion:', err.message);
  }

  res.json({
    message: 'Si el usuario existe y tiene un correo asociado, se envio un link de recuperacion.',
  });
}

async function resetPassword(req, res) {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token y nueva contrasena son requeridos' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'La contrasena debe tener al menos 8 caracteres' });
  }

  const user = userModel.findByResetToken(token);
  if (!user) {
    return res.status(400).json({ error: 'Token invalido o expirado' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  userModel.updatePassword(user.id, passwordHash);

  res.json({ message: 'Contrasena actualizada correctamente' });
}

async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { login, forgotPassword, resetPassword, me };
