// src/types/index.ts

export type UserRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | 'business_owner';
export type InvoiceType = 'B2B' | 'B2C' | 'IMPORT';
export type ReturnFilingStatus = 'pending' | 'filed' | 'overdue';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isEmailVerified?: boolean;
  isTwoFactorEnabled?: boolean;
}

export interface Company {
  id: string;
  userId: string;
  gstNumber?: string;
  companyName: string;
  state: string;
  pan?: string;
  employeesCount?: number;
  businessType?: string;
  createdAt: string;
  userRole?: UserRole;
}

export interface CompanyMember {
  id: string;
  companyId: string;
  userId: string;
  role: UserRole;
  status: 'ACTIVE' | 'INVITED';
  user: User;
}

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  vendorName: string;
  vendorGst?: string;
  amount: number;
  gstRate: number;
  sgst: number;
  cgst: number;
  igst: number;
  totalTax: number;
  invoiceDate: string;
  invoiceType: InvoiceType;
  state: string;
  hsnCode?: string;
  notes?: string;
}

export interface GSTReturn {
  id: string;
  companyId: string;
  month: number;
  year: number;
  gstr1Status: ReturnFilingStatus;
  gstr3bStatus: ReturnFilingStatus;
  totalSales: number;
  totalTaxLiability: number;
  inputCredit: number;
  netPayable: number;
  gstr1FiledDate?: string;
  gstr3bFiledDate?: string;
}

export interface TDSRecord {
  id: string;
  companyId: string;
  vendorName: string;
  vendorPan?: string;
  paymentDate: string;
  paymentAmount: number;
  tdsRate: number;
  tdsDeducted: number;
  paymentMade: number;
  category: string;
  quarter: number;
  year: number;
}

export interface TDSReturn {
  id: string;
  companyId: string;
  quarter: number;
  year: number;
  totalPayments: number;
  totalTdsDeducted: number;
  totalTdsDeposited: number;
  filingStatus: ReturnFilingStatus;
}

export interface DashboardStats {
  totalInvoices: number;
  totalSalesAmount: number;
  totalGSTTax: number;
  totalTDSDeducted: number;
  pendingFilingsCount: number;
  recentInvoices: Invoice[];
}