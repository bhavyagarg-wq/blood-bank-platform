import { createServer, Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import { Server } from 'socket.io';
import { io as createClient, Socket } from 'socket.io-client';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { detachSocketServer } from '../../src/realtime/bus';
import { EVENT } from '../../src/realtime/events';
import { createSocketServer } from '../../src/realtime/socket';
import { TEST_PASSWORD, createBloodBank, createUser, daysFromNow, resetDatabase } from '../helpers';

const app = createApp();

let httpServer: HttpServer;
let socketServer: Server;
let url = '';
let bankToken = '';
let bloodBankId = '';

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

beforeAll(async () => {
  await resetDatabase();
  const bank = await createBloodBank('Realtime Bank', 'B-RT');
  bloodBankId = bank.id;
  await createUser({ email: 'rt@bank.test', role: 'blood_bank_admin', bloodBankId: bank.id });

  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'rt@bank.test', password: TEST_PASSWORD });
  bankToken = login.body.token;

  httpServer = createServer(app);
  socketServer = createSocketServer(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  detachSocketServer();
  await socketServer.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await prisma.$disconnect();
});

describe('websocket authentication', () => {
  it('refuses a connection without a token', async () => {
    const client = createClient(url, { transports: ['websocket'] });
    const error = await waitForEvent<Error>(client, 'connect_error');
    expect(error.message).toBe('Missing auth token');
    client.close();
  });

  it('refuses a connection with an invalid token', async () => {
    const client = createClient(url, { transports: ['websocket'], auth: { token: 'nonsense' } });
    const error = await waitForEvent<Error>(client, 'connect_error');
    expect(error.message).toBe('Invalid auth token');
    client.close();
  });
});

describe('inventory broadcasts', () => {
  it('pushes an inventory_updated event to the owning blood bank room', async () => {
    const client = createClient(url, { transports: ['websocket'], auth: { token: bankToken } });
    const joined = await waitForEvent<{ rooms: string[] }>(client, 'connected');
    expect(joined.rooms).toContain(`bloodbank:${bloodBankId}`);

    const updates = waitForEvent<{ unitId: string; status: string }>(client, EVENT.inventoryUpdated);

    const created = await request(app)
      .post('/api/v1/blood-units')
      .set('Authorization', `Bearer ${bankToken}`)
      .send({
        bloodType: 'A',
        rhFactor: 'positive',
        bloodBankId,
        collectionDate: daysFromNow(-1).toISOString(),
        expiryDate: daysFromNow(41).toISOString(),
      });

    const payload = await updates;
    expect(payload.unitId).toBe(created.body.id);
    expect(payload.status).toBe('available');

    client.close();
  });
});
