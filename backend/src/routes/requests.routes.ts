import { Router } from 'express';
import { Prisma, RequestStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { emergencyRequestSchema, idParamSchema, paginationSchema } from '../schemas';
import { previewMatches, processEmergencyRequest } from '../services/matchingService';
import { realtime } from '../realtime/bus';
import { EVENT } from '../realtime/events';

export const requestsRouter = Router();

requestsRouter.use(authenticate);

const listQuerySchema = paginationSchema.extend({
  status: z.enum(['pending', 'matched', 'partial', 'fulfilled', 'cancelled']).optional(),
  hospitalId: z.string().uuid().optional(),
});

requestsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const where: Prisma.EmergencyRequestWhereInput = {
      status: query.status,
      hospitalId: req.auth!.role === 'hospital_admin' ? req.auth!.hospitalId ?? undefined : query.hospitalId,
    };

    const [items, total] = await Promise.all([
      prisma.emergencyRequest.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ urgencyLevel: 'asc' }, { requiredBy: 'asc' }],
        include: {
          requirements: true,
          hospital: { select: { id: true, name: true, city: true } },
          _count: { select: { matches: true } },
        },
      }),
      prisma.emergencyRequest.count({ where }),
    ]);

    res.json({ items, total, page: query.page, pageSize: query.pageSize });
  }),
);

requestsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const request = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: {
        requirements: true,
        hospital: true,
        matches: {
          orderBy: { score: 'desc' },
          include: { bloodUnit: true, bloodBank: { select: { id: true, name: true, city: true } } },
        },
      },
    });
    if (!request) throw notFound('Emergency request not found');
    res.json(request);
  }),
);

requestsRouter.post(
  '/',
  authorize('system_admin', 'hospital_admin'),
  rateLimit(30, 60_000),
  asyncHandler(async (req, res) => {
    const body = emergencyRequestSchema.parse(req.body);
    const hospitalId = req.auth!.role === 'hospital_admin' ? req.auth!.hospitalId : body.hospitalId;
    if (!hospitalId) throw badRequest('hospitalId is required');

    if (body.urgency.requiredBy.getTime() <= Date.now()) {
      throw badRequest('urgency.requiredBy must be in the future');
    }

    const request = await prisma.emergencyRequest.create({
      data: {
        hospitalId,
        doctorName: body.requestedBy.doctorName,
        department: body.requestedBy.department,
        contactNumber: body.requestedBy.contactNumber,
        urgencyLevel: body.urgency.level,
        requiredBy: body.urgency.requiredBy,
        patientAge: body.patientInfo.age,
        patientGender: body.patientInfo.gender,
        patientBloodType: body.patientInfo.bloodType,
        patientRhFactor: body.patientInfo.rhFactor,
        diagnosis: body.patientInfo.diagnosis,
        requirements: { create: body.bloodRequirements },
      },
      include: { requirements: true },
    });

    realtime.toAdmins(EVENT.emergencyRequestCreated, { requestId: request.id, urgency: request.urgencyLevel });

    // Matching runs immediately so the hospital sees proposals in the same response.
    const matches = await processEmergencyRequest(request.id);
    res.status(201).json({ request, matches });
  }),
);

requestsRouter.get(
  '/:id/match-preview',
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json(await previewMatches(id));
  }),
);

requestsRouter.post(
  '/:id/rematch',
  authorize('system_admin', 'hospital_admin'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json(await processEmergencyRequest(id));
  }),
);

requestsRouter.post(
  '/:id/cancel',
  authorize('system_admin', 'hospital_admin'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const request = await prisma.emergencyRequest.findUnique({ where: { id } });
    if (!request) throw notFound('Emergency request not found');
    if (req.auth!.role === 'hospital_admin' && request.hospitalId !== req.auth!.hospitalId) {
      throw forbidden('You do not have access to this request');
    }

    const updated = await prisma.emergencyRequest.update({
      where: { id },
      data: { status: RequestStatus.cancelled },
    });
    await prisma.match.updateMany({
      where: { emergencyRequestId: id, status: 'proposed' },
      data: { status: 'cancelled' },
    });

    realtime.toHospital(request.hospitalId, EVENT.requestStatusChanged, { requestId: id, status: updated.status });
    res.json(updated);
  }),
);
