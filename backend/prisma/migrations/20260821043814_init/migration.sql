-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('A', 'B', 'AB', 'O');

-- CreateEnum
CREATE TYPE "RhFactor" AS ENUM ('positive', 'negative');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('hospital_admin', 'blood_bank_admin', 'donor', 'system_admin');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('eligible', 'deferred', 'ineligible');

-- CreateEnum
CREATE TYPE "DonationFrequency" AS ENUM ('weekly', 'biweekly', 'monthly', 'quarterly');

-- CreateEnum
CREATE TYPE "BloodUnitStatus" AS ENUM ('available', 'reserved', 'transfused', 'expired', 'quarantined');

-- CreateEnum
CREATE TYPE "TestingStatus" AS ENUM ('pending', 'complete', 'failed');

-- CreateEnum
CREATE TYPE "RequestPriority" AS ENUM ('critical', 'urgent', 'routine');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'matched', 'partial', 'fulfilled', 'cancelled');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('proposed', 'accepted', 'rejected', 'transit', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "TransportMethod" AS ENUM ('internal', 'external', 'hospital_pickup');

-- CreateEnum
CREATE TYPE "DonationType" AS ENUM ('whole_blood', 'platelets', 'plasma', 'red_blood_cells');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('scheduled', 'completed', 'deferred', 'cancelled');

-- CreateEnum
CREATE TYPE "InventoryAction" AS ENUM ('added', 'reserved', 'released', 'expired', 'transfused', 'quarantined');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "hospitalId" TEXT,
    "bloodBankId" TEXT,
    "donorId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emergencyContact" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodBank" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emergencyContact" TEXT NOT NULL,
    "totalCapacity" INTEGER NOT NULL DEFAULT 500,
    "currentUtilization" INTEGER NOT NULL DEFAULT 0,
    "opensAt" TEXT NOT NULL DEFAULT '08:00',
    "closesAt" TEXT NOT NULL DEFAULT '20:00',
    "openDays" TEXT[] DEFAULT ARRAY['mon', 'tue', 'wed', 'thu', 'fri', 'sat']::TEXT[],
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donor" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "rhFactor" "RhFactor" NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "lastDonationDate" TIMESTAMP(3),
    "totalDonations" INTEGER NOT NULL DEFAULT 0,
    "eligibilityStatus" "EligibilityStatus" NOT NULL DEFAULT 'eligible',
    "deferralReason" TEXT,
    "eligibilityDate" TIMESTAMP(3),
    "preferredBloodBankId" TEXT,
    "notifyByEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyBySms" BOOLEAN NOT NULL DEFAULT false,
    "notifyByPush" BOOLEAN NOT NULL DEFAULT false,
    "donationFrequency" "DonationFrequency" NOT NULL DEFAULT 'quarterly',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodUnit" (
    "id" TEXT NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "rhFactor" "RhFactor" NOT NULL,
    "bloodBankId" TEXT NOT NULL,
    "donorId" TEXT,
    "collectionDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "status" "BloodUnitStatus" NOT NULL DEFAULT 'available',
    "testingStatus" "TestingStatus" NOT NULL DEFAULT 'pending',
    "testHiv" BOOLEAN,
    "testHepatitisB" BOOLEAN,
    "testHepatitisC" BOOLEAN,
    "testSyphilis" BOOLEAN,
    "testNotes" TEXT,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 450,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "lastTemperatureCheck" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emergencyRequestId" TEXT,
    "shelf" TEXT NOT NULL DEFAULT 'A1',
    "refrigerator" TEXT NOT NULL DEFAULT 'R1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyRequest" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "doctorName" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "urgencyLevel" INTEGER NOT NULL,
    "requiredBy" TIMESTAMP(3) NOT NULL,
    "patientAge" INTEGER NOT NULL,
    "patientGender" "Gender" NOT NULL,
    "patientBloodType" "BloodType" NOT NULL,
    "patientRhFactor" "RhFactor" NOT NULL,
    "diagnosis" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodRequirement" (
    "id" TEXT NOT NULL,
    "emergencyRequestId" TEXT NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "rhFactor" "RhFactor" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priority" "RequestPriority" NOT NULL DEFAULT 'urgent',

    CONSTRAINT "BloodRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "emergencyRequestId" TEXT NOT NULL,
    "bloodUnitId" TEXT NOT NULL,
    "bloodBankId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "compatibilityScore" DOUBLE PRECISION NOT NULL,
    "distanceScore" DOUBLE PRECISION NOT NULL,
    "urgencyScore" DOUBLE PRECISION NOT NULL,
    "expiryScore" DOUBLE PRECISION NOT NULL,
    "bloodBankRating" DOUBLE PRECISION NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'proposed',
    "transportMethod" "TransportMethod" NOT NULL DEFAULT 'hospital_pickup',
    "estimatedTime" INTEGER NOT NULL,
    "actualTime" INTEGER,
    "trackingId" TEXT,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "bloodBankId" TEXT NOT NULL,
    "bloodUnitId" TEXT,
    "donationDate" TIMESTAMP(3) NOT NULL,
    "donationType" "DonationType" NOT NULL DEFAULT 'whole_blood',
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 450,
    "hemoglobin" DOUBLE PRECISION NOT NULL,
    "systolic" INTEGER NOT NULL,
    "diastolic" INTEGER NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "questionsPassed" BOOLEAN NOT NULL DEFAULT true,
    "status" "DonationStatus" NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLog" (
    "id" TEXT NOT NULL,
    "bloodBankId" TEXT NOT NULL,
    "bloodUnitId" TEXT NOT NULL,
    "action" "InventoryAction" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "performedBy" TEXT NOT NULL,
    "notes" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_licenseNumber_key" ON "Hospital"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BloodBank_licenseNumber_key" ON "BloodBank"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Donor_email_key" ON "Donor"("email");

-- CreateIndex
CREATE INDEX "Donor_bloodType_rhFactor_idx" ON "Donor"("bloodType", "rhFactor");

-- CreateIndex
CREATE INDEX "BloodUnit_status_testingStatus_idx" ON "BloodUnit"("status", "testingStatus");

-- CreateIndex
CREATE INDEX "BloodUnit_bloodType_rhFactor_idx" ON "BloodUnit"("bloodType", "rhFactor");

-- CreateIndex
CREATE INDEX "BloodUnit_bloodBankId_idx" ON "BloodUnit"("bloodBankId");

-- CreateIndex
CREATE INDEX "EmergencyRequest_status_idx" ON "EmergencyRequest"("status");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Match_emergencyRequestId_bloodUnitId_key" ON "Match"("emergencyRequestId", "bloodUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_bloodUnitId_key" ON "Donation"("bloodUnitId");

-- CreateIndex
CREATE INDEX "InventoryLog_bloodBankId_timestamp_idx" ON "InventoryLog"("bloodBankId", "timestamp");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_bloodBankId_fkey" FOREIGN KEY ("bloodBankId") REFERENCES "BloodBank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donor" ADD CONSTRAINT "Donor_preferredBloodBankId_fkey" FOREIGN KEY ("preferredBloodBankId") REFERENCES "BloodBank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnit" ADD CONSTRAINT "BloodUnit_bloodBankId_fkey" FOREIGN KEY ("bloodBankId") REFERENCES "BloodBank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnit" ADD CONSTRAINT "BloodUnit_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodUnit" ADD CONSTRAINT "BloodUnit_emergencyRequestId_fkey" FOREIGN KEY ("emergencyRequestId") REFERENCES "EmergencyRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyRequest" ADD CONSTRAINT "EmergencyRequest_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodRequirement" ADD CONSTRAINT "BloodRequirement_emergencyRequestId_fkey" FOREIGN KEY ("emergencyRequestId") REFERENCES "EmergencyRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_emergencyRequestId_fkey" FOREIGN KEY ("emergencyRequestId") REFERENCES "EmergencyRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_bloodUnitId_fkey" FOREIGN KEY ("bloodUnitId") REFERENCES "BloodUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_bloodBankId_fkey" FOREIGN KEY ("bloodBankId") REFERENCES "BloodBank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_bloodBankId_fkey" FOREIGN KEY ("bloodBankId") REFERENCES "BloodBank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_bloodUnitId_fkey" FOREIGN KEY ("bloodUnitId") REFERENCES "BloodUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_bloodBankId_fkey" FOREIGN KEY ("bloodBankId") REFERENCES "BloodBank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_bloodUnitId_fkey" FOREIGN KEY ("bloodUnitId") REFERENCES "BloodUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
