const express = require('express');
const authController = require('../auth/authController');
const { requireAuth } = require('../middleware/auth');
const { recoveryStartLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/login', authController.login);
router.post('/forgot-password', recoveryStartLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/me', requireAuth, authController.me);

router.post('/first-login/password', requireAuth, authController.firstLoginSetPassword);
router.post('/first-login/security-question', requireAuth, authController.firstLoginSetSecurityQuestion);
router.post('/recovery-start', recoveryStartLimiter, authController.recoveryStart);
router.post('/security-answer', authController.securityAnswer);

module.exports = router;
