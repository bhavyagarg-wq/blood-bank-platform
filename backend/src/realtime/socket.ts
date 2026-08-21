import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { verifyToken } from '../middleware/auth';
import { attachSocketServer } from './bus';
import { ROOM } from './events';

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error('Missing auth token'));
      return;
    }
    try {
      socket.data.auth = verifyToken(token);
      next();
    } catch {
      next(new Error('Invalid auth token'));
    }
  });

  io.on('connection', (socket) => {
    const auth = socket.data.auth;
    if (auth.hospitalId) socket.join(ROOM.hospital(auth.hospitalId));
    if (auth.bloodBankId) socket.join(ROOM.bloodBank(auth.bloodBankId));
    if (auth.donorId) socket.join(ROOM.donor(auth.donorId));
    if (auth.role === 'system_admin') socket.join(ROOM.admin());

    logger.info(`Socket connected: ${auth.userId} (${auth.role})`);
    socket.emit('connected', { rooms: [...socket.rooms].filter((room) => room !== socket.id) });

    socket.on('disconnect', () => logger.info(`Socket disconnected: ${auth.userId}`));
  });

  attachSocketServer(io);
  return io;
}
