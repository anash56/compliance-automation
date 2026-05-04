// src/routes/tds.ts

import express, { Router, Request, Response } from 'express';
import Joi from 'joi';
import auth from '../middleware/auth';
import tdsService, { TDS_RATES, TDSCategory } from '../services/tdsService';
import { prisma } from '../server';
import { authorizeMember } from '../middleware/authorize';

const router: Router = express.Router();
const tdsCategories = Object.keys(TDS_RATES);
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const createTDSRecordSchema = Joi.object({
  companyId: Joi.string().trim().required(),
  vendorName: Joi.string().trim().min(2).max(120).required(),
  vendorPan: Joi.string().trim().uppercase().pattern(panPattern).allow('', null),
  paymentDate: Joi.date().iso().required(),
  paymentAmount: Joi.number().positive().precision(2).required(),
  category: Joi.string().valid(...tdsCategories).required()
});

const periodSchema = Joi.object({
  companyId: Joi.string().trim().required(),
  quarter: Joi.number().integer().min(1).max(4).required(),
  year: Joi.number().integer().min(1990).max(2100).required()
});

const recordQuerySchema = Joi.object({
  quarter: Joi.number().integer().min(1).max(4),
  year: Joi.number().integer().min(1990).max(2100)
}).and('quarter', 'year');

const getFinancialQuarter = (date: Date) => {
  const month = date.getMonth() + 1;

  if (month >= 4 && month <= 6) return 1;
  if (month >= 7 && month <= 9) return 2;
  if (month >= 10 && month <= 12) return 3;
  return 4;
};

const getFinancialYear = (date: Date) => {
  const month = date.getMonth() + 1;
  return month >= 4 ? date.getFullYear() : date.getFullYear() - 1;
};

// Create TDS record
router.post('/records', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR']), async (req: Request, res: Response) => {
  try {
    const { value, error: validationError } = createTDSRecordSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (validationError) {
      return res.status(400).json({
        error: 'Invalid TDS record',
        details: validationError.details.map((detail) => detail.message)
      });
    }

    const { companyId, vendorName, vendorPan, paymentDate, paymentAmount, category } = value;

    // Calculate quarter and year
    const date = new Date(paymentDate);
    const quarter = getFinancialQuarter(date);
    const year = getFinancialYear(date);

    // Create TDS record
    const tdsRecord = await tdsService.createTDSRecord({
      companyId,
      vendorName,
      vendorPan: vendorPan || undefined,
      paymentDate: date,
      paymentAmount,
      category: category as TDSCategory,
      quarter,
      year
    });

    // Create pending tasks for TDS Return & Payment
    const qTaskExists = await (prisma as any).complianceTask.findFirst({ where: { companyId, type: 'TDS Return', quarter, year } });
    if (!qTaskExists) {
      let dueDate = new Date();
      if (quarter === 1) dueDate = new Date(year, 6, 31);
      else if (quarter === 2) dueDate = new Date(year, 9, 31);
      else if (quarter === 3) dueDate = new Date(year + 1, 0, 31);
      else if (quarter === 4) dueDate = new Date(year + 1, 4, 31);
      
      await (prisma as any).complianceTask.create({ data: { companyId, type: 'TDS Return', desc: `Form 26Q (Q${quarter} FY${year}-${String(year + 1).slice(2)})`, date: dueDate, color: 'purple', status: 'pending', quarter, year } });
    }

    const m = date.getMonth() + 1;
    const calYear = date.getFullYear();
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? calYear + 1 : calYear;
    const monthName = date.toLocaleString('default', { month: 'short' });
    
    const pTaskExists = await (prisma as any).complianceTask.findFirst({ where: { companyId, type: 'TDS Payment', month: m, year: calYear } });
    if (!pTaskExists) {
      await (prisma as any).complianceTask.create({ data: { companyId, type: 'TDS Payment', desc: `TDS Payment (${monthName} ${calYear})`, date: new Date(nextY, nextM - 1, 7), color: 'red', status: 'pending', month: m, year: calYear } });
    }

    const tdsDeducted = tdsService.calculateTDS(paymentAmount, category);
    res.status(201).json({
      success: true,
      tdsRecord,
      tdsCalculated: {
        rate: tdsService.getRate(category),
        amount: tdsDeducted.toFixed(2),
        netPayment: (paymentAmount - tdsDeducted).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Create TDS record error:', error);
    res.status(500).json({ error: 'Failed to create TDS record' });
  }
});

// Update TDS record
router.put('/records/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vendorName, vendorPan, paymentDate, paymentAmount, category } = req.body;

    const record = await prisma.tDSRecord.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ error: 'TDS record not found' });

    // Manually check permission securely
    const membership = await prisma.companyMember.findUnique({
      where: { userId_companyId: { userId: req.userId!, companyId: record.companyId } },
    });
    if (!membership || !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
      return res.status(403).json({ error: 'You do not have permission to edit this record.' });
    }

    const date = new Date(paymentDate);
    const quarter = getFinancialQuarter(date);
    const year = getFinancialYear(date);

    const rate = TDS_RATES[category as TDSCategory] || 10;
    const tdsDeducted = (Number(paymentAmount) * rate) / 100;
    const paymentMade = Number(paymentAmount) - tdsDeducted;

    const updatedRecord = await prisma.tDSRecord.update({
      where: { id },
      data: {
        vendorName,
        vendorPan: vendorPan || null,
        paymentDate: date,
        paymentAmount: Number(paymentAmount),
        category,
        quarter,
        year,
        tdsRate: rate,
        tdsDeducted,
        paymentMade
      }
    });

    res.json({ success: true, record: updatedRecord });
  } catch (error) {
    console.error('Update TDS record error:', error);
    res.status(500).json({ error: 'Failed to update TDS record' });
  }
});

