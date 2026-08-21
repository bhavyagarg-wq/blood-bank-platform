import { Router } from 'express';
import { DonationStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { assertOwnership, authenticate, authorize } from '../middleware/auth';
import { completeDonationSchema, donationSchema, idParamSchema, paginationSchema } from '../schemas';
import { checkEligibility, expiryDateFor } from '../services/eligibility';
import { registerBloodUnit } from '../services/inventoryService';
import { realtime } from '../realtime/bus';
import { EVENT } from '../realtime/events';

export const donationsRouter = Router();

donationsRouter.use(authenticate);

const listQuerySchema = paginationSchema.extend({
  donorId: z.string().uuid().optional(),
  bloodBankId: z.string().uuid().optional(),
  status: z.enum(['scheduled', 'completed', 'deferred', 'cancelled']).optional(),
});

donationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const auth = req.auth!;

    const where: Prisma.DonationWhereInput = {
      status: query.status,
      donorId: auth.role === 'donor' ? auth.donorId ?? undefined : query.donorId,
      bloodBankId: auth.role === 'blood_bank_admin' ? auth.bloodBankId ?? undefined : query.bloodBankId,
    };

    const [items, total] = await Promise.all([
      prisma.donation.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { donationDate: 'desc' },
        include: {
          donor: { select: { id: true, firstName: true, lastName: true, bloodType: true, rhFactor: true } },
          bloodBank: { select: { id: true, name: true } },
        },
      }),
      prisma.donation.count({ where }),
    ]);

    res.json({ items, total, page: query.page, pageSize: query.pageSize });
  }),
);

donationsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = donationSchema.parse(req.body);
    if (req.auth!.role === 'donor') assertOwnership(req.auth!, body.donorId, 'donorId');

    const donor = await prisma.donor.findUnique({ where: { id: body.donorId } });
    if (!donor) throw notFound('Donor not found');

    const eligibility = checkEligibility(
      {
        dateOfBirth: donor.dateOfBirth,
        weight: body.healthScreening.weight,
        lastDonationDate: donor.lastDonationDate,
        hemoglobin: body.healthScreening.hemoglobin,
      },
      body.donationDate,
    );
    if (!eligibility.eligible) throw badRequest('Donor is not eligible', eligibility.reasons);

    const donation = await prisma.donation.create({
      data: {
        donorId: body.donorId,
        bloodBankId: body.bloodBankId,
        donationDate: body.donationDate,
        donationType: body.donationType,
        volume: body.volume,
        hemoglobin: body.healthScreening.hemoglobin,
        systolic: body.healthScreening.systolic,
        diastolic: body.healthScreening.diastolic,
        temperature: body.healthScreening.temperature,
        weight: body.healthScreening.weight,
        questionsPassed: body.healthScreening.questionsPassed,
        notes: body.notes,
      },
    });

    realtime.toBloodBank(body.bloodBankId, EVENT.donationScheduled, { donationId: donation.id });
    realtime.toDonor(body.donorId, EVENT.donationScheduled, { donationId: donation.id });

    res.status(201).json(donation);
  }),
);

/** Completing a donation turns it into a pending-testing blood unit and updates donor history. */
donationsRouter.post(
  '/:id/complete',
  authorize('system_admin', 'blood_bank_admin'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const body = completeDonationSchema.parse(req.body);

    const donation = await prisma.donation.findUnique({ where: { id }, include: { donor: true } });
    if (!donation) throw notFound('Donation not found');
    assertOwnership(req.auth!, donation.bloodBankId, 'bloodBankId');
    if (donation.status !== DonationStatus.scheduled) {
      throw badRequest(`Donation is already ${donation.status}`);
    }

    const unit = await registerBloodUnit(
      {
        bloodType: donation.donor.bloodType,
        rhFactor: donation.donor.rhFactor,
        bloodBankId: donation.bloodBankId,
        donorId: donation.donorId,
        collectionDate: donation.donationDate,
        expiryDate: expiryDateFor(donation.donationDate),
        volume: donation.volume,
        shelf: body.shelf,
        refrigerator: body.refrigerator,
      },
      req.auth!.userId,
    );

    const [updated] = await prisma.$transaction([
      prisma.donation.update({
        where: { id },
        data: { status: DonationStatus.completed, bloodUnitId: unit.id },
      }),
      prisma.donor.update({
        where: { id: donation.donorId },
        data: { lastDonationDate: donation.donationDate, totalDonations: { increment: 1 } },
      }),
    ]);

    res.json({ donation: updated, bloodUnit: unit });
  }),
);
