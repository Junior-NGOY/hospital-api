/*
  Warnings:

  - You are about to drop the `DoctorProcedureFee` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FinancialStatistics` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `HospitalizationPackage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MedicalProcedure` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DoctorProcedureFee" DROP CONSTRAINT "DoctorProcedureFee_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "DoctorProcedureFee" DROP CONSTRAINT "DoctorProcedureFee_procedureId_fkey";

-- DropForeignKey
ALTER TABLE "FinancialStatistics" DROP CONSTRAINT "FinancialStatistics_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "FinancialStatistics" DROP CONSTRAINT "FinancialStatistics_hospitalId_fkey";

-- DropForeignKey
ALTER TABLE "admissions" DROP CONSTRAINT "admissions_packageId_fkey";

-- AlterTable
ALTER TABLE "vitalsigns" ALTER COLUMN "nurseId" DROP NOT NULL;

-- DropTable
DROP TABLE "DoctorProcedureFee";

-- DropTable
DROP TABLE "FinancialStatistics";

-- DropTable
DROP TABLE "HospitalizationPackage";

-- DropTable
DROP TABLE "MedicalProcedure";

-- CreateTable
CREATE TABLE "doctor_procedure_fees" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "doctor_procedure_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_procedures" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "complexity" "ProcedureComplexity" NOT NULL DEFAULT 'MEDIUM',
    "duration" INTEGER,

    CONSTRAINT "medical_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospitalization_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER NOT NULL,
    "roomCategory" "RoomCategory" NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "includedServices" TEXT[],
    "excludedServices" TEXT[],
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "hospitalization_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_statistics" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "departmentId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "privateRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subscriberRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consultationCount" INTEGER NOT NULL DEFAULT 0,
    "privateConsultations" INTEGER NOT NULL DEFAULT 0,
    "subscriberConsultations" INTEGER NOT NULL DEFAULT 0,
    "admissionCount" INTEGER NOT NULL DEFAULT 0,
    "privateAdmissions" INTEGER NOT NULL DEFAULT 0,
    "subscriberAdmissions" INTEGER NOT NULL DEFAULT 0,
    "newSubscriptions" INTEGER NOT NULL DEFAULT 0,
    "renewedSubscriptions" INTEGER NOT NULL DEFAULT 0,
    "subscriptionRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "financial_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doctor_procedure_fees_doctorId_procedureId_key" ON "doctor_procedure_fees"("doctorId", "procedureId");

-- CreateIndex
CREATE UNIQUE INDEX "medical_procedures_code_key" ON "medical_procedures"("code");

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "hospitalization_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_procedure_fees" ADD CONSTRAINT "doctor_procedure_fees_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_procedure_fees" ADD CONSTRAINT "doctor_procedure_fees_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "medical_procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_statistics" ADD CONSTRAINT "financial_statistics_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_statistics" ADD CONSTRAINT "financial_statistics_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
