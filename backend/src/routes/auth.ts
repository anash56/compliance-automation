// src/routes/auth.ts

import express, { Router, Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../server';
import auth from '../middleware/auth';
// @ts-ignore
import nodemailer from 'nodemailer';
 // @ts-ignore
import rateLimit from 'express-rate-limit';
// @ts-ignore
import speakeasy from 'speakeasy';
// @ts-ignore
import qrcode from 'qrcode';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per window
  message: { error: 'Too many authentication attempts, please try again in 15 minutes.' }
});

const router: Router = express.Router();

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return process.env.JWT_SECRET;
};

// Sign up
router.post('/signup', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body;

    // Validation
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }

    // Full name validation (only letters, 4-30 characters)
    const fullNameRegex = /^[a-zA-Z\s]{4,30}$/;
    if (!fullNameRegex.test(fullName.trim())) {
      return res.status(400).json({ error: 'Full name must be 4-30 characters with only letters and spaces' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Password length validation
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Password strength validation (must have uppercase, lowercase, number)
    const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    if (!passwordStrengthRegex.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    // Generate Verification Token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        fullName: fullName.trim(),
        role: 'business_owner',
        isEmailVerified: false,
        verificationToken
      }
    });

    // Send verification email
    let smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER as string, pass: process.env.SMTP_PASS as string },
    };

    if (!smtpConfig.auth.user) {
      const testAccount = await nodemailer.createTestAccount();
      smtpConfig.auth = { user: testAccount.user, pass: testAccount.pass };
    }
    const transporter = nodemailer.createTransport(smtpConfig);
    const verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?verify=${verificationToken}`;

    const info = await transporter.sendMail({
      from: `"ComplianceBot" <${process.env.SMTP_USER || 'noreply@compliancebot.com'}>`,
      to: user.email,
      subject: 'Verify your email address',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2563eb;">Welcome to ComplianceBot!</h2>
          <p>Hi ${user.fullName},</p>
          <p>Please verify your email address by clicking the link below:</p>
          <br/>
          <a href="${verifyLink}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Verify Email</a>
        </div>
      `
    });

    if (!process.env.SMTP_USER) console.log('Verification Email preview URL: %s', nodemailer.getTestMessageUrl(info));

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Please check your email to verify your account.'
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// Login
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user (case-insensitive email)
    const user: any = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({ error: 'Please verify your email address before logging in.' });
    }

    if (!user.password) {
      return res.status(401).json({ error: 'Please use the Google or GitHub login option for this account.' });
    }

    // Check password
    const isPasswordValid = await bcryptjs.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.isTwoFactorEnabled) {
      const tempToken = jwt.sign(
        { tempUserId: user.id, rememberMe },
        getJwtSecret(),
        { expiresIn: '5m' }
      );
      return res.json({ success: true, require2FA: true, tempToken });
    }

    // Generate Access & Refresh Tokens
    const token = jwt.sign(
      { userId: user.id },
      getJwtSecret(),
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      getJwtSecret(),
      { expiresIn: rememberMe ? '30d' : '1d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 30 days or 1 day
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isTwoFactorEnabled: user.isTwoFactorEnabled
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Verify 2FA during Login
router.post('/verify-2fa', authLimiter, async (req: Request, res: Response) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) return res.status(400).json({ error: 'Token and code are required' });

    const decoded = jwt.verify(tempToken, getJwtSecret()) as any;
    const user: any = await prisma.user.findUnique({ where: { id: decoded.tempUserId } });

    if (!user || !user.twoFactorSecret) return res.status(400).json({ error: 'Invalid user or 2FA not set up' });

    let verified = false;
    let usedBackupCode = false;

    if (code.length === 6 && /^\d+$/.test(code)) {
      verified = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: code });
    } else if (user.twoFactorBackupCodes && user.twoFactorBackupCodes.includes(code.toLowerCase())) {
      verified = true;
      usedBackupCode = true;
    }

    if (!verified) return res.status(400).json({ error: 'Invalid 2FA code or Backup code' });

    if (usedBackupCode) {
      await (prisma.user as any).update({
        where: { id: user.id },
        data: { twoFactorBackupCodes: user.twoFactorBackupCodes.filter((c: string) => c !== code.toLowerCase()) }
      });
    }

    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '15m' });
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      getJwtSecret(),
      { expiresIn: decoded.rememberMe ? '30d' : '1d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: decoded.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, isTwoFactorEnabled: user.isTwoFactorEnabled }
    });
  } catch (error) {
    res.status(400).json({ error: 'Session expired or invalid. Please login again.' });
  }
});

