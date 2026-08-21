import express, { Express } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './routes/auth.routes';
import { hospitalsRouter } from './routes/hospitals.routes';
import { bloodBanksRouter } from './routes/bloodBanks.routes';
import { donorsRouter } from './routes/donors.routes';
import { bloodUnitsRouter } from './routes/bloodUnits.routes';
import { requestsRouter } from './routes/requests.routes';
import { matchesRouter } from './routes/matches.routes';
import { donationsRouter } from './routes/donations.routes';
import { analyticsRouter } from './routes/analytics.routes';

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/hospitals', hospitalsRouter);
  app.use('/api/v1/blood-banks', bloodBanksRouter);
  app.use('/api/v1/donors', donorsRouter);
  app.use('/api/v1/blood-units', bloodUnitsRouter);
  app.use('/api/v1/emergency-requests', requestsRouter);
  app.use('/api/v1/matches', matchesRouter);
  app.use('/api/v1/donations', donationsRouter);
  app.use('/api/v1/analytics', analyticsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
