const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { login, getProfile, getMe } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Create rate limiter for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 login attempts per 15 minutes
  message: { message: 'Too many login attempts from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, login);
router.get('/profile', authenticateToken, getProfile);
router.get('/me', authenticateToken, getMe);

module.exports = router;
