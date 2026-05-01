// src/routes/tds.ts

import express, { Router, Request, Response } from 'express';
import auth from '../middleware/auth';
import tdsService, { TDS_RATES } from '../services/tdsService';
import { prisma } from '../server';

const router: Router = express.Router();

// Helper to verify company ownership
const verifyCompanyOwnership = async (companyId: string, userId: string) => {
  const company = await prisma.company.findUnique({
    where: { id: companyId }
  });

  if (!company || company.userId !== userId) {
    return false;
  }
  return true;
};

const getFinancialQuarter = (date: Date) => {
  const month = date.getMonth() + 1;

  if (month >= 4 && month <= 6) return 1;
  if (month >= 7 && month <= 9) return 2;
  if (month >= 10 && month <= 12) return 3;
  return 4;
};

// Create TDS record
router.post('/records', auth, async (req: Request, res: Response) => {
  try {
    const { companyId, vendorName, vendorPan, paymentDate, paymentAmount, category } = req.body;

    if (!companyId || !vendorName || !paymentDate || !paymentAmount || !category) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Verify ownership
    const isOwner = await verifyCompanyOwnership(companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Calculate quarter and year
    const date = new Date(paymentDate);
    const quarter = getFinancialQuarter(date);
    const year = date.getFullYear();

    // Create TDS record
    const tdsRecord = await tdsService.createTDSRecord(
      companyId,
      vendorName,
      vendorPan,
      date,
      Number(paymentAmount),
      category,
      quarter,
      year
    );

    res.status(201).json({
      success: true,
      tdsRecord,
      tdsCalculated: {
        rate: TDS_RATES[category] || 10,
        amount: (Number(paymentAmount) * ((TDS_RATES[category] || 10) / 100)).toFixed(2),
        netPayment: (Number(paymentAmount) - (Number(paymentAmount) * ((TDS_RATES[category] || 10) / 100))).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Create TDS record error:', error);
    res.status(500).json({ error: 'Failed to create TDS record' });
  }
});

// Delete TDS record
router.delete('/records/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const record = await prisma.tDSRecord.findUnique({
      where: { id }
    });

    if (!record) {
      return res.status(404).json({ error: 'TDS record not found' });
    }

    const isOwner = await verifyCompanyOwnership(record.companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await prisma.tDSRecord.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'TDS record deleted'
    });
  } catch (error) {
    console.error('Delete TDS record error:', error);
    res.status(500).json({ error: 'Failed to delete TDS record' });
  }
});

// Get TDS records
router.get('/records/:companyId', auth, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { quarter, year } = req.query;

    // Verify ownership
    const isOwner = await verifyCompanyOwnership(companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const records = await tdsService.getTDSRecords(
      companyId,
      quarter ? Number(quarter) : undefined,
      year ? Number(year) : undefined
    );

    res.json({
      success: true,
      count: records.length,
      records
    });
  } catch (error) {
    console.error('Get TDS records error:', error);
    res.status(500).json({ error: 'Failed to fetch TDS records' });
  }
});

// Generate Form 26Q
router.post('/form26q/generate', auth, async (req: Request, res: Response) => {
  try {
    const { companyId, quarter, year } = req.body;

    if (!companyId || !quarter || !year) {
      return res.status(400).json({ error: 'Company ID, quarter, and year are required' });
    }

    // Verify ownership
    const isOwner = await verifyCompanyOwnership(companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Generate Form 26Q
    const form26q = await tdsService.generateForm26Q(companyId, quarter, year);

    res.json({
      success: true,
      form26q
    });
  } catch (error) {
    console.error('Generate Form 26Q error:', error);
    res.status(500).json({ error: 'Failed to generate Form 26Q' });
  }
});

// Save Form 26Q
router.post('/form26q/save', auth, async (req: Request, res: Response) => {
  try {
    const { companyId, quarter, year, totalTdsDeposited } = req.body;

    if (!companyId || !quarter || !year) {
      return res.status(400).json({ error: 'Company ID, quarter, and year are required' });
    }

    // Verify ownership
    const isOwner = await verifyCompanyOwnership(companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Generate and save
    const form26q = await tdsService.generateForm26Q(companyId, quarter, year);
    const tdsReturn = await tdsService.saveTDSReturn(
      companyId,
      quarter,
      year,
      form26q,
      Number(totalTdsDeposited) || form26q.totalTdsDeducted
    );

    res.json({
      success: true,
      form26q,
      tdsReturn
    });
  } catch (error) {
    console.error('Save Form 26Q error:', error);
    res.status(500).json({ error: 'Failed to save Form 26Q' });
  }
});

// Get all TDS returns
router.get('/returns/:companyId', auth, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

    // Verify ownership
    const isOwner = await verifyCompanyOwnership(companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const returns = await tdsService.getTDSReturns(companyId);

    res.json({
      success: true,
      returns
    });
  } catch (error) {
    console.error('Get TDS returns error:', error);
    res.status(500).json({ error: 'Failed to fetch TDS returns' });
  }
});

// Mark Form 26Q as filed
router.post('/form26q/filed', auth, async (req: Request, res: Response) => {
  try {
    const { companyId, quarter, year } = req.body;

    if (!companyId || !quarter || !year) {
      return res.status(400).json({ error: 'Company ID, quarter, and year are required' });
    }

    // Verify ownership
    const isOwner = await verifyCompanyOwnership(companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const form26q = await tdsService.generateForm26Q(companyId, quarter, year);
    await tdsService.saveTDSReturn(
      companyId,
      quarter,
      year,
      form26q,
      form26q.totalTdsDeducted
    );
    const tdsReturn = await tdsService.markForm26QAsFiled(companyId, quarter, year);

    res.json({
      success: true,
      message: 'Form 26Q marked as filed',
      tdsReturn
    });
  } catch (error) {
    console.error('Mark Form 26Q filed error:', error);
    res.status(500).json({ error: 'Failed to update filing status' });
  }
});

// Dashboard stats
router.get('/dashboard/:companyId', auth, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

    // Verify ownership
    const isOwner = await verifyCompanyOwnership(companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const stats = await tdsService.getDashboardStats(companyId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

export default router;
