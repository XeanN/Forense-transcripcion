const rateLimit = require('express-rate-limit');

// Limita cuantas veces se puede iniciar un flujo de recuperacion de
// contrasena desde la misma IP. A diferencia del login (que bloquea una
// cuenta especifica), aca no hay una cuenta "duena" del intento todavia
// (el endpoint ni siquiera confirma si el usuario existe), asi que el
// limite es por IP en vez de por usuario.
const recoveryStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de recuperacion desde esta conexion. Intenta de nuevo en unos minutos.' },
});

module.exports = { recoveryStartLimiter };
