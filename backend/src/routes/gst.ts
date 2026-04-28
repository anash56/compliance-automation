// src/routes/gst.ts

import express, { Router, Request, Response } from 'express';
import auth from '../middleware/auth';
import gstService from '../services/gstService';
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

// Generate GSTR-1
router.post('/gstr1/generate', auth, async (req: Request, res: Response) => {
  try {
    const { companyId, month, year } = req.body;

    if (!companyId || !month || !year) {
      return res.status(400).json({ error: 'Company ID, month, and year are required' });
    }

    // Verify ownership
    const isOwner = await verifyCompanyOwnership(companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Generate GSTR-1
    const gstr1 = await gstService.generateGSTR1(companyId, month, year);

    res.json({
      success: true,
      gstr1
    });
  } catch (error) {
    console.error('Generate GSTR-1 error:', error);
    res.status(500).json({ error: 'Failed to generate GSTR-1' });
  }
});

// Generate GSTR-3B
router.post('/gstr3b/generate', auth, async (req: Request, res: Response) => {
  try {
    const { companyId, month, year } = req.body;

    if (!companyId || !month || !year) {
      return res.status(400).json({ error: 'Company ID, month, and year are required' });
    }

    // Verify ownership
    const isOwner = await verifyCompanyOwnership(companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Generate GSTR-1 and GSTR-3B
    const gstr1 = await gstService.generateGSTR1(companyId, month, year);
    const gstr3b = await gstService.generateGSTR3B(companyId, month, year);

    // Save to database
    await gstService.saveGSTReturn(companyId, month, year, gstr1, gstr3b);

    res.json({
      success: true,
      gstr1,
      gstr3b
    });
  } catch (error) {
    console.error('Generate GSTR-3B error:', error);
    res.status(500).json({ error: 'Failed to generate GSTR-3B' });
  }
});

// Get all GST returns
router.get('/returns/:companyId', auth, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

    // Verify ownership
    const isOwner = await verifyCompanyOwnership(companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const returns = await gstService.getGSTReturns(companyId);

    res.json({
      success: true,
      returns
    });
  } catch (error) {
    console.error('Get GST returns error:', error);
    res.status(500).json({ error: 'Failed to fetch GST returns' });
  }
});

// Mark GSTR-1 as filed
router.post('/gstr1/filed', auth, async (req: Request, res: Response) => {
  try {
    const { companyId, month, year } = req.body;

    if (!companyId || !month || !year) {
      return res.status(400).json({ error: 'Company ID, month, and year are required' });
    }

    // Verify ownership
    const isOwner = await verifyCompanyOwnership(companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const gstReturn = await gstService.markAsFiledGSTR1(companyId, month, year);

    res.json({
      success: true,
      message: 'GSTR-1 marked as filed',
      gstReturn
    });
  } catch (error) {
    console.error('Mark GSTR-1 filed error:', error);
    res.status(500).json({ error: 'Failed to update filing status' });
  }
});

// Mark GSTR-3B as filed
router.post('/gstr3b/filed', auth, async (req: Request, res: Response) => {
  try {
    const { companyId, month, year } = req.body;

    if (!companyId || !month || !year) {
      return res.status(400).json({ error: 'Company ID, month, and year are required' });
    }

    // Verify ownership
    const isOwner = await verifyCompanyOwnership(companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const gstReturn = await gstService.markAsFiledGSTR3B(companyId, month, year);

    res.json({
      success: true,
      message: 'GSTR-3B marked as filed',
      gstReturn
    });
  } catch (error) {
    console.error('Mark GSTR-3B filed error:', error);
    res.status(500).json({ error: 'Failed to update filing status' });
  }
});

// Get dashboard stats
router.get('/dashboard/:companyId', auth, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

    // Verify ownership
    const isOwner = await verifyCompanyOwnership(companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get total invoices
    const invoiceCount = await prisma.invoice.count({
      where: { companyId }
    });

    // Get total tax
    const invoices = await prisma.invoice.findMany({
      where: { companyId }
    });

    const totalTax = invoices.reduce((sum, i) => sum + Number(i.totalTax), 0);

    // Get GST returns filed
    const gstReturns = await prisma.gSTReturn.findMany({
      where: { companyId }
    });

    const filedCount = gstReturns.filter(r => r.gstr1Status === 'submitted').length;

    res.json({
      success: true,
      stats: {
        totalInvoices: invoiceCount,
        totalTax: Math.round(totalTax * 100) / 100,
        gstReturnsFiledCount: filedCount,
        gstReturnsDraftCount: gstReturns.length - filedCount
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

export default router;