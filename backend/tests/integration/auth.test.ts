import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { TEST_PASSWORD, createHospital, createUser, resetDatabase } from '../helpers';

const app = createApp();

beforeAll(async () => {
  await resetDatabase();
  const hospital = await createHospital();
  await createUser({ email: 'hospital@test.example', role: 'hospital_admin', hospitalId: hospital.id });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/login', () => {
  it('issues a token for valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'hospital@test.example', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.role).toBe('hospital_admin');
    expect(res.body.user.hospitalId).toEqual(expect.any(String));
  });

  it('rejects a wrong password without leaking which field failed', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'hospital@test.example', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('validates the request body', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});

describe('GET /api/v1/auth/me', () => {
  it('requires a bearer token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the authenticated user', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'hospital@test.example', password: TEST_PASSWORD });

    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('hospital@test.example');
  });
});

describe('POST /api/v1/auth/register', () => {
  it('refuses a duplicate email', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'hospital@test.example',
      password: TEST_PASSWORD,
      name: 'Duplicate',
      role: 'donor',
    });
    expect(res.status).toBe(409);
  });
});
