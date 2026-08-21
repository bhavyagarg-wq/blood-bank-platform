import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { createSocketServer } from './realtime/socket';
import { expireStaleUnits } from './services/inventoryService';

const ONE_HOUR_MS = 60 * 60 * 1000;

const app = createApp();
const httpServer = createServer(app);
createSocketServer(httpServer);

httpServer.listen(env.port, () => {
  logger.info(`API listening on http://localhost:${env.port}`);
});

const expirySweep = setInterval(() => {
  expireStaleUnits().catch((error) => logger.error('Expiry sweep failed', error));
}, ONE_HOUR_MS);

function shutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down`);
  clearInterval(expirySweep);
  httpServer.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
