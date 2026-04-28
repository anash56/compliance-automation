// src/services/gstService.ts

import { prisma } from '../server';
import { Decimal } from '@prisma/client/runtime/library';

export class GSTService {
  /**
   * Generate GSTR-1 (Sales Return)
   * Groups invoices by GST rate and calculates totals
   */
  async generateGSTR1(companyId: string, month: number, year: number) {
    try {
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate GSTR-3B (Payment Liability)
   * Calculates tax payable after input credits
   */
  async generateGSTR3B(companyId: string, month: number, year: number) {
    try {
      const gstr1 = await this.generateGSTR1(companyId, month, year);

      // Assume 30% input credit from purchases (simplified)
      const inputCredit = gstr1.totalTax * 0.3;
      const netPayable = gstr1.totalTax - inputCredit;

      return {
        ...gstr1,
        inputCredit: Math.round(inputCredit * 100) / 100,
        netPayable: Math.round(netPayable * 100) / 100
      };
    } catch (error) {
      throw error;
    }
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
    try {
      const gstReturn = await prisma.gSTReturn.upsert({
        where: {
          companyId_month_year: { companyId, month, year }
        },
        update: {
          totalSales: new Decimal(gstr1Data.totalSales),
          totalTaxLiability: new Decimal(gstr1Data.totalTax),
          inputCredit: new Decimal(gstr3bData.inputCredit),
          netPayable: new Decimal(gstr3bData.netPayable),
          gstr1Status: 'generated',
          gstr3bStatus: 'generated'
        },
        create: {
          companyId,
          month,
          year,
          totalSales: new Decimal(gstr1Data.totalSales),
          totalTaxLiability: new Decimal(gstr1Data.totalTax),
          inputCredit: new Decimal(gstr3bData.inputCredit),
          netPayable: new Decimal(gstr3bData.netPayable)
        }
      });

      return gstReturn;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all GST returns for a company
   */
  async getGSTReturns(companyId: string) {
    try {
      const returns = await prisma.gSTReturn.findMany({
        where: { companyId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
      });

      return returns;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark GST return as filed
   */
  async markAsFiledGSTR1(companyId: string, month: number, year: number) {
    try {
      const gstReturn = await prisma.gSTReturn.update({
        where: {
          companyId_month_year: { companyId, month, year }
        },
        data: {
          gstr1Status: 'submitted',
          gstr1FiledDate: new Date()
        }
      });

      return gstReturn;
    } catch (error) {
      throw error;
    }
  }

  async markAsFiledGSTR3B(companyId: string, month: number, year: number) {
    try {
      const gstReturn = await prisma.gSTReturn.update({
        where: {
          companyId_month_year: { companyId, month, year }
        },
        data: {
          gstr3bStatus: 'submitted',
          gstr3bFiledDate: new Date()
        }
      });

      return gstReturn;
    } catch (error) {
      throw error;
    }
  }
}

export default new GSTService();