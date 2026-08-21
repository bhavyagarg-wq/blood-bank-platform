import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { assertOwnership, authenticate, authorize } from '../middleware/auth';
import { bloodBankSchema, idParamSchema, paginationSchema } from '../schemas';
import { inventorySummary } from '../services/inventoryService';

export const bloodBanksRouter = Router();

bloodBanksRouter.use(authenticate);

bloodBanksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = paginationSchema.parse(req.query);
    const [items, total] = await Promise.all([
      prisma.bloodBank.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
      }),
      prisma.bloodBank.count(),
    ]);
    res.json({ items, total, page, pageSize });
  }),
);

bloodBanksRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const bloodBank = await prisma.bloodBank.findUnique({ where: { id } });
    if (!bloodBank) throw notFound('Blood bank not found');
    res.json(bloodBank);
  }),
);

bloodBanksRouter.get(
  '/:id/inventory-summary',
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json(await inventorySummary(id));
  }),
);

bloodBanksRouter.post(
  '/',
  authorize('system_admin'),
  asyncHandler(async (req, res) => {
    const body = bloodBankSchema.parse(req.body);
    const bloodBank = await prisma.bloodBank.create({
      data: {
        name: body.name,
        licenseNumber: body.licenseNumber,
        ...body.address,
        ...body.contact,
        totalCapacity: body.totalCapacity,
        opensAt: body.opensAt,
        closesAt: body.closesAt,
        openDays: body.openDays,
        rating: body.rating,
      },
    });
    res.status(201).json(bloodBank);
  }),
);

bloodBanksRouter.patch(
  '/:id',
  authorize('system_admin', 'blood_bank_admin'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    assertOwnership(req.auth!, id, 'bloodBankId');

    const body = bloodBankSchema.partial().parse(req.body);
    const bloodBank = await prisma.bloodBank.update({
      where: { id },
      data: {
        name: body.name,
        licenseNumber: body.licenseNumber,
        ...(body.address ?? {}),
        ...(body.contact ?? {}),
        totalCapacity: body.totalCapacity,
        opensAt: body.opensAt,
        closesAt: body.closesAt,
        openDays: body.openDays,
        rating: body.rating,
      },
    });
    res.json(bloodBank);
  }),
);
