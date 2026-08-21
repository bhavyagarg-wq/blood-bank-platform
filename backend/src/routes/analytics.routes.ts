import { Router } from 'express';
import { BloodUnitStatus, MatchStatus, RequestStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { inventorySummary } from '../services/inventoryService';

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);

analyticsRouter.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const [
      hospitals,
      bloodBanks,
      donors,
      availableUnits,
      reservedUnits,
      expiredUnits,
      transfusedUnits,
      pendingRequests,
      fulfilledRequests,
      totalRequests,
      deliveredMatches,
    ] = await Promise.all([
      prisma.hospital.count({ where: { isActive: true } }),
      prisma.bloodBank.count({ where: { isActive: true } }),
      prisma.donor.count({ where: { isActive: true } }),
      prisma.bloodUnit.count({ where: { status: BloodUnitStatus.available } }),
      prisma.bloodUnit.count({ where: { status: BloodUnitStatus.reserved } }),
      prisma.bloodUnit.count({ where: { status: BloodUnitStatus.expired } }),
      prisma.bloodUnit.count({ where: { status: BloodUnitStatus.transfused } }),
      prisma.emergencyRequest.count({
        where: { status: { in: [RequestStatus.pending, RequestStatus.matched, RequestStatus.partial] } },
      }),
      prisma.emergencyRequest.count({ where: { status: RequestStatus.fulfilled } }),
      prisma.emergencyRequest.count(),
      prisma.match.count({ where: { status: MatchStatus.delivered } }),
    ]);

    const consumed = transfusedUnits + expiredUnits;

    res.json({
      hospitals,
      bloodBanks,
      donors,
      inventory: { availableUnits, reservedUnits, expiredUnits, transfusedUnits },
      requests: { pending: pendingRequests, fulfilled: fulfilledRequests, total: totalRequests },
      deliveredMatches,
      matchSuccessRate: totalRequests === 0 ? 0 : Number(((fulfilledRequests / totalRequests) * 100).toFixed(1)),
      inventoryUtilisationRate: consumed === 0 ? 0 : Number(((transfusedUnits / consumed) * 100).toFixed(1)),
    });
  }),
);

analyticsRouter.get(
  '/inventory-by-blood-type',
  asyncHandler(async (_req, res) => {
    res.json(await inventorySummary());
  }),
);

analyticsRouter.get(
  '/expiring-soon',
  asyncHandler(async (_req, res) => {
    const cutoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const items = await prisma.bloodUnit.findMany({
      where: { status: BloodUnitStatus.available, expiryDate: { lte: cutoff, gt: new Date() } },
      orderBy: { expiryDate: 'asc' },
      include: { bloodBank: { select: { id: true, name: true, city: true } } },
    });
    res.json(items);
  }),
);

analyticsRouter.get(
  '/match-performance',
  asyncHandler(async (_req, res) => {
    const matches = await prisma.match.findMany({
      where: { status: MatchStatus.delivered, actualTime: { not: null } },
      select: { score: true, actualTime: true, estimatedTime: true },
    });

    const average = (values: number[]) =>
      values.length === 0 ? 0 : Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));

    res.json({
      deliveredCount: matches.length,
      averageScore: average(matches.map((m) => m.score)),
      averageEstimatedMinutes: average(matches.map((m) => m.estimatedTime)),
      averageActualMinutes: average(matches.map((m) => m.actualTime as number)),
    });
  }),
);
