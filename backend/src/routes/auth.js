const express = require('express');
const authController = require('../auth/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/me', requireAuth, authController.me);

router.post('/first-login/password', requireAuth, authController.firstLoginSetPassword);
router.post('/first-login/security-question', requireAuth, authController.firstLoginSetSecurityQuestion);
router.post('/recovery-start', authController.recoveryStart);
router.post('/security-answer', authController.securityAnswer);

module.exports = router;
