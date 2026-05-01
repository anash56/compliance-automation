// src/routes/companies.ts

import express, { Router, Request, Response } from 'express';
import { prisma } from '../server';
import auth from '../middleware/auth';

const router: Router = express.Router();

// Create company
router.post('/', auth, async (req: Request, res: Response) => {
  try {
    const { gstNumber, companyName, state, pan, employeesCount, businessType } = req.body;

    if (!companyName || !state) {
      return res.status(400).json({ error: 'Company name and state are required' });
    }

    const company = await prisma.company.create({
      data: {
        userId: req.userId!,
        gstNumber,
        companyName,
        state,
        pan,
        employeesCount,
        businessType
      }
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
      where: { userId: req.userId },
      include: {
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

    res.json({
      success: true,
      companies
    });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get single company
router.get('/:id', auth, async (req: Request, res: Response) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
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

    if (company.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      success: true,
      company
    });
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Update company
router.put('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { gstNumber, companyName, state, pan, employeesCount, businessType } = req.body;

    const company = await prisma.company.findUnique({
      where: { id: req.params.id }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (company.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updatedCompany = await prisma.company.update({
      where: { id: req.params.id },
      data: {
        gstNumber,
        companyName,
        state,
        pan,
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

// Get dashboard stats
router.get('/stats/dashboard', auth, async (req: Request, res: Response) => {
  try {
    // Get current month/year
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Count GST returns filed this year
    const gstFiledCount = await prisma.gSTReturn.count({
      where: {
        company: { userId: req.userId },
        year: currentYear,
        OR: [
          { gstr1Status: 'submitted' },
          { gstr3bStatus: 'submitted' }
        ]
      }
    });

    // Count TDS returns filed this year
    const tdsFiledCount = await prisma.tDSReturn.count({
      where: {
        company: { userId: req.userId },
        year: currentYear,
        filingStatus: 'submitted'
      }
    });

    // Get total tax payable for current month
    const invoices = await prisma.invoice.findMany({
      where: {
        company: { userId: req.userId },
        invoiceDate: {
          gte: new Date(currentYear, currentMonth - 1, 1),
          lt: new Date(currentYear, currentMonth, 1)
        }
      }
    });

    const totalTaxPayable = invoices.reduce((sum, inv) => {
      return sum + Number(inv.totalTax);
    }, 0);

    // Calculate days to GST filing (usually 20th of next month)
    const dueDate = new Date(currentYear, currentMonth, 20);
    const daysToFiling = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    res.json({
      success: true,
      stats: {
        gstFiled: gstFiledCount,
        tdsFiled: tdsFiledCount,
        totalTaxPayable: totalTaxPayable.toFixed(2),
        daysToFiling: Math.max(daysToFiling, 0)
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

export default router;