// Setup 2FA (Generates QR Code)
router.post('/2fa/setup', auth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: (req as any).userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const secret = speakeasy.generateSecret({ name: `ComplianceBot (${user.email})` });
    await prisma.user.update({ where: { id: (req as any).userId }, data: { twoFactorSecret: secret.base32 } });
    
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url || '');
    res.json({ success: true, secret: secret.base32, qrCodeUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

// Enable 2FA (Verifies First Code)
router.post('/2fa/enable', auth, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    const user: any = await prisma.user.findUnique({ where: { id: (req as any).userId } });

    if (!user || !user.twoFactorSecret) return res.status(400).json({ error: '2FA not initialized' });

    const verified = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: code });
    if (!verified) return res.status(400).json({ error: 'Invalid verification code' });

    const backupCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex'));
    await (prisma.user as any).update({ where: { id: (req as any).userId }, data: { isTwoFactorEnabled: true, twoFactorBackupCodes: backupCodes } });
    res.json({ success: true, message: 'Two-Factor Authentication enabled successfully', backupCodes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to enable 2FA' });
  }
});

// Disable 2FA
router.post('/2fa/disable', auth, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    const user: any = await prisma.user.findUnique({ where: { id: (req as any).userId } });

    if (!user || !user.twoFactorSecret) return res.status(400).json({ error: '2FA is not enabled' });

    const verified = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: code });
    if (!verified) return res.status(400).json({ error: 'Invalid verification code' });

    await (prisma.user as any).update({ where: { id: (req as any).userId }, data: { isTwoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] } });
    res.json({ success: true, message: 'Two-Factor Authentication disabled successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// Verify Email
router.post('/verify-email', authLimiter, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const user: any = await (prisma.user as any).findUnique({ where: { verificationToken: token } });
    if (!user) return res.status(400).json({ error: 'Invalid or expired verification link' });

    await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true, verificationToken: null }
    });

    res.json({ success: true, message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// Refresh Token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) return res.status(401).json({ error: 'No refresh token provided' });

    const decoded = jwt.verify(refreshToken, getJwtSecret()) as any;
    if (decoded.type !== 'refresh') return res.status(401).json({ error: 'Invalid token type' });

    const user: any = await (prisma.user as any).findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });

    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '15m' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.json({ success: true });
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// Logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

// Get current user
router.get('/me', auth, async (req: Request, res: Response) => {
  try {
    const user = await (prisma.user as any).findUnique({
      where: { id: (req as any).userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        isTwoFactorEnabled: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Forgot Password (Sends Email)
router.post('/forgot-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // Return success anyway to prevent hackers from guessing emails
      return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }

    const resetToken = jwt.sign(
      { userId: user.id, purpose: 'password_reset' },
      getJwtSecret(),
      { expiresIn: '15m' }
    );

    let smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER as string, pass: process.env.SMTP_PASS as string },
    };

    if (!smtpConfig.auth.user) {
      const testAccount = await nodemailer.createTestAccount();
      smtpConfig.auth = { user: testAccount.user, pass: testAccount.pass };
    }

    const transporter = nodemailer.createTransport(smtpConfig);
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?reset=${resetToken}`;

    const info = await transporter.sendMail({
      from: `"ComplianceBot Support" <${process.env.SMTP_USER || 'noreply@compliancebot.com'}>`,
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2563eb;">Password Reset Request</h2>
          <p>Hello <strong>${user.fullName}</strong>,</p>
          <p>We received a request to reset your password. This secure link is valid for 15 minutes.</p>
          <br/>
          <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
          <br/><br/>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `
    });

    if (!process.env.SMTP_USER) console.log('Password Reset Email preview URL: %s', nodemailer.getTestMessageUrl(info));
    res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Reset Password (Saves New Password)
router.post('/reset-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });

    const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    if (!passwordStrengthRegex.test(newPassword)) return res.status(400).json({ error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });

    const decoded = jwt.verify(token, getJwtSecret()) as any;
    if (decoded.purpose !== 'password_reset') return res.status(400).json({ error: 'Invalid token type' });

    const salt = await bcryptjs.genSalt(10);
    await prisma.user.update({ where: { id: decoded.userId }, data: { password: await bcryptjs.hash(newPassword, salt) } });
    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
  }
});

