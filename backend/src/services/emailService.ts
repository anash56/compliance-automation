// src/services/emailService.ts
import { BrevoClient } from '@getbrevo/brevo';
import dns from 'dns';

// Force Node.js to prefer IPv4 over IPv6 globally for DNS resolution to fix ENETUNREACH on cloud hosts
dns.setDefaultResultOrder('ipv4first');

let brevoClientInstance: BrevoClient | null = null;

if (process.env.BREVO_API_KEY && process.env.EMAIL_FROM_ADDRESS) {
  brevoClientInstance = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY,
  });
  console.log('📧 Brevo service configured and ready to send emails.');
} else {
  console.warn('⚠️ Email service is not configured. Emails will be printed to the console. Please set BREVO_API_KEY and EMAIL_FROM_ADDRESS in .env');
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  if (!brevoClientInstance || !process.env.EMAIL_FROM_ADDRESS) {
    console.log('--- DEV EMAIL (Not Sent) ---');
    console.log(`To: ${options.to}\nSubject: ${options.subject}\n---`);
    return;
  }

  const to = (Array.isArray(options.to) ? options.to : [options.to]).map(email => ({ email }));

  try {
    await brevoClientInstance.transactionalEmails.sendTransacEmail({
      sender: { name: 'ComplianceBot', email: process.env.EMAIL_FROM_ADDRESS },
      to,
      subject: options.subject,
      htmlContent: options.html,
    });
  } catch (error: any) {
    // Extract the detailed error message from Brevo's response body
    const errorMessage = error.response?.body?.message || error.message || 'An unknown error occurred';
    console.error('❌ Brevo email sending failed:', errorMessage);
    throw new Error(`Failed to send email via Brevo: ${errorMessage}`);
  }
};

export const isEmailConfigured = !!brevoClientInstance;