// Delete TDS record
router.delete('/records/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const record = await prisma.tDSRecord.findUnique({
      where: { id },
      select: { companyId: true },
    });

    if (!record) {
      return res.status(404).json({ error: 'TDS record not found' });
    }

    const membership = await prisma.companyMember.findUnique({
      where: { userId_companyId: { userId: req.userId!, companyId: record.companyId } },
    });

    if (!membership || !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
      return res.status(403).json({ error: 'You do not have permission to delete this record.' });
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
router.get('/records/:companyId', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { value, error: validationError } = recordQuerySchema.validate(req.query, {
      abortEarly: false,
      convert: true
    });

    if (validationError) {
      return res.status(400).json({
        error: 'Invalid TDS record filters',
        details: validationError.details.map((detail) => detail.message)
      });
    }

    const { quarter, year } = value;

    const records = await tdsService.getTDSRecords(
      companyId,
      quarter,
      year
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
router.post('/form26q/generate', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR']), async (req: Request, res: Response) => {
  try {
    const { value, error: validationError } = periodSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (validationError) {
      return res.status(400).json({
        error: 'Invalid Form 26Q period',
        details: validationError.details.map((detail) => detail.message)
      });
    }

    const { companyId, quarter, year } = value;

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
router.post('/form26q/save', auth, authorizeMember(['OWNER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { value, error: validationError } = periodSchema.keys({
      totalTdsDeposited: Joi.number().min(0).precision(2)
    }).validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (validationError) {
      return res.status(400).json({
        error: 'Invalid Form 26Q save request',
        details: validationError.details.map((detail) => detail.message)
      });
    }

    const { companyId, quarter, year, totalTdsDeposited } = value;

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
router.get('/returns/:companyId', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

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
router.post('/form26q/filed', auth, authorizeMember(['OWNER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { value, error: validationError } = periodSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (validationError) {
      return res.status(400).json({
        error: 'Invalid Form 26Q filed request',
        details: validationError.details.map((detail) => detail.message)
      });
    }

    const { companyId, quarter, year } = value;

    const form26q = await tdsService.generateForm26Q(companyId, quarter, year);
    await tdsService.saveTDSReturn(
      companyId,
      quarter,
      year,
      form26q,
      form26q.totalTdsDeducted
    );
    const tdsReturn = await tdsService.markForm26QAsFiled(companyId, quarter, year);

    await (prisma as any).complianceTask.updateMany({
      where: { companyId, type: 'TDS Return', quarter, year },
      data: { status: 'completed' }
    });

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
router.get('/dashboard/:companyId', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

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
