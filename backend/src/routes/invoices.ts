// src/routes/invoices.ts

import express, { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { Decimal } from '@prisma/client/runtime/library';
import auth from '../middleware/auth';

const router: Router = express.Router();

// Helper function to verify company ownership
const verifyCompanyOwnership = async (companyId: string, userId: string) => {
  const company = await prisma.company.findUnique({
    where: { id: companyId }
  });

  if (!company || company.userId !== userId) {
    return false;
  }
  return true;
};

// Create invoice
router.post('/', auth, async (req: Request, res: Response) => {
  try {
    const { companyId, invoiceNumber, vendorName, vendorGst, amount, gstRate, invoiceDate, state, invoiceType, hsnCode, notes } = req.body;

    // Validation
    if (!companyId || !invoiceNumber || !vendorName || !amount || !gstRate) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Verify company ownership
    const isOwner = await verifyCompanyOwnership(companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Calculate taxes
    const amountNum = Number(amount);
    const gstRateNum = Number(gstRate);
    const totalTax = (amountNum * gstRateNum) / 100;
    const sgst = totalTax / 2;
    const cgst = totalTax / 2;

    const invoice = await prisma.invoice.create({
      data: {
        companyId,
        invoiceNumber,
        vendorName,
        vendorGst: vendorGst || null,
        amount: new Decimal(amountNum),
        gstRate: gstRateNum,
        sgst: new Decimal(sgst),
        cgst: new Decimal(cgst),
        igst: new Decimal(0),
        totalTax: new Decimal(totalTax),
        invoiceDate: new Date(invoiceDate),
        state: state || '',
        invoiceType: invoiceType || 'B2B',
        hsnCode: hsnCode || null,
        notes: notes || null
      }
    });

    res.status(201).json({
      success: true,
      invoice,
      calculatedTax: {
        sgst: sgst.toFixed(2),
        cgst: cgst.toFixed(2),
        total: totalTax.toFixed(2)
      }
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Get invoices
router.get('/:companyId', auth, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { month, year } = req.query;

    // Verify company ownership
    const isOwner = await verifyCompanyOwnership(companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    let invoices;

    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 1);

      invoices = await prisma.invoice.findMany({
        where: {
          companyId,
          invoiceDate: {
            gte: startDate,
            lt: endDate
          }
        },
        orderBy: { invoiceDate: 'desc' }
      });
    } else {
      invoices = await prisma.invoice.findMany({
        where: { companyId },
        orderBy: { invoiceDate: 'desc' },
        take: 100
      });
    }

    res.json({
      success: true,
      count: invoices.length,
      invoices
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Update invoice
router.put('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vendorName, amount, gstRate, invoiceDate, state, notes } = req.body;

    const invoice = await prisma.invoice.findUnique({
      where: { id }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Verify company ownership
    const isOwner = await verifyCompanyOwnership(invoice.companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Recalculate taxes
    const amountNum = Number(amount) || Number(invoice.amount);
    const gstRateNum = Number(gstRate) || invoice.gstRate;
    const totalTax = (amountNum * gstRateNum) / 100;
    const sgst = totalTax / 2;
    const cgst = totalTax / 2;

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        vendorName: vendorName || invoice.vendorName,
        amount: new Decimal(amountNum),
        gstRate: gstRateNum,
        sgst: new Decimal(sgst),
        cgst: new Decimal(cgst),
        totalTax: new Decimal(totalTax),
        invoiceDate: invoiceDate ? new Date(invoiceDate) : invoice.invoiceDate,
        state: state || invoice.state,
        notes: notes || invoice.notes
      }
    });

    res.json({
      success: true,
      invoice: updatedInvoice
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// Delete invoice
router.delete('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Verify company ownership
    const isOwner = await verifyCompanyOwnership(invoice.companyId, req.userId!);
    if (!isOwner) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await prisma.invoice.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Invoice deleted'
    });
  } catch (error: any) {
    if (error.code === 'P2014') {
      return res.status(400).json({
        error: 'Cannot delete invoice - referenced by GST return'
      });
    }
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

export default router;