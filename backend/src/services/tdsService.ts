// src/services/tdsService.ts

import { prisma } from '../server';
import { Decimal } from '@prisma/client/runtime/library';

// TDS rates for different categories
export const TDS_RATES = {
  services: 10,
  goods: 15,
  commission: 10,
  rent: 10,
  other: 10
} as const;

export type TDSCategory = keyof typeof TDS_RATES;

export interface CreateTDSRecordInput {
  companyId: string;
  vendorName: string;
  vendorPan?: string;
  paymentDate: Date;
  paymentAmount: number;
  category: TDSCategory;
  quarter: number;
  year: number;
}

export interface Form26QData {
  quarter: number;
  year: number;
  totalPayments: number;
  totalTdsDeducted: number;
  vendorCount: number;
  vendors: Array<{
    name: string;
    pan: string | null;
    amount: number;
    tdsDeducted: number;
    category: string;
  }>;
  status: string;
};

export class TDSService {
  getRate(category: string): number {
    return TDS_RATES[category as TDSCategory] ?? TDS_RATES.other;
  }

  /**
   * Calculate TDS for a vendor payment
   */
  calculateTDS(amount: number, category: string): number {
    return Math.round(((amount * this.getRate(category)) / 100) * 100) / 100;
  }

  /**
   * Create TDS record
   */
  async createTDSRecord(input: CreateTDSRecordInput) {
    try {
      const {
        companyId,
        vendorName,
        vendorPan,
        paymentDate,
        paymentAmount,
        category,
        quarter,
        year
      } = input;
      const tdsRate = this.getRate(category);
      const tdsDeducted = this.calculateTDS(paymentAmount, category);
      const paymentMade = Math.round((paymentAmount - tdsDeducted) * 100) / 100;

      const tdsRecord = await prisma.tDSRecord.create({
        data: {
          companyId,
          vendorName,
          vendorPan: vendorPan || null,
          paymentDate,
          paymentAmount: new Decimal(paymentAmount),
          tdsRate,
          tdsDeducted: new Decimal(tdsDeducted),
          paymentMade: new Decimal(paymentMade),
          category,
          quarter,
          year
        }
      });

      return tdsRecord;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate Form 26Q for a quarter
   */
  async generateForm26Q(companyId: string, quarter: number, year: number) {
    try {
      const tdsRecords = await prisma.tDSRecord.findMany({
        where: {
          companyId,
          quarter,
          year
        }
      });

      const totalPayments = tdsRecords.reduce((sum, r) => sum + Number(r.paymentAmount), 0);
      const totalTdsDeducted = tdsRecords.reduce((sum, r) => sum + Number(r.tdsDeducted), 0);

      const vendors = tdsRecords.map(r => ({
        name: r.vendorName,
        pan: r.vendorPan,
        amount: Number(r.paymentAmount),
        tdsDeducted: Number(r.tdsDeducted),
        category: r.category
      }));

      return {
        quarter,
        year,
        totalPayments: Math.round(totalPayments * 100) / 100,
        totalTdsDeducted: Math.round(totalTdsDeducted * 100) / 100,
        vendorCount: tdsRecords.length,
        vendors,
        status: 'generated'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Save TDS return (Form 26Q)
   */
  async saveTDSReturn(
    companyId: string,
    quarter: number,
    year: number,
    form26qData: Form26QData,
    totalTdsDeposited: number
  ) {
    try {
      const tdsReturn = await prisma.tDSReturn.upsert({
        where: {
          companyId_quarter_year: { companyId, quarter, year }
        },
        update: {
          totalPayments: new Decimal(form26qData.totalPayments),
          totalTdsDeducted: new Decimal(form26qData.totalTdsDeducted),
          totalTdsDeposited: new Decimal(totalTdsDeposited)
        },
        create: {
          companyId,
          quarter,
          year,
          totalPayments: new Decimal(form26qData.totalPayments),
          totalTdsDeducted: new Decimal(form26qData.totalTdsDeducted),
          totalTdsDeposited: new Decimal(totalTdsDeposited)
        }
      });

      return tdsReturn;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all TDS returns for a company
   */
  async getTDSReturns(companyId: string) {
    try {
      const returns = await prisma.tDSReturn.findMany({
        where: { companyId },
        orderBy: [{ year: 'desc' }, { quarter: 'desc' }]
      });

      return returns;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get TDS records for a quarter
   */
  async getTDSRecords(companyId: string, quarter?: number, year?: number) {
    try {
      const where = quarter && year ? { companyId, quarter, year } : { companyId };

      const records = await prisma.tDSRecord.findMany({
        where,
        orderBy: { paymentDate: 'desc' }
      });

      return records;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark Form 26Q as filed
   */
  async markForm26QAsFiled(companyId: string, quarter: number, year: number) {
    try {
      const tdsReturn = await prisma.tDSReturn.update({
        where: {
          companyId_quarter_year: { companyId, quarter, year }
        },
        data: {
          filingStatus: 'submitted',
          filedDate: new Date()
        }
      });

      return tdsReturn;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get dashboard stats for TDS
   */
  async getDashboardStats(companyId: string) {
    try {
      const tdsRecords = await prisma.tDSRecord.findMany({
        where: { companyId }
      });

      const totalPayments = tdsRecords.reduce((sum, r) => sum + Number(r.paymentAmount), 0);
      const totalTdsDeducted = tdsRecords.reduce((sum, r) => sum + Number(r.tdsDeducted), 0);

      const tdsReturns = await prisma.tDSReturn.findMany({
        where: { companyId }
      });

      const filedCount = tdsReturns.filter(r => r.filingStatus === 'submitted').length;

      return {
        totalPayments: Math.round(totalPayments * 100) / 100,
        totalTdsDeducted: Math.round(totalTdsDeducted * 100) / 100,
        vendorCount: tdsRecords.length,
        tdsReturnsFiled: filedCount,
        tdsReturnsDraft: tdsReturns.length - filedCount
      };
    } catch (error) {
      throw error;
    }
  }
}

export default new TDSService();
