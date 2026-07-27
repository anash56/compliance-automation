// src/services/companyService.ts

import { prisma } from '../server';

export const getUserCompanies = async (userId: string) => {
  const memberships = await prisma.companyMember.findMany({
    where: { userId, status: 'ACTIVE' },
    include: {
      company: {
        include: {
          members: {
            where: { status: 'ACTIVE' },
            include: {
              user: { select: { id: true, fullName: true, email: true } }
            }
          }
        }
      }
    }
  });

  return memberships.map(m => ({
    ...m.company,
    userRole: m.role
  }));
};

export const registerCompany = async (userId: string, data: { companyName: string; state: string; gstNumber?: string | null; pan?: string | null }) => {
  return await prisma.company.create({
    data: {
      userId,
      companyName: data.companyName,
      state: data.state,
      gstNumber: data.gstNumber || null,
      pan: data.pan || null,
      members: {
        create: {
          userId,
          role: 'OWNER',
          status: 'ACTIVE'
        }
      }
    }
  });
};

export const getCompanyWithMembership = async (companyId: string, userId: string) => {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      members: {
        include: {
          user: { select: { id: true, fullName: true, email: true } }
        }
      }
    }
  });

  if (!company) return null;
  const membership = company.members.find(m => m.userId === userId);
  return { ...company, userRole: membership?.role || 'VIEWER' };
};

export const updateCompanyProfile = async (companyId: string, updates: any) => {
  return await prisma.company.update({
    where: { id: companyId },
    data: updates
  });
};

export const removeCompanyWorkspace = async (companyId: string) => {
  return await prisma.company.delete({
    where: { id: companyId }
  });
};

export const getWorkspaceMembers = async (companyId: string) => {
  return await prisma.companyMember.findMany({
    where: { companyId, status: 'ACTIVE' },
    include: {
      user: { select: { id: true, fullName: true, email: true } }
    }
  });
};

export const addWorkspaceMember = async (companyId: string, userId: string, role: string) => {
  return await prisma.companyMember.create({
    data: { userId, companyId, role: role || 'VIEWER', status: 'ACTIVE' }
  });
};

export const removeWorkspaceMember = async (membershipId: string) => {
  return await prisma.companyMember.delete({
    where: { id: membershipId }
  });
};

export const compileDashboardStats = async (companyId: string, year: number) => {
  const yearStart = new Date(year, 3, 1);
  const yearEnd = new Date(year + 1, 3, 0, 23, 59, 59);

  const invoices = await prisma.invoice.findMany({
    where: { companyId, invoiceDate: { gte: yearStart, lte: yearEnd } }
  });

  const tdsRecords = await prisma.tDSRecord.findMany({
    where: { companyId, createdAt: { gte: yearStart, lte: yearEnd } }
  });

  const gstReturns = await prisma.gSTReturn.findMany({
    where: { companyId, year }
  });

  const tdsReturns = await prisma.tDSReturn.findMany({
    where: { companyId, year }
  });

  let upcomingDeadlines: any[] = [];
  if ((prisma as any).complianceTask) {
    upcomingDeadlines = await (prisma as any).complianceTask.findMany({
      where: { companyId, status: { not: 'completed' } },
      orderBy: { date: 'asc' }
    });
  }

  const totalInvoiceValue = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const totalGstCollected = invoices.reduce((sum, inv) => sum + Number(inv.totalTax), 0);
  const totalVendorPayments = tdsRecords.reduce((sum, rec) => sum + Number(rec.paymentAmount), 0);
  const totalTdsDeducted = tdsRecords.reduce((sum, rec) => sum + Number(rec.tdsDeducted), 0);
  const totalTdsDeposited = tdsReturns.reduce((sum, ret) => sum + Number(ret.totalTdsDeposited), 0);
  const gstReturnsFiled = gstReturns.filter(r => r.gstr3bStatus === 'filed').length;
  const tdsReturnsFiled = tdsReturns.filter(r => r.filingStatus === 'filed').length;

  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const monthlyData = months.map((monthName, idx) => {
    const calMonth = idx < 9 ? idx + 4 : idx - 8;
    const calYear = idx < 9 ? year : year + 1;

    const mInvoices = invoices.filter(inv => {
      const d = new Date(inv.invoiceDate);
      return d.getMonth() + 1 === calMonth && d.getFullYear() === calYear;
    });

    const mTds = tdsRecords.filter(rec => {
      const d = new Date(rec.createdAt);
      return d.getMonth() + 1 === calMonth && d.getFullYear() === calYear;
    });

    return {
      name: monthName,
      revenue: mInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0),
      tax: mInvoices.reduce((sum, inv) => sum + Number(inv.totalTax), 0),
      tds: mTds.reduce((sum, rec) => sum + Number(rec.tdsDeducted), 0)
    };
  });

  const auditLogs = await prisma.auditLog.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { user: { select: { fullName: true, email: true } } }
  });

  return {
    gstInvoiceCount: invoices.length,
    tdsRecordCount: tdsRecords.length,
    gstReturnsFiled,
    tdsReturnsFiled,
    totalInvoiceValue,
    totalGstCollected,
    totalVendorPayments,
    totalTdsDeducted,
    totalTdsDeposited,
    estimatedComplianceOutflow: totalGstCollected + totalTdsDeposited,
    upcomingDeadlines,
    monthlyData,
    auditLogs
  };
};
