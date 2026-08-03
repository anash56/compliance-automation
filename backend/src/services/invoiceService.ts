// src/services/invoiceService.ts

import { prisma } from '../server';

export interface CreateInvoiceInput {
  companyId: string;
  invoiceNumber?: string;
  vendorName: string;
  vendorGst?: string | null;
  amount: number;
  gstRate: number;
  invoiceDate: string;
  invoiceType?: string;
  state?: string;
}

export interface UpdateInvoiceInput {
  invoiceNumber?: string;
  vendorName?: string;
  vendorGst?: string | null;
  amount?: number;
  gstRate?: number;
  invoiceDate?: string;
  state?: string;
  invoiceType?: string;
  hsnCode?: string | null;
  notes?: string | null;
}

export const createInvoice = async (userId: string, data: CreateInvoiceInput) => {
  const company = await prisma.company.findUnique({ where: { id: data.companyId } });
  const companyState = (company?.state || '').trim().toLowerCase();
  const invoiceState = (data.state || '').trim().toLowerCase();
  const invoiceType = data.invoiceType || 'B2B';

  const totalTax = (Number(data.amount) * Number(data.gstRate)) / 100;
  const isInterstate = invoiceType === 'IMPORT' || (invoiceState && companyState && invoiceState !== companyState);

  const sgst = isInterstate ? 0 : totalTax / 2;
  const cgst = isInterstate ? 0 : totalTax / 2;
  const igst = isInterstate ? totalTax : 0;

  const invoice = await prisma.invoice.create({
    data: {
      companyId: data.companyId,
      invoiceNumber: data.invoiceNumber || `INV-${Date.now()}`,
      vendorName: data.vendorName,
      vendorGst: data.vendorGst || null,
      amount: Number(data.amount),
      gstRate: Number(data.gstRate),
      sgst,
      cgst,
      igst,
      totalTax,
      invoiceDate: new Date(data.invoiceDate),
      invoiceType,
      state: data.state || 'Local'
    }
  });

  const invoiceDateObj = new Date(data.invoiceDate);
  const m = invoiceDateObj.getMonth() + 1;
  const y = invoiceDateObj.getFullYear();
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const monthName = invoiceDateObj.toLocaleString('default', { month: 'short' });

  try {
    if ((prisma as any).complianceTask) {
      const gstr1Exists = await (prisma as any).complianceTask.findFirst({
        where: { companyId: data.companyId, type: 'GST Filing', month: m, year: y }
      });
      if (!gstr1Exists) {
        await (prisma as any).complianceTask.create({
          data: { companyId: data.companyId, type: 'GST Filing', desc: `GSTR-1 (${monthName} ${y})`, date: new Date(nextY, nextM - 1, 11), color: 'orange', status: 'pending', month: m, year: y }
        });
      }
      const gstr3bExists = await (prisma as any).complianceTask.findFirst({
        where: { companyId: data.companyId, type: 'GST Payment', month: m, year: y }
      });
      if (!gstr3bExists) {
        await (prisma as any).complianceTask.create({
          data: { companyId: data.companyId, type: 'GST Payment', desc: `GSTR-3B (${monthName} ${y})`, date: new Date(nextY, nextM - 1, 20), color: 'yellow', status: 'pending', month: m, year: y }
        });
      }
    }
    if ((prisma as any).auditLog) {
      await (prisma as any).auditLog.create({
        data: { companyId: data.companyId, userId, action: 'CREATE_INVOICE', details: `Created invoice ${invoice.invoiceNumber} for INR ${data.amount}` }
      });
    }
  } catch (e) {
    console.warn('Task/Audit skipped');
  }

  return { success: true, invoice };
};

export const updateInvoice = async (userId: string, invoiceId: string, data: UpdateInvoiceInput) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { companyId: true, state: true, invoiceType: true, amount: true, gstRate: true }
  });

  if (!invoice) {
    return { success: false, notFound: true, error: 'Invoice not found' };
  }

  const membership = await prisma.companyMember.findUnique({
    where: { userId_companyId: { userId, companyId: invoice.companyId } }
  });

  if (!membership || !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
    return { success: false, forbidden: true, error: 'You do not have permission to edit this invoice.' };
  }

  const company = await prisma.company.findUnique({ where: { id: invoice.companyId } });
  const companyState = (company?.state || '').trim().toLowerCase();
  const invoiceState = (data.state || invoice.state || '').trim().toLowerCase();
  const invType = data.invoiceType || invoice.invoiceType || 'B2B';

  const amountToUse = data.amount !== undefined ? Number(data.amount) : Number(invoice.amount);
  const gstRateToUse = data.gstRate !== undefined ? Number(data.gstRate) : Number(invoice.gstRate);

  const totalTax = (amountToUse * gstRateToUse) / 100;
  const isInterstate = invType === 'IMPORT' || (invoiceState && companyState && invoiceState !== companyState);

  const sgst = isInterstate ? 0 : totalTax / 2;
  const cgst = isInterstate ? 0 : totalTax / 2;
  const igst = isInterstate ? totalTax : 0;

  const updatePayload: any = {};
  if (data.invoiceNumber !== undefined) updatePayload.invoiceNumber = data.invoiceNumber;
  if (data.vendorName !== undefined) updatePayload.vendorName = data.vendorName;
  if (data.vendorGst !== undefined) updatePayload.vendorGst = data.vendorGst;
  if (data.amount !== undefined) updatePayload.amount = amountToUse;
  if (data.gstRate !== undefined) updatePayload.gstRate = gstRateToUse;
  if (data.invoiceDate !== undefined) updatePayload.invoiceDate = new Date(data.invoiceDate);
  if (data.state !== undefined) updatePayload.state = data.state;
  if (data.invoiceType !== undefined) updatePayload.invoiceType = invType;
  if (data.hsnCode !== undefined) updatePayload.hsnCode = data.hsnCode || null;
  if (data.notes !== undefined) updatePayload.notes = data.notes || null;

  updatePayload.sgst = sgst;
  updatePayload.cgst = cgst;
  updatePayload.igst = igst;
  updatePayload.totalTax = totalTax;

  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: updatePayload
  });

  try {
    if ((prisma as any).auditLog) {
      await (prisma as any).auditLog.create({
        data: { companyId: invoice.companyId, userId, action: 'UPDATE_INVOICE', details: `Updated invoice ${updatedInvoice.invoiceNumber}` }
      });
    }
  } catch (e) {}

  return { success: true, invoice: updatedInvoice };
};

export const getInvoicesByCompany = async (companyId: string) => {
  return await prisma.invoice.findMany({
    where: { companyId },
    orderBy: { invoiceDate: 'desc' }
  });
};

export const deleteInvoice = async (userId: string, invoiceId: string) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { companyId: true, invoiceNumber: true }
  });

  if (!invoice) {
    return { success: false, notFound: true, error: 'Invoice not found' };
  }

  const membership = await prisma.companyMember.findUnique({
    where: { userId_companyId: { userId, companyId: invoice.companyId } }
  });

  if (!membership || !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
    return { success: false, forbidden: true, error: 'You do not have permission to delete this invoice.' };
  }

  await prisma.invoice.delete({ where: { id: invoiceId } });

  try {
    if ((prisma as any).auditLog) {
      await (prisma as any).auditLog.create({
        data: { companyId: invoice.companyId, userId, action: 'DELETE_INVOICE', details: `Deleted invoice ${invoice.invoiceNumber}` }
      });
    }
  } catch (e) {}

  return { success: true };
};
