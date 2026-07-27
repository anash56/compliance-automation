// src/services/authService.ts

import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../server';

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

  return { user, verificationToken };
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

export const deleteUserAccount = async (userId: string) => {
  return await prisma.user.delete({
    where: { id: userId }
  });
};
