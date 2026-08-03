// src/services/authService.ts

import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
// @ts-ignore
import speakeasy from 'speakeasy';
// @ts-ignore
import qrcode from 'qrcode';
import { prisma } from '../server';
import { sendEmail, isEmailConfigured } from './emailService';
import { getSignupVerificationTemplate, getPasswordResetTemplate } from '../utils/emailTemplates';

const getJwtSecret = () => {
  return process.env.JWT_SECRET || 'fallback_development_secret_only_replace_in_production';
};

export const findUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });
};

export const findUserById = async (userId: string) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
      isTwoFactorEnabled: true
    }
  });
};

export const registerUser = async (data: { email: string; password: string; fullName: string }) => {
  const existingUser = await findUserByEmail(data.email);
  if (existingUser) {
    return { success: false, error: 'Email already registered' };
  }

  const salt = await bcryptjs.genSalt(10);
  const hashedPassword = await bcryptjs.hash(data.password, salt);
  const verificationToken = crypto.randomBytes(32).toString('hex');

  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      password: hashedPassword,
      fullName: data.fullName.trim(),
      role: 'business_owner',
      isEmailVerified: false,
      verificationToken
    }
  });

  await sendSignupVerification(user, verificationToken);

  return { success: true, user, verificationToken };
};

export const generateAuthTokens = (userId: string, rememberMe: boolean = false) => {
  const token = jwt.sign({ userId }, getJwtSecret(), { expiresIn: '15m' });
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    getJwtSecret(),
    { expiresIn: rememberMe ? '30d' : '1d' }
  );

  return { token, refreshToken };
};

export const markEmailAsVerified = async (token: string) => {
  const user: any = await (prisma.user as any).findUnique({ where: { verificationToken: token } });
  if (!user) return null;

  return await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, verificationToken: null }
  });
};

export const autoVerifyUser = async (userId: string) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { isEmailVerified: true, verificationToken: null }
  });
};

export const deleteUserAccount = async (userId: string) => {
  return await prisma.user.delete({
    where: { id: userId }
  });
};

export const setup2FA = async (userId: string) => {
  const user = await findUserById(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const secret = speakeasy.generateSecret({ name: `ComplianceBot (${user.email})` });
  await (prisma.user as any).update({
    where: { id: userId },
    data: { twoFactorSecret: secret.base32 }
  });

  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url || '');
  return { success: true, secret: secret.base32, qrCodeUrl };
};

export const verify2FACode = async (userId: string, code: string) => {
  const user: any = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.twoFactorSecret) {
    return { success: false, error: 'Invalid user or 2FA not set up' };
  }

  let verified = false;
  let usedBackupCode = false;

  if (code.length === 6 && /^\d+$/.test(code)) {
    verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code
    });
  } else if (user.twoFactorBackupCodes && user.twoFactorBackupCodes.includes(code.toLowerCase())) {
    verified = true;
    usedBackupCode = true;
  }

  if (!verified) {
    return { success: false, error: 'Invalid 2FA code or Backup code' };
  }

  if (usedBackupCode) {
    await (prisma.user as any).update({
      where: { id: user.id },
      data: {
        twoFactorBackupCodes: user.twoFactorBackupCodes.filter((c: string) => c !== code.toLowerCase())
      }
    });
  }

  return { success: true, user };
};

export const enable2FA = async (userId: string, code: string) => {
  const user: any = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.twoFactorSecret) {
    return { success: false, error: '2FA not initialized' };
  }

  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token: code
  });

  if (!verified) {
    return { success: false, error: 'Invalid verification code' };
  }

  const backupCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex'));
  await (prisma.user as any).update({
    where: { id: userId },
    data: { isTwoFactorEnabled: true, twoFactorBackupCodes: backupCodes }
  });

  return { success: true, backupCodes };
};

export const disable2FA = async (userId: string, code: string) => {
  const user: any = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.twoFactorSecret) {
    return { success: false, error: '2FA is not enabled' };
  }

  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token: code
  });

  if (!verified) {
    return { success: false, error: 'Invalid verification code' };
  }

  await (prisma.user as any).update({
    where: { id: userId },
    data: { isTwoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] }
  });

  return { success: true };
};

export const generateTemp2FAToken = (userId: string, rememberMe: boolean = false) => {
  return jwt.sign({ tempUserId: userId, rememberMe }, getJwtSecret(), { expiresIn: '5m' });
};

export const verifyTemp2FAToken = (tempToken: string) => {
  const decoded = jwt.verify(tempToken, getJwtSecret()) as any;
  if (!decoded.tempUserId) {
    throw new Error('Invalid temporary 2FA token');
  }
  return { tempUserId: decoded.tempUserId as string, rememberMe: Boolean(decoded.rememberMe) };
};

export const resetUserPassword = async (token: string, newPassword: string) => {
  const decoded = jwt.verify(token, getJwtSecret()) as any;
  if (decoded.purpose !== 'password_reset') {
    throw new Error('Invalid token type');
  }

  const salt = await bcryptjs.genSalt(10);
  const hashedPassword = await bcryptjs.hash(newPassword, salt);

  await prisma.user.update({
    where: { id: decoded.userId },
    data: { password: hashedPassword }
  });

  return true;
};

