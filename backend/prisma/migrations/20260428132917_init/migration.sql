-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'business_owner',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gstNumber" TEXT,
    "companyName" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pan" TEXT,
    "employeesCount" INTEGER,
    "businessType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Company_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorGst" TEXT,
    "amount" REAL NOT NULL,
    "gstRate" INTEGER NOT NULL,
    "sgst" REAL NOT NULL,
    "cgst" REAL NOT NULL,
    "igst" REAL NOT NULL,
    "totalTax" REAL NOT NULL,
    "invoiceDate" DATETIME NOT NULL,
    "invoiceType" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "hsnCode" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GSTReturn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "gstr1Status" TEXT NOT NULL DEFAULT 'draft',
    "gstr3bStatus" TEXT NOT NULL DEFAULT 'draft',
    "gstr1FiledDate" DATETIME,
    "gstr3bFiledDate" DATETIME,
    "totalSales" REAL NOT NULL,
    "totalTaxLiability" REAL NOT NULL,
    "inputCredit" REAL NOT NULL DEFAULT 0,
    "netPayable" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GSTReturn_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TDSRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorPan" TEXT,
    "paymentDate" DATETIME NOT NULL,
    "paymentAmount" REAL NOT NULL,
    "tdsRate" INTEGER NOT NULL,
    "tdsDeducted" REAL NOT NULL,
    "paymentMade" REAL NOT NULL,
    "category" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TDSRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TDSReturn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalPayments" REAL NOT NULL,
    "totalTdsDeducted" REAL NOT NULL,
    "totalTdsDeposited" REAL NOT NULL,
    "filingStatus" TEXT NOT NULL DEFAULT 'draft',
    "filedDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TDSReturn_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplianceDeadline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "complianceType" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completedDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ComplianceDeadline_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_gstNumber_key" ON "Company"("gstNumber");

-- CreateIndex
CREATE INDEX "Company_userId_idx" ON "Company"("userId");

-- CreateIndex
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");

-- CreateIndex
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");

-- CreateIndex
CREATE INDEX "GSTReturn_companyId_idx" ON "GSTReturn"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "GSTReturn_companyId_month_year_key" ON "GSTReturn"("companyId", "month", "year");

-- CreateIndex
CREATE INDEX "TDSRecord_companyId_idx" ON "TDSRecord"("companyId");

-- CreateIndex
CREATE INDEX "TDSRecord_quarter_year_idx" ON "TDSRecord"("quarter", "year");

-- CreateIndex
CREATE INDEX "TDSReturn_companyId_idx" ON "TDSReturn"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "TDSReturn_companyId_quarter_year_key" ON "TDSReturn"("companyId", "quarter", "year");

-- CreateIndex
CREATE INDEX "ComplianceDeadline_companyId_idx" ON "ComplianceDeadline"("companyId");

-- CreateIndex
CREATE INDEX "ComplianceDeadline_dueDate_idx" ON "ComplianceDeadline"("dueDate");
