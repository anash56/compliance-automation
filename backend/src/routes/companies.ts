// src/routes/companies.ts

import express, { Router, Request, Response } from 'express';
import { prisma } from '../server';
import auth from '../middleware/auth';
import { authorizeMember } from '../middleware/authorize';
// @ts-ignore
import nodemailer from 'nodemailer';

const router: Router = express.Router();
const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const getFinancialYearDateRange = (year: number) => ({
  start: new Date(year, 3, 1),
  end: new Date(year + 1, 3, 1)
});

const getFinancialYearMonths = (year: number) => {
  const months = [];

  for (let month = 4; month <= 12; month += 1) {
    months.push({ month, year });
  }

  for (let month = 1; month <= 3; month += 1) {
    months.push({ month, year: year + 1 });
  }

  return months;
};

// Create company
router.post('/', auth, async (req: Request, res: Response) => {
  try {
    const { gstNumber, companyName, state, pan, employeesCount, businessType } = req.body;
    const normalizedGstNumber = gstNumber ? String(gstNumber).trim().toUpperCase() : null;
    const normalizedPan = pan ? String(pan).trim().toUpperCase() : null;
    const normalizedCompanyName = String(companyName || '').trim();
    const normalizedState = String(state || '').trim();

    if (!normalizedCompanyName || !normalizedState) {
      return res.status(400).json({ error: 'Company name and state are required' });
    }

    if (normalizedGstNumber && !gstPattern.test(normalizedGstNumber)) {
      return res.status(400).json({ error: 'Invalid GST number format' });
    }

    if (normalizedPan && !panPattern.test(normalizedPan)) {
      return res.status(400).json({ error: 'Invalid PAN format' });
    }

    const company = await prisma.$transaction(async (tx) => {
      const newCompany = await tx.company.create({
        data: {
          userId: req.userId!, // The original creator
          gstNumber: normalizedGstNumber,
          companyName: normalizedCompanyName,
          state: normalizedState,
          pan: normalizedPan,
          employeesCount,
          businessType,
        },
      });

      await tx.companyMember.create({
        data: {
          companyId: newCompany.id,
          userId: req.userId!,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });
      return newCompany;
    });

    res.status(201).json({
      success: true,
      company
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'GST number already exists' });
    }
    console.error('Create company error:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// Get all companies for user
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const companies = await prisma.company.findMany({
      where: {
        members: {
          some: { userId: req.userId, status: 'ACTIVE' },
        },
      },
      include: {
        members: {
          where: { userId: req.userId },
          select: { role: true }
        },
        _count: {
          select: {
            invoices: true,
            gstReturns: true,
            tdsRecords: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedCompanies = companies.map(({ members, ...company }) => ({
      ...company,
      userRole: members[0]?.role || 'VIEWER'
    }));

    res.json({
      success: true,
      companies: formattedCompanies
    });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get company dashboard stats for one financial year
router.get('/:id/dashboard', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const year = Number(req.query.year) || new Date().getFullYear();

    if (!Number.isInteger(year) || year < 1990 || year > 2100) {
      return res.status(400).json({ error: 'Year must be between 1990 and 2100' });
    }

    const financialYearRange = getFinancialYearDateRange(year);
    const financialYearMonths = getFinancialYearMonths(year);

    const companyInfo = await prisma.company.findUnique({
      where: { id },
      select: { gstNumber: true }
    });
    const hasGst = !!companyInfo?.gstNumber;

    const [invoices, tdsRecords, gstReturns, tdsReturns] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          companyId: id,
          invoiceDate: {
            gte: financialYearRange.start,
            lt: financialYearRange.end
          }
        },
        select: {
          amount: true,
          totalTax: true,
          invoiceDate: true
        }
      }),
      prisma.tDSRecord.findMany({
        where: {
          companyId: id,
          year
        },
        select: {
          paymentAmount: true,
          tdsDeducted: true,
          paymentMade: true,
          paymentDate: true
        }
      }),
      prisma.gSTReturn.findMany({
        where: {
          companyId: id,
          OR: financialYearMonths
        },
        select: {
          gstr1Status: true,
          gstr3bStatus: true,
          gstr1FiledDate: true,
          gstr3bFiledDate: true,
          month: true,
          year: true
        }
      }),
      prisma.tDSReturn.findMany({
        where: {
          companyId: id,
          year
        },
        select: {
          filingStatus: true,
          totalTdsDeposited: true,
          quarter: true,
          year: true
        }
      })
    ]);

    const totalInvoiceValue = invoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    const totalGstCollected = invoices.reduce((sum, invoice) => sum + Number(invoice.totalTax), 0);
    const totalVendorPayments = tdsRecords.reduce((sum, record) => sum + Number(record.paymentAmount), 0);
    const totalTdsDeducted = tdsRecords.reduce((sum, record) => sum + Number(record.tdsDeducted), 0);
    const totalTdsDeposited = tdsReturns.reduce((sum, tdsReturn) => sum + Number(tdsReturn.totalTdsDeposited), 0);

    const monthlyData = financialYearMonths.map(({ month, year }) => {
      const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'short' });
      const mInvoices = invoices.filter(inv => inv.invoiceDate.getMonth() + 1 === month && inv.invoiceDate.getFullYear() === year);
      const mTds = tdsRecords.filter(tds => tds.paymentDate.getMonth() + 1 === month && tds.paymentDate.getFullYear() === year);
      return {
        name: monthName,
        revenue: Math.round(mInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0)),
        tax: Math.round(mInvoices.reduce((sum, inv) => sum + Number(inv.totalTax), 0)),
        tds: Math.round(mTds.reduce((sum, tds) => sum + Number(tds.tdsDeducted), 0))
      };
    });

    const gstReturnsFiled = gstReturns.reduce((count, gstReturn) => {
      return count +
        (gstReturn.gstr1Status === 'submitted' || gstReturn.gstr1FiledDate ? 1 : 0) +
        (gstReturn.gstr3bStatus === 'submitted' || gstReturn.gstr3bFiledDate ? 1 : 0);
    }, 0);
    const tdsReturnsFiled = tdsReturns.filter((tdsReturn) => tdsReturn.filingStatus === 'submitted').length;

    let auditLogs = [];
    try {
      if ((prisma as any).auditLog) {
        auditLogs = await (prisma as any).auditLog.findMany({
          where: { companyId: id },
          include: { user: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10
        });
      }
    } catch (e) {
      console.warn('AuditLog table missing or query failed - skipping');
    }

    // Fetch Compliance Tasks from the Database
    let upcomingDeadlines: any[] = [];
    try {
      if ((prisma as any).complianceTask) {
        upcomingDeadlines = await (prisma as any).complianceTask.findMany({
          where: { companyId: id },
          orderBy: { date: 'asc' }
        });
      }
    } catch (e) {
      console.warn('ComplianceTask table missing or query failed - skipping');
    }

    // Auto-heal / Backfill Tasks for existing data if none exist yet
    const hasSystemTasks = upcomingDeadlines.some((t: any) => t.type !== 'Custom Task');
    if (!hasSystemTasks && (invoices.length > 0 || tdsRecords.length > 0)) {
      const newTasks: any[] = [];
      const now = new Date();
      
      const invoiceMonths = new Set<string>();
      invoices.forEach((inv) => {
        const d = new Date(inv.invoiceDate);
        invoiceMonths.add(`${d.getMonth() + 1}-${d.getFullYear()}`);
      });
      if (hasGst) {
        const prevM = now.getMonth() === 0 ? 12 : now.getMonth();
        const prevY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        invoiceMonths.add(`${prevM}-${prevY}`);
      }

      invoiceMonths.forEach(my => {
        const [mStr, yStr] = my.split('-');
        const m = parseInt(mStr);
        const y = parseInt(yStr);
        const gstReturn = gstReturns.find((r) => r.month === m && r.year === y);
        const gstr1Filed = gstReturn?.gstr1Status === 'submitted' || gstReturn?.gstr1FiledDate;
        const gstr3bFiled = gstReturn?.gstr3bStatus === 'submitted' || gstReturn?.gstr3bFiledDate;
        const nextM = m === 12 ? 1 : m + 1;
        const nextY = m === 12 ? y + 1 : y;
        const monthName = new Date(y, m - 1).toLocaleString('default', { month: 'short' });

        newTasks.push({ companyId: id, type: 'GST Filing', desc: `GSTR-1 (${monthName} ${y})`, date: new Date(nextY, nextM - 1, 11), color: 'orange', status: gstr1Filed ? 'completed' : 'pending', month: m, year: y });
        newTasks.push({ companyId: id, type: 'GST Payment', desc: `GSTR-3B (${monthName} ${y})`, date: new Date(nextY, nextM - 1, 20), color: 'yellow', status: gstr3bFiled ? 'completed' : 'pending', month: m, year: y });
      });

      const tdsQuarters = new Set<string>();
      tdsRecords.forEach((tds) => {
        const d = new Date(tds.paymentDate);
        const m = d.getMonth() + 1;
        const q = m >= 4 && m <= 6 ? 1 : m >= 7 && m <= 9 ? 2 : m >= 10 && m <= 12 ? 3 : 4;
        const fY = m >= 4 ? d.getFullYear() : d.getFullYear() - 1;
        tdsQuarters.add(`${q}-${fY}`);
      });

      tdsQuarters.forEach(qy => {
        const [qStr, yStr] = qy.split('-');
        const q = parseInt(qStr);
        const fY = parseInt(yStr);
        const tdsReturn = tdsReturns.find((r) => r.quarter === q && r.year === fY);
        const isFiled = tdsReturn?.filingStatus === 'submitted';

        let dueDate;
        if (q === 1) dueDate = new Date(fY, 6, 31);
        else if (q === 2) dueDate = new Date(fY, 9, 31);
        else if (q === 3) dueDate = new Date(fY + 1, 0, 31);
        else if (q === 4) dueDate = new Date(fY + 1, 4, 31);

        if (dueDate) {
          newTasks.push({ companyId: id, type: 'TDS Return', desc: `Form 26Q (Q${q} FY${fY}-${String(fY + 1).slice(2)})`, date: dueDate, color: 'purple', status: isFiled ? 'completed' : 'pending', quarter: q, year: fY });
        }
      });

      const tdsMonths = new Set<string>();
      tdsRecords.forEach((tds) => {
        const d = new Date(tds.paymentDate);
        tdsMonths.add(`${d.getMonth() + 1}-${d.getFullYear()}`);
      });

      tdsMonths.forEach(my => {
        const [mStr, yStr] = my.split('-');
        const m = parseInt(mStr);
        const y = parseInt(yStr);
        const nextM = m === 12 ? 1 : m + 1;
        const nextY = m === 12 ? y + 1 : y;
        const q = m >= 4 && m <= 6 ? 1 : m >= 7 && m <= 9 ? 2 : m >= 10 && m <= 12 ? 3 : 4;
        const fY = m >= 4 ? y : y - 1;
        const tdsReturn = tdsReturns.find((r) => r.quarter === q && r.year === fY);
        const isQuarterFiled = tdsReturn?.filingStatus === 'submitted';

        newTasks.push({ companyId: id, type: 'TDS Payment', desc: `TDS Payment (${new Date(y, m - 1).toLocaleString('default', { month: 'short' })} ${y})`, date: new Date(nextY, nextM - 1, 7), color: 'red', status: isQuarterFiled ? 'completed' : 'pending', month: m, year: y });
      });

      if (newTasks.length > 0) {
        try {
          if ((prisma as any).complianceTask) {
            await (prisma as any).complianceTask.createMany({ data: newTasks });
            upcomingDeadlines = await (prisma as any).complianceTask.findMany({
              where: { companyId: id },
              orderBy: { date: 'asc' }
            });
          } else {
            upcomingDeadlines = [...upcomingDeadlines, ...newTasks];
          }
        } catch (e) {
          upcomingDeadlines = [...upcomingDeadlines, ...newTasks];
        }
      }
    }

    res.json({
      success: true,
      financialYear: year,
      stats: {
        gstInvoiceCount: invoices.length,
        tdsRecordCount: tdsRecords.length,
        gstReturnsFiled,
        tdsReturnsFiled,
        totalInvoiceValue: Math.round(totalInvoiceValue * 100) / 100,
        totalGstCollected: Math.round(totalGstCollected * 100) / 100,
        totalVendorPayments: Math.round(totalVendorPayments * 100) / 100,
        totalTdsDeducted: Math.round(totalTdsDeducted * 100) / 100,
        totalTdsDeposited: Math.round(totalTdsDeposited * 100) / 100,
        estimatedComplianceOutflow: Math.round((totalGstCollected + totalTdsDeposited) * 100) / 100,
        upcomingDeadlines,
        monthlyData,
        auditLogs
      }
    });
  } catch (error) {
    console.error('Get company dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch company dashboard' });
  }
});

