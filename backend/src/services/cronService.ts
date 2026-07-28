// src/services/cronService.ts

import cron from 'node-cron';
import { prisma } from '../server';
import { sendEmail, isEmailConfigured } from './emailService';

export const startComplianceCron = () => {
  // Run every day at 08:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('Running daily compliance deadline checks...');
    try {
      const today = new Date();
      const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      if (!isEmailConfigured) {
        console.log('Skipping cron emails - Email service not configured in .env');
      }

      const companies = await prisma.company.findMany({
        include: {
          members: {
            where: { role: { in: ['OWNER', 'ADMIN'] }, status: 'ACTIVE' },
            include: { user: true }
          }
        }
      });

      for (const company of companies) {
        if (company.members.length === 0) continue;

        // Fetch all pending tasks due today, in the next 3 days, OR overdue
        const urgentDeadlines = await (prisma as any).complianceTask.findMany({
          where: {
            companyId: company.id,
            status: { not: 'completed' },
            date: { lte: new Date(todayZero.getTime() + 3 * 24 * 60 * 60 * 1000) }
          }
        });

        if (urgentDeadlines.length === 0) continue;

        const deadlinesHtml = urgentDeadlines.map((d: any) => {
          const taskDate = new Date(d.date);
          const isOverdue = taskDate < todayZero;
          const badgeText = isOverdue ? 'OVERDUE - LATE FEES APPLY' : 'URGENT';
          const badgeColor = isOverdue ? '#dc2626' : (d.color === 'red' ? '#ef4444' : '#f97316');

          return `
            <li style="margin-bottom: 12px; padding: 10px; background-color: #f9fafb; border-left: 4px solid ${badgeColor}; border-radius: 4px;">
              <strong style="font-size: 16px;">${d.desc}</strong><br/>
              <span style="color: #4b5563; font-size: 14px;">Due Date: ${taskDate.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span><br/>
              <span style="font-size: 12px; font-weight: bold; color: ${badgeColor};">${badgeText}</span>
            </li>
          `;
        }).join('');

        for (const member of company.members) {
          const hasOverdue = urgentDeadlines.some((d: any) => new Date(d.date) < todayZero);
          const subjectHeader = hasOverdue ? '🚨 OVERDUE COMPLIANCE WARNING' : '⚠️ Urgent Action Required';

          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
              <h2 style="color: #dc2626; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">${subjectHeader}</h2>
              <p>Hello <strong>${member.user.fullName}</strong>,</p>
              <p>You have urgent pending compliance filings for <strong>${company.companyName}</strong>:</p>
              <ul style="list-style-type: none; padding: 0;">
                ${deadlinesHtml}
              </ul>
              <br/>
              <p>Please ensure these are filed immediately to stop incurring late interest & government penalties.</p>
            </div>
          `;

          if (isEmailConfigured) {
            await sendEmail({
              to: member.user.email,
              subject: `${subjectHeader}: ${company.companyName}`,
              html: emailHtml,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error running compliance cron:', error);
    }
  });
};
