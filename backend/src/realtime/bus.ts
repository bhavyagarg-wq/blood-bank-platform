import type { Server } from 'socket.io';
import { ROOM } from './events';
import { logger } from '../lib/logger';

let io: Server | null = null;

export function attachSocketServer(server: Server): void {
  io = server;
}

export function detachSocketServer(): void {
  io = null;
}

function emit(room: string, event: string, payload: unknown): void {
  if (!io) {
    logger.warn(`Socket server not attached; dropped "${event}" for ${room}`);
    return;
  }
  io.to(room).emit(event, payload);
}

export const realtime = {
  toHospital: (hospitalId: string, event: string, payload: unknown) =>
    emit(ROOM.hospital(hospitalId), event, payload),
  toBloodBank: (bloodBankId: string, event: string, payload: unknown) =>
    emit(ROOM.bloodBank(bloodBankId), event, payload),
  toDonor: (donorId: string, event: string, payload: unknown) => emit(ROOM.donor(donorId), event, payload),
  toAdmins: (event: string, payload: unknown) => emit(ROOM.admin(), event, payload),
};
