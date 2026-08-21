import { Router } from 'express';
import { BloodUnitStatus, Prisma, TestingStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { assertOwnership, authenticate, authorize } from '../middleware/auth';
import {
  bloodTypeSchema,
  bloodUnitSchema,
  idParamSchema,
  paginationSchema,
  rhFactorSchema,
  testResultSchema,
  unitStatusSchema,
} from '../schemas';
import {
  changeUnitStatus,
  expireStaleUnits,
  inventorySummary,
  registerBloodUnit,
} from '../services/inventoryService';
import { z } from 'zod';

export const bloodUnitsRouter = Router();

bloodUnitsRouter.use(authenticate);

const listQuerySchema = paginationSchema.extend({
  bloodBankId: z.string().uuid().optional(),
  bloodType: bloodTypeSchema.optional(),
  rhFactor: rhFactorSchema.optional(),
  status: z.enum(['available', 'reserved', 'transfused', 'expired', 'quarantined']).optional(),
});

bloodUnitsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const where: Prisma.BloodUnitWhereInput = {
      bloodBankId: query.bloodBankId,
      bloodType: query.bloodType,
      rhFactor: query.rhFactor,
      status: query.status,
    };

    const [items, total] = await Promise.all([
      prisma.bloodUnit.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { expiryDate: 'asc' },
        include: { bloodBank: { select: { id: true, name: true, city: true } } },
      }),
      prisma.bloodUnit.count({ where }),
    ]);

    res.json({ items, total, page: query.page, pageSize: query.pageSize });
  }),
);

bloodUnitsRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const bloodBankId = z.string().uuid().optional().parse(req.query.bloodBankId);
    res.json(await inventorySummary(bloodBankId));
  }),
);

bloodUnitsRouter.post(
  '/',
  authorize('system_admin', 'blood_bank_admin'),
  asyncHandler(async (req, res) => {
    const body = bloodUnitSchema.parse(req.body);
    assertOwnership(req.auth!, body.bloodBankId, 'bloodBankId');

    if (body.expiryDate <= body.collectionDate) {
      throw badRequest('expiryDate must be after collectionDate');
    }

    const unit = await registerBloodUnit(body, req.auth!.userId);
    res.status(201).json(unit);
  }),
);

bloodUnitsRouter.post(
  '/:id/test-results',
  authorize('system_admin', 'blood_bank_admin'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const body = testResultSchema.parse(req.body);

    const existing = await prisma.bloodUnit.findUnique({ where: { id } });
    if (!existing) throw notFound('Blood unit not found');
    assertOwnership(req.auth!, existing.bloodBankId, 'bloodBankId');

    const anyPositive = body.hiv || body.hepatitisB || body.hepatitisC || body.syphilis;

    const unit = await prisma.bloodUnit.update({
      where: { id },
      data: {
        testHiv: body.hiv,
        testHepatitisB: body.hepatitisB,
        testHepatitisC: body.hepatitisC,
        testSyphilis: body.syphilis,
        testNotes: body.notes,
        testingStatus: anyPositive ? TestingStatus.failed : TestingStatus.complete,
      },
    });

    if (anyPositive) {
      await changeUnitStatus(id, BloodUnitStatus.quarantined, req.auth!.userId, {
        notes: 'Quarantined after a reactive screening result',
      });
    }

    res.json(unit);
  }),
);

bloodUnitsRouter.patch(
  '/:id/status',
  authorize('system_admin', 'blood_bank_admin'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const body = unitStatusSchema.parse(req.body);

    const existing = await prisma.bloodUnit.findUnique({ where: { id } });
    if (!existing) throw notFound('Blood unit not found');
    assertOwnership(req.auth!, existing.bloodBankId, 'bloodBankId');

    res.json(await changeUnitStatus(id, body.status, req.auth!.userId, { notes: body.notes }));
  }),
);

bloodUnitsRouter.post(
  '/expire-sweep',
  authorize('system_admin'),
  asyncHandler(async (req, res) => {
    res.json({ expired: await expireStaleUnits(req.auth!.userId) });
  }),
);
