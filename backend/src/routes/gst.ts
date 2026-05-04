// src/routes/gst.ts

import express, { Router, Request, Response } from 'express';
import auth from '../middleware/auth';
import { prisma } from '../server';
import gstService from '../services/gstService';
import { authorizeMember } from '../middleware/authorize';

const router: Router = express.Router();

// Generate GSTR-1
router.post('/gstr1/generate', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR']), async (req: Request, res: Response) => {
  try {
    const { companyId, month, year } = req.body;

    if (!companyId || !month || !year) {
      return res.status(400).json({ error: 'Company ID, month, and year are required' });
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
router.post('/gstr3b/generate', auth, authorizeMember(['OWNER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { companyId, month, year } = req.body;

    if (!companyId || !month || !year) {
      return res.status(400).json({ error: 'Company ID, month, and year are required' });
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
router.get('/returns/:companyId', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

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
router.post('/gstr1/filed', auth, authorizeMember(['OWNER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { companyId, month, year } = req.body;

    if (!companyId || !month || !year) {
      return res.status(400).json({ error: 'Company ID, month, and year are required' });
    }

    const gstr1 = await gstService.generateGSTR1(companyId, month, year);
    const gstr3b = await gstService.generateGSTR3B(companyId, month, year);
    await gstService.saveGSTReturn(companyId, month, year, gstr1, gstr3b);
    const gstReturn = await gstService.markAsFiledGSTR1(companyId, month, year);

    await (prisma as any).complianceTask.updateMany({
      where: { companyId, type: 'GST Filing', month, year },
      data: { status: 'completed' }
    });

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
router.post('/gstr3b/filed', auth, authorizeMember(['OWNER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { companyId, month, year } = req.body;

    if (!companyId || !month || !year) {
      return res.status(400).json({ error: 'Company ID, month, and year are required' });
    }

    const gstr1 = await gstService.generateGSTR1(companyId, month, year);
    const gstr3b = await gstService.generateGSTR3B(companyId, month, year);
    await gstService.saveGSTReturn(companyId, month, year, gstr1, gstr3b);
    const gstReturn = await gstService.markAsFiledGSTR3B(companyId, month, year);

    await (prisma as any).complianceTask.updateMany({
      where: { companyId, type: 'GST Payment', month, year },
      data: { status: 'completed' }
    });

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
router.get('/dashboard/:companyId', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

    // Get total invoices
    const invoiceCount = await prisma.invoice.count({
      where: { companyId }
    });

    // Get total tax
    const invoices = await prisma.invoice.findMany({
      where: { companyId }
    });

    const totalTax = invoices.reduce((sum: number, i) => sum + Number(i.totalTax), 0);

    // Get GST returns filed
    const gstReturns = await prisma.gSTReturn.findMany({
      where: { companyId }
    });

    const filedCount = gstReturns.reduce((count: number, gstReturn) => {
      return count + 
        (gstReturn.gstr1Status === 'submitted' || gstReturn.gstr1FiledDate ? 1 : 0) +
        (gstReturn.gstr3bStatus === 'submitted' || gstReturn.gstr3bFiledDate ? 1 : 0);
    }, 0);

    res.json({
      success: true,
      stats: {
        totalInvoices: invoiceCount,
        totalTax: Math.round(totalTax * 100) / 100,
        gstReturnsFiledCount: filedCount,
        gstReturnsDraftCount: (gstReturns.length * 2) - filedCount
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

export default router;
