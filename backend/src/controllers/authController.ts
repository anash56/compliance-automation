// src/controllers/authController.ts

import { Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
// @ts-ignore
import speakeasy from 'speakeasy';
// @ts-ignore
import qrcode from 'qrcode';
import { prisma } from '../server';
import { sendEmail, isEmailConfigured } from '../services/emailService';
import * as authService from '../services/authService';
import { validateEmail, validateFullName, validatePasswordStrength } from '../utils/validators';

const getJwtSecret = () => {
  return process.env.JWT_SECRET || 'fallback_development_secret_only_replace_in_production';
};

export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }

    if (!validateFullName(fullName)) {
      return res.status(400).json({ error: 'Full name must be 2-50 characters with valid letters' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (!validatePasswordStrength(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
    }

    const existingUser = await authService.findUserByEmail(email);

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const { user, verificationToken } = await authService.registerUser({ email, password, fullName });

    if (isEmailConfigured) {
      const verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?verify=${verificationToken}`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2563eb;">Welcome to ComplianceBot!</h2>
          <p>Hi ${user.fullName},</p>
          <p>Please verify your email address by clicking the link below:</p>
          <br/>
          <a href="${verifyLink}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Verify Email</a>
        </div>
      `;

      sendEmail({
        to: user.email,
        subject: 'Verify your email address',
        html: emailHtml,
      }).catch(async (emailErr: any) => {
        console.error('Background email failed. Auto-verifying user to prevent lockout:', emailErr);
        await prisma.user.update({ where: { id: user.id }, data: { isEmailVerified: true } });
      });
    } else {
      await prisma.user.update({ where: { id: user.id }, data: { isEmailVerified: true } });
    }

    return res.status(201).json({
      success: true,
      message: isEmailConfigured ? 'Account created successfully! Please check your email to verify.' : 'Account created successfully!'
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user: any = await authService.findUserByEmail(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.password) {
      return res.status(401).json({ error: 'Please use the Google or GitHub login option for this account.' });
    }

    const isPasswordValid = await bcryptjs.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({ error: 'Please verify your email address before logging in.' });
    }

    if (user.isTwoFactorEnabled) {
      const tempToken = jwt.sign(
        { tempUserId: user.id, rememberMe },
        getJwtSecret(),
        { expiresIn: '5m' }
      );
      return res.json({ success: true, require2FA: true, tempToken });
    }

    const { token, refreshToken } = authService.generateAuthTokens(user.id, rememberMe);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      token,
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
};

export const verify2FA = async (req: Request, res: Response) => {
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

    const { token, refreshToken } = authService.generateAuthTokens(user.id, decoded.rememberMe);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: decoded.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, isTwoFactorEnabled: user.isTwoFactorEnabled }
    });
  } catch (error) {
    res.status(400).json({ error: 'Session expired or invalid. Please login again.' });
  }
};

export const setup2FA = async (req: Request, res: Response) => {
  try {
    const user = await authService.findUserById((req as any).userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const secret = speakeasy.generateSecret({ name: `ComplianceBot (${user.email})` });
    await prisma.user.update({ where: { id: (req as any).userId }, data: { twoFactorSecret: secret.base32 } });
    
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url || '');
    res.json({ success: true, secret: secret.base32, qrCodeUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
};

export const enable2FA = async (req: Request, res: Response) => {
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
};

export const disable2FA = async (req: Request, res: Response) => {
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
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const updatedUser = await authService.markEmailAsVerified(token);
    if (!updatedUser) return res.status(400).json({ error: 'Invalid or expired verification link' });

    res.json({ success: true, message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) return res.status(401).json({ error: 'No refresh token provided' });

    const decoded = jwt.verify(refreshToken, getJwtSecret()) as any;
    if (decoded.type !== 'refresh') return res.status(401).json({ error: 'Invalid token type' });

    const user: any = await authService.findUserById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const { token } = authService.generateAuthTokens(user.id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.json({ success: true, token });
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};

export const logout = (_req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({ success: true, message: 'Logged out successfully' });
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const user = await authService.findUserById((req as any).userId);
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
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await authService.findUserByEmail(email);

    if (!user) {
      return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }

    const resetToken = jwt.sign(
      { userId: user.id, purpose: 'password_reset' },
      getJwtSecret(),
      { expiresIn: '15m' }
    );

    if (!isEmailConfigured) {
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?reset=${resetToken}`;
      console.log('--- FORGOT PASSWORD LINK (DEV ONLY) ---');
      console.log(resetLink);
      console.log('---------------------------------------');
      return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?reset=${resetToken}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>Hello <strong>${user.fullName}</strong>,</p>
        <p>We received a request to reset your password. This secure link is valid for 15 minutes.</p>
        <br/>
        <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
      </div>
    `;

    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      html: emailHtml,
    });

    res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });

    if (!validatePasswordStrength(newPassword)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
    }

    const decoded = jwt.verify(token, getJwtSecret()) as any;
    if (decoded.purpose !== 'password_reset') return res.status(400).json({ error: 'Invalid token type' });

    const salt = await bcryptjs.genSalt(10);
    await prisma.user.update({ where: { id: decoded.userId }, data: { password: await bcryptjs.hash(newPassword, salt) } });
    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { fullName, currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: (req as any).userId } });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const updates: any = {};

    if (fullName) {
      if (!validateFullName(fullName)) {
        return res.status(400).json({ error: 'Full name must be 2-50 characters' });
      }
      updates.fullName = fullName.trim();
    }

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password is required to set a new password' });
      if (!user.password) return res.status(400).json({ error: 'Your account uses social login and does not have a password.' });
      const isPasswordValid = await bcryptjs.compare(currentPassword, user.password);
      if (!isPasswordValid) return res.status(401).json({ error: 'Invalid current password' });

      if (!validatePasswordStrength(newPassword)) {
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
};

export const getGoogleUrl = (_req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=email profile&state=google`;
  res.json({ url });
};

export const getGithubUrl = (_req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID || '';
  const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email&state=github`;
  res.json({ url });
};

export const handleOAuthCallback = async (req: Request, res: Response) => {
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

    const { token, refreshToken } = authService.generateAuthTokens(user.id, true);

    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });

    res.json({ success: true, token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, isTwoFactorEnabled: user.isTwoFactorEnabled } });
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.status(401).json({ error: error.message || 'Authentication failed' });
  }
};

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    await authService.deleteUserAccount((req as any).userId);
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
};
