// src/services/emailService.ts
import axios, { isAxiosError } from 'axios';
import dns from 'dns';

// Force Node.js to prefer IPv4 over IPv6 globally for DNS resolution to fix ENETUNREACH on cloud hosts
dns.setDefaultResultOrder('ipv4first');

const SENDPULSE_API_URL = 'https://api.sendpulse.com';
let sendpulseToken: string | null = null;
let tokenExpiry: number | null = null;

if (process.env.SENDPULSE_API_ID && process.env.SENDPULSE_API_SECRET && process.env.EMAIL_FROM_ADDRESS) {
  console.log('📧 SendPulse service configured and ready to send emails.');
} else {
  console.warn('⚠️ Email service is not configured. Emails will be printed to the console. Please set SENDPULSE_API_ID, SENDPULSE_API_SECRET, and EMAIL_FROM_ADDRESS in .env');
}

/**
 * Gets a valid SendPulse API token, refreshing if necessary.
 */
async function getSendPulseToken(): Promise<string | null> {
  if (sendpulseToken && tokenExpiry && Date.now() < tokenExpiry) {
    return sendpulseToken;
  }

  if (!process.env.SENDPULSE_API_ID || !process.env.SENDPULSE_API_SECRET) {
    return null;
  }

  try {
    const response = await axios.post(`${SENDPULSE_API_URL}/oauth/access_token`, {
      grant_type: 'client_credentials',
      client_id: process.env.SENDPULSE_API_ID,
      client_secret: process.env.SENDPULSE_API_SECRET,
    });

    sendpulseToken = response.data.access_token;
    // Token expires in 1 hour (3600s), refresh it after 55 minutes.
    tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;
    return sendpulseToken;
  } catch (error) {
    if (isAxiosError(error)) {
      console.error('❌ Could not get SendPulse token:', error.response?.data || error.message);
    } else {
      console.error('❌ Could not get SendPulse token:', error);
    }
    return null;
  }
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  const token = await getSendPulseToken();

  if (!token) {
    console.error('❌ Email not sent because getting a SendPulse token failed. Check credentials.');
    throw new Error('Could not get email service token. Please check API credentials.');
  }

  const emailPayload = {
    email: {
      html: options.html,
      text: 'Please view this email in an HTML-compatible client.', // Basic text fallback
      subject: options.subject,
      from: {
        name: 'ComplianceBot',
        email: process.env.EMAIL_FROM_ADDRESS,
      },
      to: (Array.isArray(options.to) ? options.to : [options.to]).map(email => ({ email })),
    },
  };

  try {
    await axios.post(`${SENDPULSE_API_URL}/smtp/emails`, emailPayload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    if (isAxiosError(error)) {
      console.error('❌ SendPulse email sending failed:', error.response?.data || error.message);
    } else {
      console.error('❌ SendPulse email sending failed:', error);
    }
    throw new Error('Failed to send email via SendPulse.');
  }
};

export const isEmailConfigured = !!(process.env.SENDPULSE_API_ID && process.env.SENDPULSE_API_SECRET);