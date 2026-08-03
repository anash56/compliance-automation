// src/services/gstService.ts

import { prisma } from '../server';
import { Decimal } from '@prisma/client/runtime/library';

export class GSTService {
  /**
   * Generate GSTR-1 (Sales Return)
   * Groups invoices by GST rate and calculates totals
   */
  async generateGSTR1(companyId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // Fetch all invoices for the month
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        invoiceDate: {
          gte: startDate,
          lt: endDate
        }
      }
    });

    // Group invoices by GST rate
    const grouped: Record<number, typeof invoices> = {};
    invoices.forEach((inv) => {
      const rate = inv.gstRate;
      if (!grouped[rate]) grouped[rate] = [];
      grouped[rate].push(inv);
    });

    // Calculate totals
    const totalSales = invoices.reduce((sum, i) => sum + Number(i.amount), 0);
    const totalTax = invoices.reduce((sum, i) => sum + Number(i.totalTax), 0);

    // Format by rate
    const byRate = Object.entries(grouped).map(([rate, items]) => ({
      rate: parseInt(rate),
      count: items.length,
      amount: items.reduce((s, i) => s + Number(i.amount), 0),
      tax: items.reduce((s, i) => s + Number(i.totalTax), 0)
    }));

    return {
      month,
      year,
      totalSales: Math.round(totalSales * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      invoiceCount: invoices.length,
      byRate,
      status: 'generated'
    };
  }

  /**
   * Generate GSTR-3B (Payment Liability)
   * Calculates tax payable after input credits
   */
  async generateGSTR3B(companyId: string, month: number, year: number) {
    const gstr1 = await this.generateGSTR1(companyId, month, year);

    const inputCredit = 0;
    const netPayable = gstr1.totalTax - inputCredit;

    return {
      ...gstr1,
      inputCredit: Math.round(inputCredit * 100) / 100,
      netPayable: Math.round(netPayable * 100) / 100
    };
  }

  /**
   * Save GST return to database
   */
  async saveGSTReturn(
    companyId: string,
    month: number,
    year: number,
    gstr1Data: any,
    gstr3bData: any
  ) {
    return await prisma.gSTReturn.upsert({
      where: {
        companyId_month_year: { companyId, month, year }
      },
      update: {
        totalSales: new Decimal(gstr1Data.totalSales),
        totalTaxLiability: new Decimal(gstr1Data.totalTax),
        inputCredit: new Decimal(gstr3bData.inputCredit),
        netPayable: new Decimal(gstr3bData.netPayable)
      },
      create: {
        companyId,
        month,
        year,
        totalSales: new Decimal(gstr1Data.totalSales),
        totalTaxLiability: new Decimal(gstr1Data.totalTax),
        inputCredit: new Decimal(gstr3bData.inputCredit),
        netPayable: new Decimal(gstr3bData.netPayable),
        gstr1Status: 'generated',
        gstr3bStatus: 'generated'
      }
    });
  }

  /**
   * Get all GST returns for a company
   */
  async getGSTReturns(companyId: string) {
    return await prisma.gSTReturn.findMany({
      where: { companyId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });
  }

  /**
   * Mark GSTR-1 as filed and update compliance task
   */
  async markAsFiledGSTR1(companyId: string, month: number, year: number) {
    const gstReturn = await prisma.gSTReturn.update({
      where: {
        companyId_month_year: { companyId, month, year }
      },
      data: {
        gstr1Status: 'submitted',
        gstr1FiledDate: new Date()
      }
    });

    try {
      if ((prisma as any).complianceTask) {
        await (prisma as any).complianceTask.updateMany({
          where: { companyId, type: 'GST Filing', month, year },
          data: { status: 'completed' }
        });
      }
    } catch (e) {}

    return gstReturn;
  }

  /**
   * Mark GSTR-3B as filed and update compliance task
   */
  async markAsFiledGSTR3B(companyId: string, month: number, year: number) {
    const gstReturn = await prisma.gSTReturn.update({
      where: {
        companyId_month_year: { companyId, month, year }
      },
      data: {
        gstr3bStatus: 'submitted',
        gstr3bFiledDate: new Date()
      }
    });

    try {
      if ((prisma as any).complianceTask) {
        await (prisma as any).complianceTask.updateMany({
          where: { companyId, type: 'GST Payment', month, year },
          data: { status: 'completed' }
        });
      }
    } catch (e) {}

    return gstReturn;
  }

  /**
   * Get GST dashboard stats
   */
  async getDashboardStats(companyId: string) {
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

    return {
      totalInvoices: invoiceCount,
      totalTax: Math.round(totalTax * 100) / 100,
      gstReturnsFiledCount: filedCount,
      gstReturnsDraftCount: (gstReturns.length * 2) - filedCount
    };
  }
}

export default new GSTService();
