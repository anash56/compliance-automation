// src/services/emailService.ts
import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
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