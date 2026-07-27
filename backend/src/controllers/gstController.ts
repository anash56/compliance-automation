// src/controllers/gstController.ts

import { Request, Response } from 'express';
import { prisma } from '../server';
import gstService from '../services/gstService';

export const generateGSTR1 = async (req: Request, res: Response) => {
  try {
    const { companyId, month, year } = req.body;

    if (!companyId || !month || !year) {
      return res.status(400).json({ error: 'Company ID, month, and year are required' });
    }

    const gstr1 = await gstService.generateGSTR1(companyId, month, year);

    res.json({
      success: true,
      gstr1
    });
  } catch (error) {
    console.error('Generate GSTR-1 error:', error);
    res.status(500).json({ error: 'Failed to generate GSTR-1' });
  }
};

export const generateGSTR3B = async (req: Request, res: Response) => {
  try {
    const { companyId, month, year } = req.body;

    if (!companyId || !month || !year) {
      return res.status(400).json({ error: 'Company ID, month, and year are required' });
    }

    const gstr1 = await gstService.generateGSTR1(companyId, month, year);
    const gstr3b = await gstService.generateGSTR3B(companyId, month, year);
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
};

export const getGSTReturns = async (req: Request, res: Response) => {
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
};

export const markGSTR1Filed = async (req: Request, res: Response) => {
  try {
    const { companyId, month, year } = req.body;

    if (!companyId || !month || !year) {
      return res.status(400).json({ error: 'Company ID, month, and year are required' });
    }

    const gstr1 = await gstService.generateGSTR1(companyId, month, year);
    const gstr3b = await gstService.generateGSTR3B(companyId, month, year);
    await gstService.saveGSTReturn(companyId, month, year, gstr1, gstr3b);
    const gstReturn = await gstService.markAsFiledGSTR1(companyId, month, year);

    try {
      if ((prisma as any).complianceTask) {
        await (prisma as any).complianceTask.updateMany({
          where: { companyId, type: 'GST Filing', month, year },
          data: { status: 'completed' }
        });
      }
    } catch(e) {}

    res.json({
      success: true,
      message: 'GSTR-1 marked as filed',
      gstReturn
    });
  } catch (error) {
    console.error('Mark GSTR-1 filed error:', error);
    res.status(500).json({ error: 'Failed to update filing status' });
  }
};

export const markGSTR3BFiled = async (req: Request, res: Response) => {
  try {
    const { companyId, month, year } = req.body;

    if (!companyId || !month || !year) {
      return res.status(400).json({ error: 'Company ID, month, and year are required' });
    }

    const gstr1 = await gstService.generateGSTR1(companyId, month, year);
    const gstr3b = await gstService.generateGSTR3B(companyId, month, year);
    await gstService.saveGSTReturn(companyId, month, year, gstr1, gstr3b);
    const gstReturn = await gstService.markAsFiledGSTR3B(companyId, month, year);

    try {
      if ((prisma as any).complianceTask) {
        await (prisma as any).complianceTask.updateMany({
          where: { companyId, type: 'GST Payment', month, year },
          data: { status: 'completed' }
        });
      }
    } catch(e) {}

    res.json({
      success: true,
      message: 'GSTR-3B marked as filed',
      gstReturn
    });
  } catch (error) {
    console.error('Mark GSTR-3B filed error:', error);
    res.status(500).json({ error: 'Failed to update filing status' });
  }
};

export const getGstDashboardStats = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

    const invoiceCount = await prisma.invoice.count({
      where: { companyId }
    });

    const invoices = await prisma.invoice.findMany({
      where: { companyId }
    });

    const totalTax = invoices.reduce((sum: number, i) => sum + Number(i.totalTax), 0);

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
};
