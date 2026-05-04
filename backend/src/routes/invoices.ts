import express, { Router, Request, Response } from 'express';
import auth from '../middleware/auth';
import { prisma } from '../server';
import { authorizeMember } from '../middleware/authorize';

const router: Router = express.Router();

// Create an invoice
router.post('/', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR']), async (req: Request, res: Response) => {
  try {
    const { companyId, vendorName, amount, gstRate, invoiceDate } = req.body;

    if (Number(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    
    const vendorGst = req.body.vendorGst ? String(req.body.vendorGst).trim().toUpperCase() : null;
    const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
    if (vendorGst && !gstPattern.test(vendorGst)) {
      return res.status(400).json({ error: 'Invalid Vendor GST Number format' });
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    const companyState = (company?.state || '').trim().toLowerCase();
    const invoiceState = (req.body.state || '').trim().toLowerCase();
    const invoiceType = req.body.invoiceType || 'B2B';

    const totalTax = (Number(amount) * Number(gstRate)) / 100;
    
    // Calculate split taxes based on state
    const isInterstate = invoiceType === 'IMPORT' || 
      (invoiceState && companyState && invoiceState !== companyState);

    const sgst = isInterstate ? 0 : totalTax / 2;
    const cgst = isInterstate ? 0 : totalTax / 2;
    const igst = isInterstate ? totalTax : 0;

    const invoice = await prisma.invoice.create({
      data: {
        companyId,
        invoiceNumber: req.body.invoiceNumber || `INV-${Date.now()}`,
        vendorName,
        vendorGst,
        amount: Number(amount),
        gstRate: Number(gstRate),
        sgst,
        cgst,
        igst,
        totalTax,
        invoiceDate: new Date(invoiceDate),
        invoiceType,
        state: req.body.state || 'Local'
      }
    });

    // Ensure Compliance Tasks exist for the month
    const invoiceDateObj = new Date(invoiceDate);
    const m = invoiceDateObj.getMonth() + 1;
    const y = invoiceDateObj.getFullYear();
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    const monthName = invoiceDateObj.toLocaleString('default', { month: 'short' });

    try {
      if ((prisma as any).complianceTask) {
        const gstr1Exists = await (prisma as any).complianceTask.findFirst({ where: { companyId, type: 'GST Filing', month: m, year: y } });
        if (!gstr1Exists) {
          await (prisma as any).complianceTask.create({ data: { companyId, type: 'GST Filing', desc: `GSTR-1 (${monthName} ${y})`, date: new Date(nextY, nextM - 1, 11), color: 'orange', status: 'pending', month: m, year: y } });
        }
        const gstr3bExists = await (prisma as any).complianceTask.findFirst({ where: { companyId, type: 'GST Payment', month: m, year: y } });
        if (!gstr3bExists) {
          await (prisma as any).complianceTask.create({ data: { companyId, type: 'GST Payment', desc: `GSTR-3B (${monthName} ${y})`, date: new Date(nextY, nextM - 1, 20), color: 'yellow', status: 'pending', month: m, year: y } });
        }
      }
      if ((prisma as any).auditLog) {
        await (prisma as any).auditLog.create({
          data: { companyId, userId: req.userId!, action: 'CREATE_INVOICE', details: `Created invoice ${invoice.invoiceNumber} for INR ${amount}` }
        });
      }
    } catch (e) { console.warn('Task/Audit skipped'); }

    res.status(201).json({ success: true, invoice });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Update an invoice
router.put('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vendorName, amount, gstRate, invoiceDate, state, invoiceType, hsnCode, notes, invoiceNumber } = req.body;

    if (Number(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    
    const vendorGst = req.body.vendorGst ? String(req.body.vendorGst).trim().toUpperCase() : null;
    const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
    if (vendorGst && !gstPattern.test(vendorGst)) {
      return res.status(400).json({ error: 'Invalid Vendor GST Number format' });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id }, select: { companyId: true, state: true, invoiceType: true } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Manually check permission securely
    const membership = await prisma.companyMember.findUnique({
      where: { userId_companyId: { userId: req.userId!, companyId: invoice.companyId } },
    });
    if (!membership || !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
      return res.status(403).json({ error: 'You do not have permission to edit this invoice.' });
    }

    const company = await prisma.company.findUnique({ where: { id: invoice.companyId } });
    const companyState = (company?.state || '').trim().toLowerCase();
    const invoiceState = (state || invoice.state || '').trim().toLowerCase();
    const invType = invoiceType || invoice.invoiceType || 'B2B';

    const totalTax = (Number(amount) * Number(gstRate)) / 100;
    const isInterstate = invType === 'IMPORT' || (invoiceState && companyState && invoiceState !== companyState);

    const sgst = isInterstate ? 0 : totalTax / 2;
    const cgst = isInterstate ? 0 : totalTax / 2;
    const igst = isInterstate ? totalTax : 0;

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        invoiceNumber,
        vendorName,
        vendorGst,
        amount: Number(amount),
        gstRate: Number(gstRate),
        sgst,
        cgst,
        igst,
        totalTax,
        invoiceDate: new Date(invoiceDate),
        invoiceType: invType,
        state: state || 'Local',
        hsnCode: hsnCode || null,
        notes: notes || null
      }
    });

    try {
      if ((prisma as any).auditLog) {
        await (prisma as any).auditLog.create({
          data: { companyId: invoice.companyId, userId: req.userId!, action: 'UPDATE_INVOICE', details: `Updated invoice ${invoiceNumber}` }
        });
      }
    } catch(e) {}

    res.json({ success: true, invoice: updatedInvoice });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// Get invoices for a company
router.get('/:companyId', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

    const invoices = await prisma.invoice.findMany({
      where: { companyId },
      orderBy: { invoiceDate: 'desc' }
    });

    res.json({ success: true, invoices });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Delete an invoice
router.delete('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { companyId: true, invoiceNumber: true },
    });

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Manually check permission before deleting
    const membership = await prisma.companyMember.findUnique({
      where: { userId_companyId: { userId: req.userId!, companyId: invoice.companyId } },
    });

    if (!membership || !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
      return res.status(403).json({ error: 'You do not have permission to delete this invoice.' });
    }

    await prisma.invoice.delete({ where: { id } });

    try {
      if ((prisma as any).auditLog) {
        await (prisma as any).auditLog.create({
          data: { companyId: invoice.companyId, userId: req.userId!, action: 'DELETE_INVOICE', details: `Deleted invoice ${invoice.invoiceNumber}` }
        });
      }
    } catch(e) {}

    res.json({ success: true, message: 'Invoice deleted' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

export default router;