export const updateUserProfile = async (
  userId: string,
  data: { fullName?: string; currentPassword?: string; newPassword?: string }
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const updates: any = {};

  if (data.fullName) {
    updates.fullName = data.fullName.trim();
  }

  if (data.newPassword) {
    if (!data.currentPassword) {
      return { success: false, error: 'Current password is required to set a new password' };
    }
    if (!user.password) {
      return { success: false, error: 'Your account uses social login and does not have a password.' };
    }

    const isPasswordValid = await bcryptjs.compare(data.currentPassword, user.password);
    if (!isPasswordValid) {
      return { success: false, error: 'Invalid current password' };
    }

    const salt = await bcryptjs.genSalt(10);
    updates.password = await bcryptjs.hash(data.newPassword, salt);
  }

  const updatedUser = await (prisma.user as any).update({
    where: { id: userId },
    data: updates,
    select: { id: true, email: true, fullName: true, role: true, isTwoFactorEnabled: true }
  });

  return { success: true, user: updatedUser };
};

export const findOrCreateOAuthUser = async (data: {
  email: string;
  fullName: string;
  provider: string;
  providerId: string;
  isEmailVerified: boolean;
}) => {
  let user: any = await (prisma.user as any).findUnique({ where: { email: data.email } });

  if (!user) {
    user = await (prisma.user as any).create({
      data: {
        email: data.email,
        fullName: data.fullName,
        authProvider: data.provider,
        providerId: data.providerId,
        isEmailVerified: data.isEmailVerified,
        role: 'business_owner'
      }
    });
  } else if (!user.providerId) {
    user = await (prisma.user as any).update({
      where: { email: data.email },
      data: { authProvider: data.provider, providerId: data.providerId }
    });
  }

  return user;
};

export const authenticateUserCredentials = async (email: string, password: string) => {
  const user: any = await findUserByEmail(email);

  if (!user) {
    return { success: false, error: 'Invalid email or password' };
  }

  if (!user.password) {
    return { success: false, error: 'Please use the Google or GitHub login option for this account.' };
  }

  const isPasswordValid = await bcryptjs.compare(password, user.password);
  if (!isPasswordValid) {
    return { success: false, error: 'Invalid email or password' };
  }

  if (!user.isEmailVerified) {
    return { success: false, error: 'Please verify your email address before logging in.', isUnverified: true };
  }

  return { success: true, user };
};

export const generatePasswordResetToken = (userId: string) => {
  return jwt.sign(
    { userId, purpose: 'password_reset' },
    getJwtSecret(),
    { expiresIn: '15m' }
  );
};

export const verifyRefreshToken = (refreshToken: string) => {
  const decoded = jwt.verify(refreshToken, getJwtSecret()) as any;
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return decoded.userId as string;
};

export const sendSignupVerification = async (user: { id: string; email: string; fullName: string }, verificationToken: string) => {
  if (isEmailConfigured) {
    const verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?verify=${verificationToken}`;
    const emailHtml = getSignupVerificationTemplate(user.fullName, verifyLink);

    sendEmail({
      to: user.email,
      subject: 'Verify your email address',
      html: emailHtml,
    }).catch(async (emailErr: any) => {
      console.error('Background email failed. Auto-verifying user to prevent lockout:', emailErr);
      await autoVerifyUser(user.id);
    });
  } else {
    await autoVerifyUser(user.id);
  }
};

export const sendPasswordReset = async (user: { fullName: string; email: string }, resetToken: string) => {
  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?reset=${resetToken}`;

  if (!isEmailConfigured) {
    console.log('--- FORGOT PASSWORD LINK (DEV ONLY) ---');
    console.log(resetLink);
    console.log('---------------------------------------');
    return;
  }

  const emailHtml = getPasswordResetTemplate(user.fullName, resetLink);

  await sendEmail({
    to: user.email,
    subject: 'Password Reset Request',
    html: emailHtml,
  });
};

export const getOAuthUrl = (provider: 'google' | 'github') => {
  const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=email profile&state=google`;
  } else {
    const clientId = process.env.GITHUB_CLIENT_ID || '';
    return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email&state=github`;
  }
};

export const processOAuthCallback = async (provider: string, code: string, redirectUri: string) => {
  let email = '';
  let fullName = '';
  let providerId = '';
  let isEmailVerified = false;

  if (provider === 'google') {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth is not configured in .env');
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
      throw new Error('GitHub OAuth is not configured in .env');
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
    throw new Error('Unsupported provider');
  }

  return await findOrCreateOAuthUser({
    email,
    fullName,
    provider,
    providerId,
    isEmailVerified
  });
};

export const verify2FALogin = async (tempToken: string, code: string) => {
  const { tempUserId, rememberMe } = verifyTemp2FAToken(tempToken);
  const result = await verify2FACode(tempUserId, code);

  if (!result.success || !result.user) {
    return { success: false, error: result.error || 'Invalid 2FA code' };
  }

  const user = result.user;
  const { token, refreshToken } = generateAuthTokens(user.id, rememberMe);

  return { success: true, token, refreshToken, user, rememberMe };
};

export const refreshAccessToken = async (refreshToken: string) => {
  const userId = verifyRefreshToken(refreshToken);
  const user: any = await findUserById(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const { token } = generateAuthTokens(user.id);
  return { success: true, token };
};

export const requestPasswordReset = async (email: string) => {
  const user = await findUserByEmail(email);
  if (!user) {
    return { success: true };
  }

  const resetToken = generatePasswordResetToken(user.id);
  await sendPasswordReset(user, resetToken);
  return { success: true };
};

export const loginWithOAuth = async (provider: string, code: string, redirectUri: string) => {
  const user = await processOAuthCallback(provider, code, redirectUri);

  if (user.isTwoFactorEnabled) {
    const tempToken = generateTemp2FAToken(user.id, true);
    return { success: true, require2FA: true, tempToken };
  }

  const { token, refreshToken } = generateAuthTokens(user.id, true);
  return { success: true, token, refreshToken, user };
};