// Get portfolio dashboard stats across all companies
router.get('/stats/dashboard', auth, async (req: Request, res: Response) => {
  try {
    // Get current month/year
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const nextMonthStart = new Date(currentYear, currentMonth, 1);
    const financialYear = currentMonth >= 4 ? currentYear : currentYear - 1;

    const memberOfCompanyIds = (
      await prisma.companyMember.findMany({
        where: { userId: req.userId, status: 'ACTIVE' },
        select: { companyId: true },
      })
    ).map((m) => m.companyId);

    if (memberOfCompanyIds.length === 0) {
      return res.json({ success: true, stats: { gstInvoiceCount: 0, tdsRecordCount: 0, gstReturnsFiled: 0, tdsReturnsFiled: 0, totalTaxPayable: '0.00', daysToFiling: 0 } });
    }

    const [gstInvoiceCount, tdsRecordCount, invoices] = await Promise.all([
      prisma.invoice.count({
        where: {
          companyId: { in: memberOfCompanyIds },
          invoiceDate: {
            gte: new Date(currentYear, 0, 1),
            lt: new Date(currentYear + 1, 0, 1)
          }
        }
      }),
      prisma.tDSRecord.count({
        where: {
          companyId: { in: memberOfCompanyIds },
          year: financialYear
        }
      }),
      prisma.invoice.findMany({
        where: {
          companyId: { in: memberOfCompanyIds },
          invoiceDate: {
            gte: currentMonthStart,
            lt: nextMonthStart
          }
        },
        select: {
          totalTax: true
        }
      })
    ]);

    const gstReturns = await prisma.gSTReturn.findMany({
      where: {
        companyId: { in: memberOfCompanyIds },
        year: currentYear
      },
      select: {
        gstr1Status: true,
        gstr3bStatus: true,
        gstr1FiledDate: true,
        gstr3bFiledDate: true
      }
    });

    const gstFiledCount = gstReturns.reduce((count, gstReturn) => {
      return count +
        (gstReturn.gstr1Status === 'submitted' || gstReturn.gstr1FiledDate ? 1 : 0) +
        (gstReturn.gstr3bStatus === 'submitted' || gstReturn.gstr3bFiledDate ? 1 : 0);
    }, 0);

    const tdsFiledCount = await prisma.tDSReturn.count({
      where: {
        companyId: { in: memberOfCompanyIds },
        year: financialYear,
        filingStatus: 'submitted'
      }
    });

    const totalTaxPayable = invoices.reduce((sum, inv) => {
      return sum + Number(inv.totalTax);
    }, 0);

    const dueDate = new Date(currentYear, currentMonth, 20);
    const daysToFiling = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    res.json({
      success: true,
      stats: {
        gstFiled: gstInvoiceCount,
        tdsFiled: tdsRecordCount,
        gstInvoiceCount,
        tdsRecordCount,
        gstReturnsFiled: gstFiledCount,
        tdsReturnsFiled: tdsFiledCount,
        totalTaxPayable: totalTaxPayable.toFixed(2),
        daysToFiling: Math.max(daysToFiling, 0)
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

router.get('/:id', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), async (req: Request, res: Response) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          where: { userId: req.userId },
          select: { role: true }
        },
        _count: {
          select: {
            invoices: true,
            gstReturns: true,
            tdsRecords: true
          }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const { members, ...companyData } = company;
    res.json({
      success: true,
      company: { ...companyData, userRole: members[0]?.role || 'VIEWER' }
    });
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Get paginated invoices for a company
router.get('/:id/invoices/paginated', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';

    const skip = (page - 1) * limit;

    const whereClause: any = { companyId: id };
    if (search) {
      whereClause.OR = [
        { vendorName: { contains: search, mode: 'insensitive' } },
        { invoiceNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { invoiceDate: 'desc' }
      }),
      prisma.invoice.count({ where: whereClause })
    ]);

    res.json({ success: true, invoices, total, totalPages: Math.ceil(total / limit), currentPage: page });
  } catch (error) {
    console.error('Paginated invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Update compliance task status
router.put('/:id/tasks/:taskId/status', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR']), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    let task = null;
    if ((prisma as any).complianceTask) {
      task = await (prisma as any).complianceTask.update({
        where: { id: req.params.taskId },
        data: { status }
      });
    }
    res.json({ success: true, task });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

// Create a custom compliance task
router.post('/:id/tasks', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR']), async (req: Request, res: Response) => {
  try {
    const { desc, date, color, type } = req.body;
    const task = await (prisma as any).complianceTask.create({
      data: {
        companyId: req.params.id,
        type: type || 'Custom Task',
        desc,
        date: new Date(date),
        color: color || 'blue',
        status: 'pending'
      }
    });
    res.json({ success: true, task });
  } catch (error) {
    console.error('Create custom task error:', error);
    res.status(500).json({ error: 'Failed to create custom task' });
  }
});

// Update company
router.put('/:id', auth, authorizeMember(['OWNER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { gstNumber, companyName, state, pan, employeesCount, businessType } = req.body;
    const normalizedGstNumber = gstNumber ? String(gstNumber).trim().toUpperCase() : null;
    const normalizedPan = pan ? String(pan).trim().toUpperCase() : null;
    const normalizedCompanyName = String(companyName || '').trim();
    const normalizedState = String(state || '').trim();

    if (!normalizedCompanyName || !normalizedState) {
      return res.status(400).json({ error: 'Company name and state are required' });
    }

    if (normalizedGstNumber && !gstPattern.test(normalizedGstNumber)) {
      return res.status(400).json({ error: 'Invalid GST number format' });
    }

    if (normalizedPan && !panPattern.test(normalizedPan)) {
      return res.status(400).json({ error: 'Invalid PAN format' });
    }

    const updatedCompany = await prisma.company.update({
      where: { id: req.params.id },
      data: {
        gstNumber: normalizedGstNumber,
        companyName: normalizedCompanyName,
        state: normalizedState,
        pan: normalizedPan,
        employeesCount,
        businessType
      }
    });

    res.json({
      success: true,
      company: updatedCompany
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'GST number already exists' });
    }
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// Delete company
router.delete('/:id', auth, authorizeMember(['OWNER']), async (req: Request, res: Response) => {
  try {
    await prisma.company.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true, message: 'Workspace deleted successfully' });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

// Send email reminders
router.post('/:id/reminders', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), async (req: Request, res: Response) => {
  try {
    const { deadlines } = req.body;
    
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const company = await prisma.company.findUnique({ where: { id: req.params.id } });

    if (!user || !company) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    let smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER as string,
        pass: process.env.SMTP_PASS as string,
      },
    };

    if (!smtpConfig.auth.user) {
      const testAccount = await nodemailer.createTestAccount();
      smtpConfig.auth = { user: testAccount.user, pass: testAccount.pass };
    }

    const transporter = nodemailer.createTransport(smtpConfig);

    const deadlinesHtml = deadlines.map((d: any) => `
      <li style="margin-bottom: 12px; padding: 10px; background-color: #f9fafb; border-left: 4px solid ${d.color === 'red' ? '#ef4444' : d.color === 'orange' ? '#f97316' : '#eab308'}; border-radius: 4px;">
        <strong style="font-size: 16px;">${d.desc}</strong><br/>
        <span style="color: #4b5563; font-size: 14px;">Due Date: ${new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span><br/>
        <span style="font-size: 12px; font-weight: bold; color: ${d.status === 'completed' ? '#16a34a' : '#dc2626'};">${d.status ? d.status.toUpperCase() : 'PENDING'}</span>
      </li>
    `).join('');

    const info = await transporter.sendMail({
      from: `"ComplianceBot" <${process.env.SMTP_USER || 'noreply@compliancebot.com'}>`,
      to: user.email,
      subject: `📅 Upcoming Deadlines: ${company.companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Compliance Deadlines</h2>
          <p>Hello <strong>${user.fullName}</strong>,</p>
          <p>Here is your requested compliance schedule for <strong>${company.companyName}</strong>:</p>
          <ul style="list-style-type: none; padding: 0;">
            ${deadlinesHtml}
          </ul>
          <br/>
          <p>Please ensure these are filed on time to avoid late fees and penalties.</p>
          <br/>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Dashboard</a>
        </div>
      `
    });

    if (!process.env.SMTP_USER) {
      console.log('Email preview URL: %s', nodemailer.getTestMessageUrl(info));
    }

    res.json({ success: true, message: 'Reminders sent via email' });
  } catch (error) {
    console.error('Email reminders error:', error);
    res.status(500).json({ error: 'Failed to send reminders' });
  }
});

// --- TEAM MANAGEMENT ROUTES ---

// Get all members of a company
router.get('/:id/members', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), async (req: Request, res: Response) => {
  try {
    const members = await prisma.companyMember.findMany({
      where: { companyId: req.params.id },
      include: {
        user: {
          select: { id: true, fullName: true, email: true }
        }
      }
    });
    res.json({ success: true, members });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Add a team member
router.post('/:id/members', auth, authorizeMember(['OWNER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { email, role } = req.body;
    
    const targetUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found. They must create an account first.' });
    }

    const company = await prisma.company.findUnique({ where: { id: req.params.id } });

    const existingMember = await prisma.companyMember.findUnique({
      where: { userId_companyId: { userId: targetUser.id, companyId: req.params.id } }
    });
    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this workspace.' });
    }

    const newMember = await prisma.companyMember.create({
      data: { userId: targetUser.id, companyId: req.params.id, role: role || 'VIEWER', status: 'ACTIVE' }
    });

    // --- Send Real Email Notification ---
    let smtpConfigInvite = {
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER as string,
        pass: process.env.SMTP_PASS as string,
      },
    };

    if (!smtpConfigInvite.auth.user) {
      const testAccount = await nodemailer.createTestAccount();
      smtpConfigInvite.auth = { user: testAccount.user, pass: testAccount.pass };
    }

    const transporter = nodemailer.createTransport(smtpConfigInvite);

    try {
      const info = await transporter.sendMail({
        from: `"ComplianceBot" <${process.env.SMTP_USER || 'noreply@compliancebot.com'}>`,
        to: targetUser.email,
        subject: `Invitation: Join ${company?.companyName} on ComplianceBot`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #2563eb;">Welcome to the Team!</h2>
            <p>Hello <strong>${targetUser.fullName}</strong>,</p>
            <p>You have been invited to join the workspace <strong>${company?.companyName}</strong> on ComplianceBot with the role of <strong>${role || 'VIEWER'}</strong>.</p>
            <p>You can now collaborate on GST filings, TDS payments, and compliance reports.</p>
            <br/>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Go to Dashboard</a>
          </div>
        `
      });
      if (!process.env.SMTP_USER) {
        console.log('Invite Email preview URL: %s', nodemailer.getTestMessageUrl(info));
      }
    } catch (emailError) {
      console.error('Email sending failed (Check SMTP settings in .env):', emailError);
    }

    res.json({ success: true, member: newMember, message: 'Team member added and email sent.' });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// Remove a team member
router.delete('/:id/members/:userId', auth, authorizeMember(['OWNER']), async (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params;

    if (userId === req.userId) {
      return res.status(400).json({ error: 'You cannot remove yourself. Use the delete workspace option instead.' });
    }

    await prisma.companyMember.delete({ where: { userId_companyId: { userId, companyId: id } } });
    res.json({ success: true, message: 'Team member removed.' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

export default router;
