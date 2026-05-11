import cron from 'node-cron';
import { prisma } from '../server';

export const startComplianceCron = () => {
  // Run every day at 08:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('Running daily compliance deadline checks...');
    try {
      const today = new Date();
      const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const currentM = today.getMonth() + 1;
      const currentY = today.getFullYear();
      const prevM = currentM === 1 ? 12 : currentM - 1;
      const prevY = currentM === 1 ? currentY - 1 : currentY;

      const hasResend = !!process.env.RESEND_API_KEY;

      if (!hasResend) {
        console.log('Skipping cron emails - RESEND_API_KEY not configured');
      }

      // Fetch all companies and their GST return status for the previous month
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

        const urgentDeadlines = await (prisma as any).complianceTask.findMany({
          where: {
            companyId: company.id,
            status: { not: 'completed' },
            date: { gte: todayZero, lte: new Date(todayZero.getTime() + 3 * 24 * 60 * 60 * 1000) }
          }
        });

        // If the company has completed everything, don't email them!
        if (urgentDeadlines.length === 0) continue;

        const deadlinesHtml = urgentDeadlines.map((d: any) => `
          <li style="margin-bottom: 12px; padding: 10px; background-color: #f9fafb; border-left: 4px solid ${d.color === 'red' ? '#ef4444' : d.color === 'orange' ? '#f97316' : '#eab308'}; border-radius: 4px;">
            <strong style="font-size: 16px;">${d.desc}</strong><br/>
            <span style="color: #4b5563; font-size: 14px;">Due Date: ${d.date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span><br/>
            <span style="font-size: 12px; font-weight: bold; color: #dc2626;">URGENT</span>
          </li>
        `).join('');

        for (const member of company.members) {
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
              <h2 style="color: #dc2626; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Action Required</h2>
              <p>Hello <strong>${member.user.fullName}</strong>,</p>
                <p>You have urgent pending compliance filings for <strong>${company.companyName}</strong>:</p>
              <ul style="list-style-type: none; padding: 0;">
                ${deadlinesHtml}
              </ul>
              <br/>
              <p>Please ensure these are filed on time to avoid late fees and penalties.</p>
            </div>
          `;

          if (hasResend) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'ComplianceBot <onboarding@resend.dev>',
                to: [member.user.email],
                subject: `⚠️ Urgent Action Required: ${company.companyName}`,
                html: emailHtml
              })
            });
          }
      }
      }
    } catch (error) {
      console.error('Error running compliance cron:', error);
    }
  });
};