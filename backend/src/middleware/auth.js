const jwt = require('jsonwebtoken');
const userModel = require('../db/userModel');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = userModel.findById(payload.sub);

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Sesion invalida' });
    }

    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
