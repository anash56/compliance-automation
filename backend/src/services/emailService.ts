// src/services/emailService.ts
import nodemailer from 'nodemailer';
import dns from 'dns';

// Force Node.js to prefer IPv4 over IPv6 globally for DNS resolution to fix ENETUNREACH on cloud hosts
dns.setDefaultResultOrder('ipv4first');

let transporter: nodemailer.Transporter | null = null;

if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    family: 4, // Force IPv4 to prevent IPv6 ENETUNREACH errors on cloud hosts like Render
  } as any);
  console.log('📧 Nodemailer (Gmail) service configured and ready to send emails.');
} else {
  console.warn('⚠️ Email service is not configured. Emails will be printed to the console. Please set GMAIL_USER and GMAIL_APP_PASSWORD in .env');
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  if (!transporter) {
    console.log('--- DEV EMAIL (Not Sent) ---');
    console.log(`To: ${options.to}\nSubject: ${options.subject}\n---`);
    return;
  }

  await transporter.sendMail({
    from: `"ComplianceBot" <${process.env.GMAIL_USER}>`,
    to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    subject: options.subject,
    html: options.html,
  });
};

export const isEmailConfigured = !!transporter;