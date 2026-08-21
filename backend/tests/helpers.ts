import bcrypt from 'bcryptjs';
import { BloodType, RhFactor, TestingStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';

export const DAY_MS = 86_400_000;
export const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

export async function resetDatabase(): Promise<void> {
  await prisma.inventoryLog.deleteMany();
  await prisma.match.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.bloodUnit.deleteMany();
  await prisma.bloodRequirement.deleteMany();
  await prisma.emergencyRequest.deleteMany();
  await prisma.user.deleteMany();
  await prisma.donor.deleteMany();
  await prisma.bloodBank.deleteMany();
  await prisma.hospital.deleteMany();
}

export const TEST_PASSWORD = 'Password123!';

export async function createHospital(name = 'Test Hospital', licenseNumber = 'H-TEST-1') {
  return prisma.hospital.create({
    data: {
      name,
      licenseNumber,
      street: '1 Main Street',
      city: 'Bengaluru',
      state: 'Karnataka',
      zipCode: '560001',
      latitude: 12.9716,
      longitude: 77.5946,
      phone: '+91-80-1111-1111',
      email: `${licenseNumber.toLowerCase()}@hospital.test`,
      emergencyContact: '+91-80-1111-9111',
      rating: 4.5,
    },
  });
}

export async function createBloodBank(
  name = 'Test Blood Bank',
  licenseNumber = 'B-TEST-1',
  coordinates = { latitude: 12.9698, longitude: 77.6034 },
) {
  return prisma.bloodBank.create({
    data: {
      name,
      licenseNumber,
      street: '2 Bank Street',
      city: 'Bengaluru',
      state: 'Karnataka',
      zipCode: '560025',
      ...coordinates,
      phone: '+91-80-2222-2222',
      email: `${licenseNumber.toLowerCase()}@bank.test`,
      emergencyContact: '+91-80-2222-9222',
      rating: 4.5,
    },
  });
}

export async function createDonor(email = 'donor@test.example', bloodType: BloodType = BloodType.O) {
  return prisma.donor.create({
    data: {
      firstName: 'Test',
      lastName: 'Donor',
      dateOfBirth: new Date('1995-01-01'),
      gender: 'female',
      bloodType,
      rhFactor: RhFactor.negative,
      phone: '+91-90000-11111',
      email,
      street: '3 Donor Lane',
      city: 'Bengaluru',
      state: 'Karnataka',
      zipCode: '560001',
      latitude: 12.9754,
      longitude: 77.6047,
      weight: 62,
    },
  });
}

export async function createUser(options: {
  email: string;
  role: 'system_admin' | 'hospital_admin' | 'blood_bank_admin' | 'donor';
  hospitalId?: string;
  bloodBankId?: string;
  donorId?: string;
}) {
  return prisma.user.create({
    data: {
      email: options.email,
      name: options.email,
      role: options.role,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
      hospitalId: options.hospitalId ?? null,
      bloodBankId: options.bloodBankId ?? null,
      donorId: options.donorId ?? null,
    },
  });
}

export async function createUnit(options: {
  bloodBankId: string;
  bloodType?: BloodType;
  rhFactor?: RhFactor;
  expiresInDays?: number;
  testingStatus?: TestingStatus;
}) {
  const expiresInDays = options.expiresInDays ?? 20;
  return prisma.bloodUnit.create({
    data: {
      bloodBankId: options.bloodBankId,
      bloodType: options.bloodType ?? BloodType.A,
      rhFactor: options.rhFactor ?? RhFactor.positive,
      collectionDate: daysFromNow(expiresInDays - 42),
      expiryDate: daysFromNow(expiresInDays),
      testingStatus: options.testingStatus ?? TestingStatus.complete,
      testHiv: false,
      testHepatitisB: false,
      testHepatitisC: false,
      testSyphilis: false,
    },
  });
}
