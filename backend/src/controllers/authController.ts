// src/controllers/authController.ts

import { Request, Response } from 'express';
import { isEmailConfigured } from '../services/emailService';
import * as authService from '../services/authService';
import { validateEmail, validateFullName, validatePasswordStrength } from '../utils/validators';

const setAuthCookies = (res: Response, token: string, refreshToken: string, rememberMe: boolean = false) => {
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
};

const clearAuthCookies = (res: Response) => {
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
};

export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password || !fullName) return res.status(400).json({ error: 'Email, password, and full name are required' });
    if (!validateFullName(fullName)) return res.status(400).json({ error: 'Full name must be 2-50 characters with valid letters' });
    if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!validatePasswordStrength(password)) return res.status(400).json({ error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });

    const result = await authService.registerUser({ email, password, fullName });
    if (!result.success) return res.status(400).json({ error: result.error });

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

    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const result = await authService.authenticateUserCredentials(email, password);

    if (!result.success || !result.user) {
      return res.status(result.isUnverified ? 403 : 401).json({ error: result.error });
    }

    const user = result.user;

    if (user.isTwoFactorEnabled) {
      const tempToken = authService.generateTemp2FAToken(user.id, rememberMe);
      return res.json({ success: true, require2FA: true, tempToken });
    }

    const { token, refreshToken } = authService.generateAuthTokens(user.id, rememberMe);
    setAuthCookies(res, token, refreshToken, rememberMe);

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

    const result = await authService.verify2FALogin(tempToken, code);
    if (!result.success || !result.user) return res.status(400).json({ error: result.error });

    setAuthCookies(res, result.token!, result.refreshToken!, result.rememberMe);

    res.json({
      success: true,
      token: result.token,
      user: { id: result.user.id, email: result.user.email, fullName: result.user.fullName, role: result.user.role, isTwoFactorEnabled: result.user.isTwoFactorEnabled }
    });
  } catch (error) {
    res.status(400).json({ error: 'Session expired or invalid. Please login again.' });
  }
};

export const setup2FA = async (req: Request, res: Response) => {
  try {
    const result = await authService.setup2FA((req as any).userId);
    if (!result.success) return res.status(404).json({ error: result.error });

    res.json({ success: true, secret: result.secret, qrCodeUrl: result.qrCodeUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
};

export const enable2FA = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    const result = await authService.enable2FA((req as any).userId, code);

    if (!result.success) return res.status(400).json({ error: result.error });

    res.json({ success: true, message: 'Two-Factor Authentication enabled successfully', backupCodes: result.backupCodes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to enable 2FA' });
  }
};

export const disable2FA = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    const result = await authService.disable2FA((req as any).userId, code);

    if (!result.success) return res.status(400).json({ error: result.error });

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

    const result = await authService.refreshAccessToken(refreshToken);
    if (!result.success || !result.token) return res.status(401).json({ error: result.error || 'Invalid refresh token' });

    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.json({ success: true, token: result.token });
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};

export const logout = (_req: Request, res: Response) => {
  clearAuthCookies(res);
  res.json({ success: true, message: 'Logged out successfully' });
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const user = await authService.findUserById((req as any).userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    await authService.requestPasswordReset(email);
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

    await authService.resetUserPassword(token, newPassword);
    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { fullName, currentPassword, newPassword } = req.body;

    if (fullName && !validateFullName(fullName)) return res.status(400).json({ error: 'Full name must be 2-50 characters' });
    if (newPassword && !validatePasswordStrength(newPassword)) return res.status(400).json({ error: 'New password must contain uppercase, lowercase, and a number' });

    const result = await authService.updateUserProfile((req as any).userId, { fullName, currentPassword, newPassword });

    if (!result.success) {
      return res.status(result.error === 'User not found' ? 404 : 400).json({ error: result.error });
    }

    res.json({ success: true, user: result.user, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const getGoogleUrl = (_req: Request, res: Response) => {
  const url = authService.getOAuthUrl('google');
  res.json({ url });
};

export const getGithubUrl = (_req: Request, res: Response) => {
  const url = authService.getOAuthUrl('github');
  res.json({ url });
};

export const handleOAuthCallback = async (req: Request, res: Response) => {
  try {
    const { provider, code } = req.body;
    const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;

    const result = await authService.loginWithOAuth(provider, code, redirectUri);

    if (result.require2FA) {
      return res.json({ success: true, require2FA: true, tempToken: result.tempToken });
    }

    setAuthCookies(res, result.token!, result.refreshToken!, true);

    res.json({
      success: true,
      token: result.token,
      user: { id: result.user!.id, email: result.user!.email, fullName: result.user!.fullName, role: result.user!.role, isTwoFactorEnabled: result.user!.isTwoFactorEnabled }
    });
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.status(401).json({ error: error.message || 'Authentication failed' });
  }
};

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    await authService.deleteUserAccount((req as any).userId);
    clearAuthCookies(res);
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
};
