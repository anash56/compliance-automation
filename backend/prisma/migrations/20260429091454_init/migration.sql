-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'business_owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gstNumber" TEXT,
    "companyName" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pan" TEXT,
    "employeesCount" INTEGER,
    "businessType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorGst" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "gstRate" INTEGER NOT NULL,
    "sgst" DECIMAL(15,2) NOT NULL,
    "cgst" DECIMAL(15,2) NOT NULL,
    "igst" DECIMAL(15,2) NOT NULL,
    "totalTax" DECIMAL(15,2) NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "invoiceType" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "hsnCode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GSTReturn" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "gstr1Status" TEXT NOT NULL DEFAULT 'draft',
    "gstr3bStatus" TEXT NOT NULL DEFAULT 'draft',
    "gstr1FiledDate" TIMESTAMP(3),
    "gstr3bFiledDate" TIMESTAMP(3),
    "totalSales" DECIMAL(15,2) NOT NULL,
    "totalTaxLiability" DECIMAL(15,2) NOT NULL,
    "inputCredit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GSTReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TDSRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorPan" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentAmount" DECIMAL(15,2) NOT NULL,
    "tdsRate" INTEGER NOT NULL,
    "tdsDeducted" DECIMAL(15,2) NOT NULL,
    "paymentMade" DECIMAL(15,2) NOT NULL,
    "category" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TDSRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TDSReturn" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalPayments" DECIMAL(15,2) NOT NULL,
    "totalTdsDeducted" DECIMAL(15,2) NOT NULL,
    "totalTdsDeposited" DECIMAL(15,2) NOT NULL,
    "filingStatus" TEXT NOT NULL DEFAULT 'draft',
    "filedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TDSReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceDeadline" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "complianceType" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceDeadline_pkey" PRIMARY KEY ("id")
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

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GSTReturn" ADD CONSTRAINT "GSTReturn_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSRecord" ADD CONSTRAINT "TDSRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSReturn" ADD CONSTRAINT "TDSReturn_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDeadline" ADD CONSTRAINT "ComplianceDeadline_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
