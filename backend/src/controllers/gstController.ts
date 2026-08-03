// src/controllers/gstController.ts

import { Request, Response } from 'express';
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
    const stats = await gstService.getDashboardStats(companyId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};
