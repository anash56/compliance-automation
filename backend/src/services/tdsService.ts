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
  userId?: string;
}

export interface UpdateTDSRecordInput {
  vendorName?: string;
  vendorPan?: string | null;
  paymentDate: Date;
  paymentAmount: number;
  category: TDSCategory;
  quarter: number;
  year: number;
  userId: string;
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
}

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
    const {
      companyId,
      vendorName,
      vendorPan,
      paymentDate,
      paymentAmount,
      category,
      quarter,
      year,
      userId
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

    try {
      if ((prisma as any).complianceTask) {
        const qTaskExists = await (prisma as any).complianceTask.findFirst({ where: { companyId, type: 'TDS Return', quarter, year } });
        if (!qTaskExists) {
          let dueDate = new Date();
          if (quarter === 1) dueDate = new Date(year, 6, 31);
          else if (quarter === 2) dueDate = new Date(year, 9, 31);
          else if (quarter === 3) dueDate = new Date(year + 1, 0, 31);
          else if (quarter === 4) dueDate = new Date(year + 1, 4, 31);

          await (prisma as any).complianceTask.create({
            data: { companyId, type: 'TDS Return', desc: `Form 26Q (Q${quarter} FY${year}-${String(year + 1).slice(2)})`, date: dueDate, color: 'purple', status: 'pending', quarter, year }
          });
        }

        const m = paymentDate.getMonth() + 1;
        const calYear = paymentDate.getFullYear();
        const nextM = m === 12 ? 1 : m + 1;
        const nextY = m === 12 ? calYear + 1 : calYear;
        const monthName = paymentDate.toLocaleString('default', { month: 'short' });
        const pTaskExists = await (prisma as any).complianceTask.findFirst({ where: { companyId, type: 'TDS Payment', month: m, year: calYear } });

        if (!pTaskExists) {
          await (prisma as any).complianceTask.create({
            data: { companyId, type: 'TDS Payment', desc: `TDS Payment (${monthName} ${calYear})`, date: new Date(nextY, nextM - 1, 7), color: 'red', status: 'pending', month: m, year: calYear }
          });
        }
      }

      if (userId && (prisma as any).auditLog) {
        await (prisma as any).auditLog.create({
          data: { companyId, userId, action: 'CREATE_TDS', details: `Recorded TDS payment for ${vendorName} (INR ${paymentAmount})` }
        });
      }
    } catch (e) {
      console.warn('Task/Audit skipped');
    }

    return tdsRecord;
  }

  /**
   * Update TDS record with authorization check & audit log
   */
  async updateTDSRecord(id: string, input: UpdateTDSRecordInput) {
    const record = await prisma.tDSRecord.findUnique({ where: { id } });
    if (!record) return { success: false, notFound: true, error: 'TDS record not found' };

    const membership = await prisma.companyMember.findUnique({
      where: { userId_companyId: { userId: input.userId, companyId: record.companyId } }
    });

    if (!membership || !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
      return { success: false, forbidden: true, error: 'You do not have permission to edit this record.' };
    }

    const rate = this.getRate(input.category);
    const tdsDeducted = (Number(input.paymentAmount) * rate) / 100;
    const paymentMade = Number(input.paymentAmount) - tdsDeducted;

    const updatedRecord = await prisma.tDSRecord.update({
      where: { id },
      data: {
        vendorName: input.vendorName,
        vendorPan: input.vendorPan || null,
        paymentDate: input.paymentDate,
        paymentAmount: new Decimal(input.paymentAmount),
        category: input.category,
        quarter: input.quarter,
        year: input.year,
        tdsRate: rate,
        tdsDeducted: new Decimal(tdsDeducted),
        paymentMade: new Decimal(paymentMade)
      }
    });

    try {
      if ((prisma as any).auditLog) {
        await (prisma as any).auditLog.create({
          data: { companyId: record.companyId, userId: input.userId, action: 'UPDATE_TDS', details: `Updated TDS payment for ${input.vendorName || record.vendorName}` }
        });
      }
    } catch (e) {}

    return { success: true, record: updatedRecord };
  }

  /**
   * Delete TDS record with authorization check & audit log
   */
  async deleteTDSRecord(id: string, userId: string) {
    const record = await prisma.tDSRecord.findUnique({
      where: { id },
      select: { companyId: true, vendorName: true }
    });

    if (!record) return { success: false, notFound: true, error: 'TDS record not found' };

    const membership = await prisma.companyMember.findUnique({
      where: { userId_companyId: { userId, companyId: record.companyId } }
    });

    if (!membership || !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
      return { success: false, forbidden: true, error: 'You do not have permission to delete this record.' };
    }

    await prisma.tDSRecord.delete({ where: { id } });

    try {
      if ((prisma as any).auditLog) {
        await (prisma as any).auditLog.create({
          data: { companyId: record.companyId, userId, action: 'DELETE_TDS', details: `Deleted TDS payment for ${record.vendorName}` }
        });
      }
    } catch (e) {}

    return { success: true };
  }

  /**
   * Generate Form 26Q for a quarter
   */
  async generateForm26Q(companyId: string, quarter: number, year: number) {
    const tdsRecords = await prisma.tDSRecord.findMany({
      where: { companyId, quarter, year }
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
    return await prisma.tDSReturn.upsert({
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
  }

  /**
   * Get all TDS returns for a company
   */
  async getTDSReturns(companyId: string) {
    return await prisma.tDSReturn.findMany({
      where: { companyId },
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }]
    });
  }

  /**
   * Get TDS records for a quarter
   */
  async getTDSRecords(companyId: string, quarter?: number, year?: number) {
    const where = quarter && year ? { companyId, quarter, year } : { companyId };

    return await prisma.tDSRecord.findMany({
      where,
      orderBy: { paymentDate: 'desc' }
    });
  }

  /**
   * Mark Form 26Q as filed and update compliance task
   */
  async markForm26QAsFiled(companyId: string, quarter: number, year: number) {
    const tdsReturn = await prisma.tDSReturn.update({
      where: {
        companyId_quarter_year: { companyId, quarter, year }
      },
      data: {
        filingStatus: 'submitted',
        filedDate: new Date()
      }
    });

    try {
      if ((prisma as any).complianceTask) {
        await (prisma as any).complianceTask.updateMany({
          where: { companyId, type: 'TDS Return', quarter, year },
          data: { status: 'completed' }
        });
      }
    } catch (e) {}

    return tdsReturn;
  }

  /**
   * Get dashboard stats for TDS
   */
  async getDashboardStats(companyId: string) {
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
  }
}

export default new TDSService();