// Update user profile (Name & Password)
router.put('/profile', auth, async (req: Request, res: Response) => {
  try {
    const { fullName, currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: (req as any).userId } });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const updates: any = {};

    if (fullName) {
      const fullNameRegex = /^[a-zA-Z\s]{4,30}$/;
      if (!fullNameRegex.test(fullName.trim())) {
        return res.status(400).json({ error: 'Full name must be 4-30 characters with only letters and spaces' });
      }
      updates.fullName = fullName.trim();
    }

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password is required to set a new password' });
      if (!user.password) return res.status(400).json({ error: 'Your account uses social login and does not have a password.' });
      const isPasswordValid = await bcryptjs.compare(currentPassword, user.password);
      if (!isPasswordValid) return res.status(401).json({ error: 'Invalid current password' });

      const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
      if (!passwordStrengthRegex.test(newPassword)) {
        return res.status(400).json({ error: 'New password must contain uppercase, lowercase, and a number' });
      }
      const salt = await bcryptjs.genSalt(10);
      updates.password = await bcryptjs.hash(newPassword, salt);
    }

    const updatedUser = await (prisma.user as any).update({
      where: { id: (req as any).userId },
      data: updates,
      select: { id: true, email: true, fullName: true, role: true, isTwoFactorEnabled: true }
    });
    res.json({ success: true, user: updatedUser, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// OAuth URL Generators
router.get('/google/url', (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=email profile&state=google`;
  res.json({ url });
});

router.get('/github/url', (req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID || '';
  const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email&state=github`;
  res.json({ url });
});

// OAuth Callback Handlers
router.post('/oauth/callback', async (req: Request, res: Response) => {
  try {
    const { provider, code } = req.body;
    const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;

    let email = '';
    let fullName = '';
    let providerId = '';
    let isEmailVerified = false;

    if (provider === 'google') {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(400).json({ error: 'Google OAuth is not configured in .env' });
      }
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });
      const tokenData: any = await tokenRes.json();
      if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const userData: any = await userRes.json();
      email = userData.email.toLowerCase();
      fullName = userData.name || 'Google User';
      providerId = userData.id;
      isEmailVerified = userData.verified_email || true;

    } else if (provider === 'github') {
      if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
        return res.status(400).json({ error: 'GitHub OAuth is not configured in .env' });
      }
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri
        })
      });
      const tokenData: any = await tokenRes.json();
      if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

      const userRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const userData: any = await userRes.json();

      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const emailsData: any = await emailsRes.json();

      const primaryEmail = emailsData.find((e: any) => e.primary)?.email || emailsData[0]?.email;
      if (!primaryEmail) throw new Error('No email associated with GitHub account');

      email = primaryEmail.toLowerCase();
      fullName = userData.name || userData.login || 'GitHub User';
      providerId = String(userData.id);
      isEmailVerified = true;
    } else {
      return res.status(400).json({ error: 'Unsupported provider' });
    }

    let user: any = await (prisma.user as any).findUnique({ where: { email } });

    if (!user) {
      user = await (prisma.user as any).create({
        data: { email, fullName, authProvider: provider, providerId, isEmailVerified, role: 'business_owner' }
      });
    } else if (!user.providerId) {
       user = await (prisma.user as any).update({
         where: { email },
         data: { authProvider: provider, providerId }
       });
    }

    if (user.isTwoFactorEnabled) {
      const tempToken = jwt.sign(
        { tempUserId: user.id, rememberMe: true },
        getJwtSecret(),
        { expiresIn: '5m' }
      );
      return res.json({ success: true, require2FA: true, tempToken });
    }

    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, getJwtSecret(), { expiresIn: '30d' });

    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 30 * 24 * 60 * 60 * 1000 });

    res.json({ success: true, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, isTwoFactorEnabled: user.isTwoFactorEnabled } });
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.status(401).json({ error: error.message || 'Authentication failed' });
  }
});

export default router;
