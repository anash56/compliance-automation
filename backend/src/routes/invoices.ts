import express, { Router, Request, Response } from 'express';
import auth from '../middleware/auth';
import { prisma } from '../server';
import { authorizeMember } from '../middleware/authorize';

const router: Router = express.Router();

// Create an invoice
router.post('/', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR']), async (req: Request, res: Response) => {
  try {
    const { companyId, vendorName, amount, gstRate, invoiceDate } = req.body;

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

    const gstr1Exists = await (prisma as any).complianceTask.findFirst({ where: { companyId, type: 'GST Filing', month: m, year: y } });
    if (!gstr1Exists) {
      await (prisma as any).complianceTask.create({ data: { companyId, type: 'GST Filing', desc: `GSTR-1 (${monthName} ${y})`, date: new Date(nextY, nextM - 1, 11), color: 'orange', status: 'pending', month: m, year: y } });
    }
    
    const gstr3bExists = await (prisma as any).complianceTask.findFirst({ where: { companyId, type: 'GST Payment', month: m, year: y } });
    if (!gstr3bExists) {
      await (prisma as any).complianceTask.create({ data: { companyId, type: 'GST Payment', desc: `GSTR-3B (${monthName} ${y})`, date: new Date(nextY, nextM - 1, 20), color: 'yellow', status: 'pending', month: m, year: y } });
    }

    res.status(201).json({ success: true, invoice });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
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
      select: { companyId: true },
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
    res.json({ success: true, message: 'Invoice deleted' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

export default router;