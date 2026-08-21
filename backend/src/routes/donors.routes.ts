import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { assertOwnership, authenticate, authorize } from '../middleware/auth';
import { donorSchema, idParamSchema, paginationSchema } from '../schemas';
import { checkEligibility } from '../services/eligibility';

export const donorsRouter = Router();

donorsRouter.use(authenticate);

donorsRouter.get(
  '/',
  authorize('system_admin', 'blood_bank_admin'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = paginationSchema.parse(req.query);
    const [items, total] = await Promise.all([
      prisma.donor.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { lastName: 'asc' },
      }),
      prisma.donor.count(),
    ]);
    res.json({ items, total, page, pageSize });
  }),
);

donorsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    if (req.auth!.role === 'donor') assertOwnership(req.auth!, id, 'donorId');

    const donor = await prisma.donor.findUnique({
      where: { id },
      include: { donations: { orderBy: { donationDate: 'desc' }, take: 10 } },
    });
    if (!donor) throw notFound('Donor not found');
    res.json(donor);
  }),
);

donorsRouter.get(
  '/:id/eligibility',
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    if (req.auth!.role === 'donor') assertOwnership(req.auth!, id, 'donorId');

    const donor = await prisma.donor.findUnique({ where: { id } });
    if (!donor) throw notFound('Donor not found');

    res.json(
      checkEligibility({
        dateOfBirth: donor.dateOfBirth,
        weight: donor.weight,
        lastDonationDate: donor.lastDonationDate,
      }),
    );
  }),
);

donorsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = donorSchema.parse(req.body);
    const donor = await prisma.donor.create({ data: body });
    res.status(201).json(donor);
  }),
);

donorsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    if (req.auth!.role === 'donor') assertOwnership(req.auth!, id, 'donorId');

    const body = donorSchema.partial().parse(req.body);
    const donor = await prisma.donor.update({ where: { id }, data: body });
    res.json(donor);
  }),
);
