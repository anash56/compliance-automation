// src/routes/auth.ts

import express, { Router } from 'express';
// @ts-ignore
import rateLimit from 'express-rate-limit';
import auth from '../middleware/auth';
import {
  signup,
  login,
  verify2FA,
  setup2FA,
  enable2FA,
  disable2FA,
  verifyEmail,
  refreshToken,
  logout,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  updateProfile,
  getGoogleUrl,
  getGithubUrl,
  handleOAuthCallback,
  deleteAccount
} from '../controllers/authController';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts, please try again in 15 minutes.' }
});

const router: Router = express.Router();

// Public Authentication Endpoints
router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.post('/verify-2fa', authLimiter, verify2FA);
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

// OAuth Endpoints
router.get('/google/url', getGoogleUrl);
router.get('/github/url', getGithubUrl);
router.post('/oauth/callback', handleOAuthCallback);

// Authenticated Endpoints
router.get('/me', auth, getCurrentUser);
router.put('/profile', auth, updateProfile);
router.post('/2fa/setup', auth, setup2FA);
router.post('/2fa/enable', auth, enable2FA);
router.post('/2fa/disable', auth, disable2FA);
router.delete('/me', auth, deleteAccount);

export default router;
