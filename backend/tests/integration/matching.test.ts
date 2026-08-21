import request from 'supertest';
import { BloodType, RhFactor, TestingStatus } from '@prisma/client';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import {
  TEST_PASSWORD,
  createBloodBank,
  createHospital,
  createUnit,
  createUser,
  resetDatabase,
} from '../helpers';

const app = createApp();

let hospitalToken = '';
let bankToken = '';
let bloodBankId = '';
let nearUnitId = '';

async function login(email: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });
  return res.body.token;
}

function newRequestPayload(overrides: Record<string, unknown> = {}) {
  return {
    requestedBy: { doctorName: 'Dr. Test', department: 'Trauma', contactNumber: '+91-80-5555-5555' },
    bloodRequirements: [{ bloodType: 'A', rhFactor: 'positive', quantity: 1, priority: 'critical' }],
    urgency: { level: 1, requiredBy: new Date(Date.now() + 3600_000).toISOString() },
    patientInfo: { age: 35, gender: 'male', bloodType: 'A', rhFactor: 'positive' },
    ...overrides,
  };
}

beforeAll(async () => {
  await resetDatabase();

  const hospital = await createHospital();
  const nearBank = await createBloodBank('Near Bank', 'B-NEAR', { latitude: 12.9698, longitude: 77.6034 });
  const farBank = await createBloodBank('Far Bank', 'B-FAR', { latitude: 12.9141, longitude: 74.856 });
  bloodBankId = nearBank.id;

  await createUser({ email: 'hospital@test.example', role: 'hospital_admin', hospitalId: hospital.id });
  await createUser({ email: 'bank@test.example', role: 'blood_bank_admin', bloodBankId: nearBank.id });

  nearUnitId = (await createUnit({ bloodBankId: nearBank.id })).id;
  await createUnit({ bloodBankId: nearBank.id, bloodType: BloodType.O, rhFactor: RhFactor.negative });
  await createUnit({ bloodBankId: farBank.id });
  await createUnit({ bloodBankId: nearBank.id, testingStatus: TestingStatus.pending });

  hospitalToken = await login('hospital@test.example');
  bankToken = await login('bank@test.example');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('emergency request matching', () => {
  it('proposes ranked matches on creation and skips unreachable or untested stock', async () => {
    const res = await request(app)
      .post('/api/v1/emergency-requests')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send(newRequestPayload());

    expect(res.status).toBe(201);
    const matches = res.body.matches;
    expect(matches).toHaveLength(2);
    expect(matches[0].bloodUnitId).toBe(nearUnitId);
    expect(matches[0].compatibilityScore).toBe(100);
    expect(matches[1].compatibilityScore).toBe(80);
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
    expect(matches.every((match: { bloodBankId: string }) => match.bloodBankId === bloodBankId)).toBe(true);
    expect(res.body.request.status).toBe('pending');
  });

  it('rejects a required-by date in the past', async () => {
    const res = await request(app)
      .post('/api/v1/emergency-requests')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send(newRequestPayload({ urgency: { level: 1, requiredBy: new Date(Date.now() - 1000).toISOString() } }));

    expect(res.status).toBe(400);
  });

  it('forbids blood bank admins from raising requests', async () => {
    const res = await request(app)
      .post('/api/v1/emergency-requests')
      .set('Authorization', `Bearer ${bankToken}`)
      .send(newRequestPayload());

    expect(res.status).toBe(403);
  });
});

describe('accepting a match', () => {
  it('reserves the unit, cancels competing proposals and fulfils the request', async () => {
    const created = await request(app)
      .post('/api/v1/emergency-requests')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send(newRequestPayload());

    const requestId = created.body.request.id;
    const topMatch = created.body.matches[0];

    const accepted = await request(app)
      .post(`/api/v1/matches/${topMatch.id}/accept`)
      .set('Authorization', `Bearer ${bankToken}`);

    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('accepted');

    const unit = await prisma.bloodUnit.findUnique({ where: { id: topMatch.bloodUnitId } });
    expect(unit?.status).toBe('reserved');
    expect(unit?.emergencyRequestId).toBe(requestId);

    const emergencyRequest = await prisma.emergencyRequest.findUnique({ where: { id: requestId } });
    expect(emergencyRequest?.status).toBe('fulfilled');

    const log = await prisma.inventoryLog.findFirst({
      where: { bloodUnitId: topMatch.bloodUnitId, action: 'reserved' },
    });
    expect(log).not.toBeNull();

    // The same unit had been proposed to the earlier request too.
    const competing = await prisma.match.findMany({
      where: { bloodUnitId: topMatch.bloodUnitId, id: { not: topMatch.id } },
    });
    expect(competing.every((match) => match.status === 'cancelled')).toBe(true);
  });

  it('refuses to accept a match twice', async () => {
    const match = await prisma.match.findFirst({ where: { status: 'accepted' } });
    const res = await request(app)
      .post(`/api/v1/matches/${match!.id}/accept`)
      .set('Authorization', `Bearer ${bankToken}`);

    expect(res.status).toBe(400);
  });

  it('moves an accepted match through transit to delivered and transfuses the unit', async () => {
    const match = await prisma.match.findFirst({ where: { status: 'accepted' } });

    const transit = await request(app)
      .patch(`/api/v1/matches/${match!.id}/status`)
      .set('Authorization', `Bearer ${bankToken}`)
      .send({ status: 'transit' });
    expect(transit.status).toBe(200);

    const delivered = await request(app)
      .patch(`/api/v1/matches/${match!.id}/status`)
      .set('Authorization', `Bearer ${bankToken}`)
      .send({ status: 'delivered' });
    expect(delivered.status).toBe(200);
    expect(delivered.body.actualTime).toEqual(expect.any(Number));

    const unit = await prisma.bloodUnit.findUnique({ where: { id: match!.bloodUnitId } });
    expect(unit?.status).toBe('transfused');
  });

  it('rejects an invalid status transition', async () => {
    const match = await prisma.match.findFirst({ where: { status: 'delivered' } });
    const res = await request(app)
      .patch(`/api/v1/matches/${match!.id}/status`)
      .set('Authorization', `Bearer ${bankToken}`)
      .send({ status: 'transit' });

    expect(res.status).toBe(400);
  });
});
