const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../db/userModel');
const activityLogModel = require('../db/activityLogModel');
const { sendPasswordResetEmail } = require('./mailer');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora
const MAX_SECURITY_ATTEMPTS = 5;
const SECURITY_LOCK_TTL_MS = 15 * 60 * 1000; // 15 minutos
const GENERIC_RECOVERY_ERROR = 'Respuesta incorrecta o recuperacion no disponible para este usuario.';

function isSecurityLockActive(user) {
  return !!user.security_locked_until && user.security_locked_until > Date.now();
}

async function sendAdminResetEmail(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + RESET_TOKEN_TTL_MS;
  userModel.setResetToken(user.id, token, expiresAt);

  const resetLink = `${process.env.FRONTEND_URL}/login/reset-password.html?token=${token}`;

  try {
    await sendPasswordResetEmail(user.email, resetLink);
  } catch (err) {
    console.error('Error enviando correo de recuperacion:', err.message);
  }
}

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

  await sendAdminResetEmail(user);

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

// Paso 1 del primer login obligatorio: define una contrasena nueva.
// Deja must_change_password en 1 a proposito: falta el paso 2 (pregunta de
// seguridad) para completar el onboarding.
async function firstLoginSetPassword(req, res) {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'La contrasena debe tener al menos 8 caracteres' });
  }

  const user = userModel.findById(req.user.id);
  if (!user || !user.must_change_password) {
    return res.status(400).json({ error: 'Este paso no aplica para tu cuenta' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  userModel.setPassword(user.id, passwordHash);

  res.json({ message: 'Contrasena actualizada. Ahora configura tu pregunta de seguridad.' });
}

// Paso 2 del primer login obligatorio: pregunta y respuesta propias del
// usuario (no la del admin). Recien aqui se marca el onboarding como completo.
async function firstLoginSetSecurityQuestion(req, res) {
  const { question, answer } = req.body || {};
  const trimmedQuestion = (question || '').trim();
  const trimmedAnswer = (answer || '').trim();

  if (trimmedQuestion.length < 3) {
    return res.status(400).json({ error: 'La pregunta debe tener al menos 3 caracteres' });
  }
  if (trimmedAnswer.length < 2) {
    return res.status(400).json({ error: 'La respuesta debe tener al menos 2 caracteres' });
  }

  const user = userModel.findById(req.user.id);
  if (!user || !user.must_change_password) {
    return res.status(400).json({ error: 'Este paso no aplica para tu cuenta' });
  }

  const answerHash = await bcrypt.hash(trimmedAnswer.toLowerCase(), 12);
  userModel.setSecurityQuestion(user.id, trimmedQuestion, answerHash);

  activityLogModel.log({
    userId: user.id,
    username: user.username,
    action: 'security_question_set',
    details: `Pregunta de seguridad configurada: usuario ${user.username}`,
  });

  res.json({ message: 'Pregunta de seguridad configurada correctamente.' });
}

// Paso 1 de "olvide mi contrasena": segun el rol del usuario, decide si el
// metodo de recuperacion es por correo (admin) o por pregunta de seguridad
// (usuarios normales). No revela si el usuario existe cuando no aplica
// ningun metodo.
async function recoveryStart(req, res) {
  const { username } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: 'Usuario es requerido' });
  }

  const user = userModel.findByUsername(username);

  if (user && user.role === 'admin') {
    if (user.email) {
      await sendAdminResetEmail(user);
    }
    return res.json({
      method: 'email',
      message: 'Si el usuario existe y tiene un correo asociado, se envio un link de recuperacion.',
    });
  }

  if (user && user.role === 'user' && user.security_question && !isSecurityLockActive(user)) {
    return res.json({ method: 'question', question: user.security_question });
  }

  return res.json({ method: 'unavailable' });
}

// Paso 2 de "olvide mi contrasena" para usuarios normales: compara la
// respuesta contra el hash guardado. Mismo mensaje de error generico para
// usuario inexistente, sin pregunta, bloqueado o respuesta incorrecta, para
// no filtrar informacion ni facilitar fuerza bruta sobre usuarios validos.
async function securityAnswer(req, res) {
  const { username, answer, newPassword } = req.body || {};

  if (!username || !answer || !newPassword) {
    return res.status(400).json({ error: 'Usuario, respuesta y nueva contrasena son requeridos' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'La contrasena debe tener al menos 8 caracteres' });
  }

  const user = userModel.findByUsername(username);

  if (!user || user.role !== 'user' || !user.security_question || !user.security_answer_hash) {
    return res.status(401).json({ error: GENERIC_RECOVERY_ERROR });
  }

  if (isSecurityLockActive(user)) {
    activityLogModel.log({
      userId: user.id,
      username: user.username,
      action: 'security_recovery_failed',
      details: `Intento fallido de recuperacion: usuario ${user.username} (bloqueado temporalmente)`,
    });
    return res.status(401).json({ error: GENERIC_RECOVERY_ERROR });
  }

  const match = await bcrypt.compare(answer.trim().toLowerCase(), user.security_answer_hash);

  if (!match) {
    // Si el bloqueo anterior ya expiro, este intento arranca un contador nuevo.
    const lockExpired = user.security_locked_until && user.security_locked_until <= Date.now();
    const currentAttempts = lockExpired ? 0 : user.security_attempts || 0;
    const newAttempts = currentAttempts + 1;
    const lockedUntil = newAttempts >= MAX_SECURITY_ATTEMPTS ? Date.now() + SECURITY_LOCK_TTL_MS : null;

    userModel.setSecurityAttempts(user.id, newAttempts, lockedUntil);

    activityLogModel.log({
      userId: user.id,
      username: user.username,
      action: 'security_recovery_failed',
      details: `Intento fallido de recuperacion: usuario ${user.username}`,
    });

    return res.status(401).json({ error: GENERIC_RECOVERY_ERROR });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  userModel.resetPasswordViaSecurityAnswer(user.id, passwordHash);

  activityLogModel.log({
    userId: user.id,
    username: user.username,
    action: 'security_recovery_success',
    details: `Recuperacion exitosa via pregunta de seguridad: usuario ${user.username}`,
  });

  res.json({ message: 'Contrasena actualizada correctamente.' });
}

module.exports = {
  login,
  forgotPassword,
  resetPassword,
  me,
  firstLoginSetPassword,
  firstLoginSetSecurityQuestion,
  recoveryStart,
  securityAnswer,
};
