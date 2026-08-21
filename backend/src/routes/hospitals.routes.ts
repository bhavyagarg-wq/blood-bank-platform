import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { assertOwnership, authenticate, authorize } from '../middleware/auth';
import { hospitalSchema, idParamSchema, paginationSchema } from '../schemas';

export const hospitalsRouter = Router();

hospitalsRouter.use(authenticate);

hospitalsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = paginationSchema.parse(req.query);
    const [items, total] = await Promise.all([
      prisma.hospital.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
      }),
      prisma.hospital.count(),
    ]);
    res.json({ items, total, page, pageSize });
  }),
);

hospitalsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const hospital = await prisma.hospital.findUnique({ where: { id } });
    if (!hospital) throw notFound('Hospital not found');
    res.json(hospital);
  }),
);

hospitalsRouter.post(
  '/',
  authorize('system_admin'),
  asyncHandler(async (req, res) => {
    const body = hospitalSchema.parse(req.body);
    const hospital = await prisma.hospital.create({
      data: {
        name: body.name,
        licenseNumber: body.licenseNumber,
        ...body.address,
        ...body.contact,
        rating: body.rating,
      },
    });
    res.status(201).json(hospital);
  }),
);

hospitalsRouter.patch(
  '/:id',
  authorize('system_admin', 'hospital_admin'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    assertOwnership(req.auth!, id, 'hospitalId');

    const body = hospitalSchema.partial().parse(req.body);
    const hospital = await prisma.hospital.update({
      where: { id },
      data: {
        name: body.name,
        licenseNumber: body.licenseNumber,
        ...(body.address ?? {}),
        ...(body.contact ?? {}),
        rating: body.rating,
      },
    });
    res.json(hospital);
  }),
);
