// src/utils/emailTemplates.ts

interface BaseLayoutOptions {
  title: string;
  preheader?: string;
  contentHtml: string;
  badge?: {
    text: string;
    bgColor?: string;
    textColor?: string;
  };
}

export const getBaseEmailLayout = ({ title, preheader, contentHtml, badge }: BaseLayoutOptions): string => {
  const badgeHtml = badge
    ? `<span style="display: inline-block; background-color: ${badge.bgColor || '#eff6ff'}; color: ${badge.textColor || '#2563eb'}; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">${badge.text}</span>`
    : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      ${preheader ? `<meta name="description" content="${preheader}">` : ''}
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0;">
              <!-- Header -->
              <tr>
                <td style="background-color: #0f172a; padding: 24px 32px; text-align: left;">
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td>
                        <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.025em; text-decoration: none;">
                          Compliance<span style="color: #3b82f6;">Bot</span>
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Content Body -->
              <tr>
                <td style="padding: 32px;">
                  ${badgeHtml}
                  <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.3;">${title}</h1>
                  <div style="font-size: 15px; line-height: 1.6; color: #334155;">
                    ${contentHtml}
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #64748b;">
                  <p style="margin: 0 0 6px 0;">This email was sent automatically by <strong>ComplianceBot SaaS</strong>.</p>
                  <p style="margin: 0;">© ${new Date().getFullYear()} ComplianceBot. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

export const getSignupVerificationTemplate = (fullName: string, verifyLink: string): string => {
  return getBaseEmailLayout({
    title: 'Verify Your Email Address',
    preheader: 'Welcome to ComplianceBot! Please confirm your email.',
    badge: { text: 'Account Setup', bgColor: '#eff6ff', textColor: '#2563eb' },
    contentHtml: `
      <p style="margin-top: 0;">Hi <strong>${fullName}</strong>,</p>
      <p>Thank you for signing up for ComplianceBot. Please verify your email address to activate your account and start managing your GST and TDS compliances effortlessly.</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${verifyLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 15px; padding: 12px 28px; text-decoration: none; border-radius: 6px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">Verify Email Address</a>
      </div>
      <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">If you didn't create a ComplianceBot account, you can safely ignore this email.</p>
    `
  });
};

export const getPasswordResetTemplate = (fullName: string, resetLink: string): string => {
  return getBaseEmailLayout({
    title: 'Password Reset Request',
    preheader: 'Reset your password securely.',
    badge: { text: 'Security', bgColor: '#fef3c7', textColor: '#d97706' },
    contentHtml: `
      <p style="margin-top: 0;">Hello <strong>${fullName}</strong>,</p>
      <p>We received a request to reset your password. Click the button below to set a new password. This secure link is valid for 15 minutes.</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${resetLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 15px; padding: 12px 28px; text-decoration: none; border-radius: 6px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">Reset Password</a>
      </div>
      <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">If you did not request a password reset, please ignore this email or contact support if you suspect unauthorized activity.</p>
    `
  });
};

export const getWorkspaceInvitationTemplate = (fullName: string, companyName: string, role: string): string => {
  return getBaseEmailLayout({
    title: `You've Been Invited to Join ${companyName}`,
    preheader: `Join ${companyName} on ComplianceBot as a ${role}.`,
    badge: { text: 'Workspace Invite', bgColor: '#f0fdf4', textColor: '#16a34a' },
    contentHtml: `
      <p style="margin-top: 0;">Hello <strong>${fullName}</strong>,</p>
      <p>You have been invited to join the workspace <strong>${companyName}</strong> on ComplianceBot with the role of <strong style="color: #2563eb;">${role || 'VIEWER'}</strong>.</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 15px; padding: 12px 28px; text-decoration: none; border-radius: 6px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">Go to Dashboard</a>
      </div>
      <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">Log in with your email to access your workspace and collaborate with your team.</p>
    `
  });
};

export const getComplianceReminderTemplate = (
  fullName: string,
  companyName: string,
  subjectHeader: string,
  deadlinesHtml: string
): string => {
  return getBaseEmailLayout({
    title: `${subjectHeader}: ${companyName}`,
    preheader: `Pending GST/TDS tax compliance deadlines for ${companyName}`,
    badge: { text: 'Compliance Due', bgColor: '#fef2f2', textColor: '#dc2626' },
    contentHtml: `
      <p style="margin-top: 0;">Hello <strong>${fullName}</strong>,</p>
      <p>You have urgent pending compliance filings for <strong>${companyName}</strong>:</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <ul style="margin: 0; padding-left: 20px; color: #334155;">
          ${deadlinesHtml}
        </ul>
      </div>
      <p style="font-size: 14px; color: #dc2626; font-weight: 600; margin-bottom: 0;">Please ensure these are filed immediately to prevent late interest fees and government penalties.</p>
    `
  });
};
