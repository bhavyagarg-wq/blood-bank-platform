import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import {
  TEST_PASSWORD,
  createBloodBank,
  createDonor,
  createUnit,
  createUser,
  daysFromNow,
  resetDatabase,
} from '../helpers';

const app = createApp();

let bankToken = '';
let otherBankToken = '';
let bloodBankId = '';
let otherBloodBankId = '';
let donorId = '';

async function login(email: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });
  return res.body.token;
}

beforeAll(async () => {
  await resetDatabase();

  const bank = await createBloodBank('Bank One', 'B-ONE');
  const otherBank = await createBloodBank('Bank Two', 'B-TWO', { latitude: 12.8916, longitude: 77.5983 });
  bloodBankId = bank.id;
  otherBloodBankId = otherBank.id;

  await createUser({ email: 'one@bank.test', role: 'blood_bank_admin', bloodBankId: bank.id });
  await createUser({ email: 'two@bank.test', role: 'blood_bank_admin', bloodBankId: otherBank.id });

  donorId = (await createDonor()).id;

  bankToken = await login('one@bank.test');
  otherBankToken = await login('two@bank.test');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('blood unit registration', () => {
  it('records the unit and writes an inventory log entry', async () => {
    const res = await request(app)
      .post('/api/v1/blood-units')
      .set('Authorization', `Bearer ${bankToken}`)
      .send({
        bloodType: 'O',
        rhFactor: 'negative',
        bloodBankId,
        donorId,
        collectionDate: daysFromNow(-1).toISOString(),
        expiryDate: daysFromNow(41).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('available');
    expect(res.body.testingStatus).toBe('pending');

    const log = await prisma.inventoryLog.findFirst({ where: { bloodUnitId: res.body.id } });
    expect(log?.action).toBe('added');

    const bank = await prisma.bloodBank.findUnique({ where: { id: bloodBankId } });
    expect(bank?.currentUtilization).toBe(1);
  });

  it('refuses an expiry date before the collection date', async () => {
    const res = await request(app)
      .post('/api/v1/blood-units')
      .set('Authorization', `Bearer ${bankToken}`)
      .send({
        bloodType: 'O',
        rhFactor: 'negative',
        bloodBankId,
        collectionDate: daysFromNow(5).toISOString(),
        expiryDate: daysFromNow(1).toISOString(),
      });

    expect(res.status).toBe(400);
  });

  it("blocks an admin from adding stock to another bank's inventory", async () => {
    const res = await request(app)
      .post('/api/v1/blood-units')
      .set('Authorization', `Bearer ${otherBankToken}`)
      .send({
        bloodType: 'O',
        rhFactor: 'negative',
        bloodBankId,
        collectionDate: daysFromNow(-1).toISOString(),
        expiryDate: daysFromNow(41).toISOString(),
      });

    expect(res.status).toBe(403);
  });
});

describe('screening results', () => {
  it('marks a clean unit as tested and available', async () => {
    const unit = await createUnit({ bloodBankId, testingStatus: 'pending' });

    const res = await request(app)
      .post(`/api/v1/blood-units/${unit.id}/test-results`)
      .set('Authorization', `Bearer ${bankToken}`)
      .send({ hiv: false, hepatitisB: false, hepatitisC: false, syphilis: false });

    expect(res.status).toBe(200);
    expect(res.body.testingStatus).toBe('complete');
    expect(res.body.status).toBe('available');
  });

  it('quarantines a unit with a reactive result', async () => {
    const unit = await createUnit({ bloodBankId, testingStatus: 'pending' });

    const res = await request(app)
      .post(`/api/v1/blood-units/${unit.id}/test-results`)
      .set('Authorization', `Bearer ${bankToken}`)
      .send({ hiv: true, hepatitisB: false, hepatitisC: false, syphilis: false });

    expect(res.status).toBe(200);
    expect(res.body.testingStatus).toBe('failed');

    const stored = await prisma.bloodUnit.findUnique({ where: { id: unit.id } });
    expect(stored?.status).toBe('quarantined');
  });
});

describe('expiry sweep', () => {
  it('expires units past their expiry date', async () => {
    await createUnit({ bloodBankId: otherBloodBankId, expiresInDays: -1 });
    await createUser({ email: 'admin@test.example', role: 'system_admin' });
    const adminToken = await login('admin@test.example');

    const res = await request(app)
      .post('/api/v1/blood-units/expire-sweep')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.expired).toBeGreaterThanOrEqual(1);

    const remaining = await prisma.bloodUnit.count({
      where: { expiryDate: { lt: new Date() }, status: 'available' },
    });
    expect(remaining).toBe(0);
  });
});

describe('inventory summary', () => {
  it('groups available and reserved stock by blood group', async () => {
    const res = await request(app)
      .get('/api/v1/blood-units/summary')
      .query({ bloodBankId })
      .set('Authorization', `Bearer ${bankToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const oNegative = res.body.find(
      (row: { bloodType: string; rhFactor: string }) => row.bloodType === 'O' && row.rhFactor === 'negative',
    );
    expect(oNegative.available).toBeGreaterThanOrEqual(1);
  });
});
