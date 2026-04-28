export interface User {
id: string;
email: string;
fullName: string;
role: string;
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
invoiceType: string;
state: string;
hsnCode?: string;
notes?: string;
}
export interface GSTReturn {
id: string;
companyId: string;
month: number;
year: number;
gstr1Status: string;
gstr3bStatus: string;
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
filingStatus: string;
}