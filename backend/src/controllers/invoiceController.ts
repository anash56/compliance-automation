// src/controllers/invoiceController.ts

import { Request, Response } from 'express';
import { validateGSTIN } from '../utils/validators';
import * as invoiceService from '../services/invoiceService';

export const createInvoice = async (req: Request, res: Response) => {
  try {
    const { companyId, vendorName, amount, gstRate, invoiceDate, vendorGst, state, invoiceType, invoiceNumber } = req.body;

    if (!companyId || !vendorName || amount === undefined || gstRate === undefined || !invoiceDate) {
      return res.status(400).json({ error: 'Company ID, vendor name, amount, GST rate, and invoice date are required' });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const formattedVendorGst = vendorGst ? String(vendorGst).trim().toUpperCase() : null;
    if (formattedVendorGst && !validateGSTIN(formattedVendorGst)) {
      return res.status(400).json({ error: 'Invalid Vendor GST Number format' });
    }

    const userId = (req as any).userId;
    const result = await invoiceService.createInvoice(userId, {
      companyId,
      vendorName,
      amount: Number(amount),
      gstRate: Number(gstRate),
      invoiceDate,
      vendorGst: formattedVendorGst,
      state,
      invoiceType,
      invoiceNumber
    });

    res.status(201).json({ success: true, invoice: result.invoice });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

export const updateInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vendorName, amount, gstRate, invoiceDate, state, invoiceType, hsnCode, notes, invoiceNumber, vendorGst } = req.body;

    if (amount !== undefined && Number(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const formattedVendorGst = vendorGst ? String(vendorGst).trim().toUpperCase() : null;
    if (formattedVendorGst && !validateGSTIN(formattedVendorGst)) {
      return res.status(400).json({ error: 'Invalid Vendor GST Number format' });
    }

    const userId = (req as any).userId;
    const result = await invoiceService.updateInvoice(userId, id, {
      invoiceNumber,
      vendorName,
      vendorGst: formattedVendorGst,
      amount: amount !== undefined ? Number(amount) : undefined,
      gstRate: gstRate !== undefined ? Number(gstRate) : undefined,
      invoiceDate,
      state,
      invoiceType,
      hsnCode,
      notes
    });

    if (!result.success) {
      if (result.notFound) return res.status(404).json({ error: result.error });
      if (result.forbidden) return res.status(403).json({ error: result.error });
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, invoice: result.invoice });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
};

export const getInvoicesByCompany = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const invoices = await invoiceService.getInvoicesByCompany(companyId);
    res.json({ success: true, invoices });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

export const deleteInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const result = await invoiceService.deleteInvoice(userId, id);

    if (!result.success) {
      if (result.notFound) return res.status(404).json({ error: result.error });
      if (result.forbidden) return res.status(403).json({ error: result.error });
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: 'Invoice deleted' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
};
