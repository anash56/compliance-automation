// src/controllers/tdsController.ts

import { Request, Response } from 'express';
import Joi from 'joi';
import tdsService, { TDS_RATES, TDSCategory } from '../services/tdsService';

const tdsCategories = Object.keys(TDS_RATES);
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;

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

export const createTDSRecord = async (req: Request, res: Response) => {
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

    const date = new Date(paymentDate);
    const quarter = getFinancialQuarter(date);
    const year = getFinancialYear(date);

    const tdsRecord = await tdsService.createTDSRecord({
      companyId,
      vendorName,
      vendorPan: vendorPan || undefined,
      paymentDate: date,
      paymentAmount,
      category: category as TDSCategory,
      quarter,
      year,
      userId: (req as any).userId
    });

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
};

export const updateTDSRecord = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vendorName, vendorPan, paymentDate, paymentAmount, category } = req.body;

    if (paymentAmount !== undefined && Number(paymentAmount) <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }

    if (vendorPan && !panPattern.test(vendorPan)) {
      return res.status(400).json({ error: 'Invalid Vendor PAN format' });
    }

    const date = new Date(paymentDate);
    const quarter = getFinancialQuarter(date);
    const year = getFinancialYear(date);
    const userId = (req as any).userId;

    const result = await tdsService.updateTDSRecord(id, {
      vendorName,
      vendorPan: vendorPan || null,
      paymentDate: date,
      paymentAmount: Number(paymentAmount),
      category: category as TDSCategory,
      quarter,
      year,
      userId
    });

    if (!result.success) {
      if (result.notFound) return res.status(404).json({ error: result.error });
      if (result.forbidden) return res.status(403).json({ error: result.error });
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, record: result.record });
  } catch (error) {
    console.error('Update TDS record error:', error);
    res.status(500).json({ error: 'Failed to update TDS record' });
  }
};

export const deleteTDSRecord = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const result = await tdsService.deleteTDSRecord(id, userId);

    if (!result.success) {
      if (result.notFound) return res.status(404).json({ error: result.error });
      if (result.forbidden) return res.status(403).json({ error: result.error });
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      message: 'TDS record deleted'
    });
  } catch (error) {
    console.error('Delete TDS record error:', error);
    res.status(500).json({ error: 'Failed to delete TDS record' });
  }
};

export const getTDSRecords = async (req: Request, res: Response) => {
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
};

export const generateForm26Q = async (req: Request, res: Response) => {
  try {
    const { value, error: validationError } = periodSchema.validate(req.body, {
      abortEarly: false
    });

    if (validationError) {
      return res.status(400).json({
        error: 'Invalid request payload',
        details: validationError.details.map((detail) => detail.message)
      });
    }

    const { companyId, quarter, year } = value;

    const form26Q = await tdsService.generateForm26Q(
      companyId,
      quarter,
      year
    );

    res.json({
      success: true,
      form26Q
    });
  } catch (error) {
    console.error('Generate Form 26Q error:', error);
    res.status(500).json({ error: 'Failed to generate Form 26Q' });
  }
};

export const saveTDSReturn = async (req: Request, res: Response) => {
  try {
    const { companyId, quarter, year, totalTdsDeposited } = req.body;

    if (!companyId || !quarter || !year || totalTdsDeposited === undefined) {
      return res.status(400).json({
        error: 'Company ID, quarter, year, and total TDS deposited are required'
      });
    }

    const form26Q = await tdsService.generateForm26Q(companyId, quarter, year);
    const tdsReturn = await tdsService.saveTDSReturn(
      companyId,
      quarter,
      year,
      form26Q,
      Number(totalTdsDeposited)
    );

    res.json({
      success: true,
      tdsReturn
    });
  } catch (error) {
    console.error('Save TDS return error:', error);
    res.status(500).json({ error: 'Failed to save TDS return' });
  }
};

export const saveForm26Q = saveTDSReturn;

export const getTDSReturns = async (req: Request, res: Response) => {
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
};

export const markForm26QFiled = async (req: Request, res: Response) => {
  try {
    const { value, error: validationError } = periodSchema.validate(req.body, {
      abortEarly: false
    });

    if (validationError) {
      return res.status(400).json({
        error: 'Invalid request payload',
        details: validationError.details.map((detail) => detail.message)
      });
    }

    const { companyId, quarter, year } = value;

    const form26Q = await tdsService.generateForm26Q(companyId, quarter, year);
    await tdsService.saveTDSReturn(companyId, quarter, year, form26Q, form26Q.totalTdsDeducted);

    const tdsReturn = await tdsService.markForm26QAsFiled(
      companyId,
      quarter,
      year
    );

    res.json({
      success: true,
      message: 'Form 26Q marked as filed',
      tdsReturn
    });
  } catch (error) {
    console.error('Mark Form 26Q filed error:', error);
    res.status(500).json({ error: 'Failed to update Form 26Q filing status' });
  }
};

export const getTDSDashboardStats = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const stats = await tdsService.getDashboardStats(companyId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get TDS dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch TDS dashboard stats' });
  }
};

export const getTdsDashboardStats = getTDSDashboardStats;
