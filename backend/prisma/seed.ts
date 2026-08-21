import bcrypt from 'bcryptjs';
import { BloodType, PrismaClient, RhFactor, TestingStatus } from '@prisma/client';

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

async function main(): Promise<void> {
  // Seeding is destructive so it stays repeatable during development.
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

  const cityHospital = await prisma.hospital.create({
    data: {
      name: 'City General Hospital',
      licenseNumber: 'HOSP-001',
      street: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      zipCode: '560001',
      latitude: 12.9716,
      longitude: 77.5946,
      phone: '+91-80-1000-0001',
      email: 'contact@citygeneral.example',
      emergencyContact: '+91-80-1000-0911',
      rating: 4.5,
    },
  });

  const lakeviewHospital = await prisma.hospital.create({
    data: {
      name: 'Lakeview Multispeciality',
      licenseNumber: 'HOSP-002',
      street: '5 Lake Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      zipCode: '560034',
      latitude: 12.9279,
      longitude: 77.6271,
      phone: '+91-80-1000-0002',
      email: 'contact@lakeview.example',
      emergencyContact: '+91-80-1000-0912',
      rating: 4.2,
    },
  });

  const centralBank = await prisma.bloodBank.create({
    data: {
      name: 'Central Blood Bank',
      licenseNumber: 'BB-001',
      street: '44 Residency Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      zipCode: '560025',
      latitude: 12.9698,
      longitude: 77.6034,
      phone: '+91-80-2000-0001',
      email: 'central@bloodbank.example',
      emergencyContact: '+91-80-2000-0911',
      totalCapacity: 800,
      rating: 4.8,
    },
  });

  const southBank = await prisma.bloodBank.create({
    data: {
      name: 'South City Blood Bank',
      licenseNumber: 'BB-002',
      street: '9 Bannerghatta Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      zipCode: '560076',
      latitude: 12.8916,
      longitude: 77.5983,
      phone: '+91-80-2000-0002',
      email: 'south@bloodbank.example',
      emergencyContact: '+91-80-2000-0912',
      totalCapacity: 400,
      rating: 4.1,
    },
  });

  const farBank = await prisma.bloodBank.create({
    data: {
      name: 'Coastal Regional Blood Bank',
      licenseNumber: 'BB-003',
      street: '1 Beach Road',
      city: 'Mangaluru',
      state: 'Karnataka',
      zipCode: '575001',
      latitude: 12.9141,
      longitude: 74.856,
      phone: '+91-824-2000-0003',
      email: 'coastal@bloodbank.example',
      emergencyContact: '+91-824-2000-0913',
      totalCapacity: 300,
      rating: 3.9,
    },
  });

  const donor = await prisma.donor.create({
    data: {
      firstName: 'Asha',
      lastName: 'Rao',
      dateOfBirth: new Date('1995-04-12'),
      gender: 'female',
      bloodType: BloodType.O,
      rhFactor: RhFactor.negative,
      phone: '+91-90000-00001',
      email: 'asha.rao@example.com',
      street: '18 Church Street',
      city: 'Bengaluru',
      state: 'Karnataka',
      zipCode: '560001',
      latitude: 12.9754,
      longitude: 77.6047,
      weight: 62,
      totalDonations: 3,
      lastDonationDate: daysFromNow(-120),
      preferredBloodBankId: centralBank.id,
    },
  });

  const secondDonor = await prisma.donor.create({
    data: {
      firstName: 'Vikram',
      lastName: 'Nair',
      dateOfBirth: new Date('1990-09-02'),
      gender: 'male',
      bloodType: BloodType.A,
      rhFactor: RhFactor.positive,
      phone: '+91-90000-00002',
      email: 'vikram.nair@example.com',
      street: '77 Jayanagar 4th Block',
      city: 'Bengaluru',
      state: 'Karnataka',
      zipCode: '560011',
      latitude: 12.925,
      longitude: 77.5938,
      weight: 78,
      totalDonations: 6,
      lastDonationDate: daysFromNow(-200),
      preferredBloodBankId: southBank.id,
    },
  });

  const passwordHash = await bcrypt.hash('Password123!', 10);
  await prisma.user.createMany({
    data: [
      { email: 'admin@bloodbank.example', name: 'System Admin', role: 'system_admin', passwordHash },
      {
        email: 'hospital@citygeneral.example',
        name: 'City General Admin',
        role: 'hospital_admin',
        passwordHash,
        hospitalId: cityHospital.id,
      },
      {
        email: 'hospital@lakeview.example',
        name: 'Lakeview Admin',
        role: 'hospital_admin',
        passwordHash,
        hospitalId: lakeviewHospital.id,
      },
      {
        email: 'bank@central.example',
        name: 'Central Bank Admin',
        role: 'blood_bank_admin',
        passwordHash,
        bloodBankId: centralBank.id,
      },
      {
        email: 'bank@south.example',
        name: 'South Bank Admin',
        role: 'blood_bank_admin',
        passwordHash,
        bloodBankId: southBank.id,
      },
      { email: 'asha.rao@example.com', name: 'Asha Rao', role: 'donor', passwordHash, donorId: donor.id },
      {
        email: 'vikram.nair@example.com',
        name: 'Vikram Nair',
        role: 'donor',
        passwordHash,
        donorId: secondDonor.id,
      },
    ],
  });

  const stock: Array<[string, BloodType, RhFactor, number, number]> = [
    // [bloodBankId, type, rh, unit count, days until expiry]
    [centralBank.id, BloodType.O, RhFactor.negative, 4, 30],
    [centralBank.id, BloodType.O, RhFactor.positive, 8, 25],
    [centralBank.id, BloodType.A, RhFactor.positive, 6, 18],
    [centralBank.id, BloodType.B, RhFactor.positive, 5, 12],
    [centralBank.id, BloodType.AB, RhFactor.positive, 2, 6],
    [southBank.id, BloodType.O, RhFactor.positive, 5, 35],
    [southBank.id, BloodType.A, RhFactor.negative, 3, 20],
    [southBank.id, BloodType.B, RhFactor.negative, 2, 9],
    [farBank.id, BloodType.O, RhFactor.negative, 6, 40],
    [farBank.id, BloodType.AB, RhFactor.negative, 3, 28],
  ];

  for (const [bloodBankId, bloodType, rhFactor, count, expiresInDays] of stock) {
    for (let index = 0; index < count; index += 1) {
      await prisma.bloodUnit.create({
        data: {
          bloodBankId,
          bloodType,
          rhFactor,
          collectionDate: daysFromNow(expiresInDays - 42),
          expiryDate: daysFromNow(expiresInDays),
          testingStatus: TestingStatus.complete,
          testHiv: false,
          testHepatitisB: false,
          testHepatitisC: false,
          testSyphilis: false,
          shelf: `S${(index % 4) + 1}`,
          refrigerator: `R${(index % 2) + 1}`,
        },
      });
    }
  }

  for (const bank of [centralBank, southBank, farBank]) {
    const currentUtilization = await prisma.bloodUnit.count({ where: { bloodBankId: bank.id } });
    await prisma.bloodBank.update({ where: { id: bank.id }, data: { currentUtilization } });
  }

  await prisma.emergencyRequest.create({
    data: {
      hospitalId: cityHospital.id,
      doctorName: 'Dr. Meera Iyer',
      department: 'Trauma',
      contactNumber: '+91-80-1000-0500',
      urgencyLevel: 2,
      requiredBy: new Date(Date.now() + 2 * 60 * 60 * 1000),
      patientAge: 34,
      patientGender: 'male',
      patientBloodType: BloodType.A,
      patientRhFactor: RhFactor.positive,
      diagnosis: 'Road traffic accident with major blood loss',
      requirements: {
        create: [{ bloodType: BloodType.A, rhFactor: RhFactor.positive, quantity: 3, priority: 'critical' }],
      },
    },
  });

  console.log('Seed complete. All demo accounts use the password: Password123!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
