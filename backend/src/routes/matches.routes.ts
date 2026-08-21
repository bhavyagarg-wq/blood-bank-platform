import { Request, Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { forbidden, notFound } from '../lib/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { idParamSchema, matchStatusSchema, paginationSchema } from '../schemas';
import { acceptMatch, rejectMatch, updateMatchStatus } from '../services/matchingService';

export const matchesRouter = Router();

matchesRouter.use(authenticate);

const listQuerySchema = paginationSchema.extend({
  status: z.enum(['proposed', 'accepted', 'rejected', 'transit', 'delivered', 'cancelled']).optional(),
  emergencyRequestId: z.string().uuid().optional(),
});

matchesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const auth = req.auth!;

    const where: Prisma.MatchWhereInput = {
      status: query.status,
      emergencyRequestId: query.emergencyRequestId,
      hospitalId: auth.role === 'hospital_admin' ? auth.hospitalId ?? undefined : undefined,
      bloodBankId: auth.role === 'blood_bank_admin' ? auth.bloodBankId ?? undefined : undefined,
    };

    const [items, total] = await Promise.all([
      prisma.match.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { score: 'desc' },
        include: {
          bloodUnit: true,
          bloodBank: { select: { id: true, name: true, city: true } },
          hospital: { select: { id: true, name: true, city: true } },
          emergencyRequest: { select: { id: true, urgencyLevel: true, requiredBy: true, status: true } },
        },
      }),
      prisma.match.count({ where }),
    ]);

    res.json({ items, total, page: query.page, pageSize: query.pageSize });
  }),
);

async function assertMatchParticipant(matchId: string, req: Request): Promise<void> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw notFound('Match not found');

  const auth = req.auth!;
  if (auth.role === 'system_admin') return;
  if (auth.role === 'hospital_admin' && match.hospitalId === auth.hospitalId) return;
  if (auth.role === 'blood_bank_admin' && match.bloodBankId === auth.bloodBankId) return;
  throw forbidden('You are not a participant in this match');
}

matchesRouter.post(
  '/:id/accept',
  authorize('system_admin', 'blood_bank_admin', 'hospital_admin'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await assertMatchParticipant(id, req);
    res.json(await acceptMatch(id, req.auth!.userId));
  }),
);

matchesRouter.post(
  '/:id/reject',
  authorize('system_admin', 'blood_bank_admin', 'hospital_admin'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await assertMatchParticipant(id, req);
    res.json(await rejectMatch(id));
  }),
);

matchesRouter.patch(
  '/:id/status',
  authorize('system_admin', 'blood_bank_admin', 'hospital_admin'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const body = matchStatusSchema.parse(req.body);
    await assertMatchParticipant(id, req);
    res.json(await updateMatchStatus(id, body.status, req.auth!.userId));
  }),
);
