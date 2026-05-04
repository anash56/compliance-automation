// src/routes/auth.ts

import express, { Router, Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../server';
import auth from '../middleware/auth';
// @ts-ignore
import nodemailer from 'nodemailer';

const router: Router = express.Router();

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return process.env.JWT_SECRET;
};

// Sign up
router.post('/signup', async (req: Request, res: Response) => {
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

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        fullName: fullName.trim(),
        role: 'business_owner'
      }
    });

    // Generate JWT token (for immediate login after signup)
    const token = jwt.sign(
      { userId: user.id },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user (case-insensitive email)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isPasswordValid = await bcryptjs.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Get current user
router.get('/me', auth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true
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
router.post('/forgot-password', async (req: Request, res: Response) => {
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
router.post('/reset-password', async (req: Request, res: Response) => {
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
    res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
  }
});

export default router;
