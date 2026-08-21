import { BloodUnitStatus, Match, MatchStatus, RequestStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/errors';
import { realtime } from '../realtime/bus';
import { EVENT } from '../realtime/events';
import { MatchCandidate, findBestMatches, totalRequiredUnits } from '../matching/matcher';
import { changeUnitStatus } from './inventoryService';

export async function previewMatches(requestId: string, limit?: number): Promise<MatchCandidate[]> {
  const request = await prisma.emergencyRequest.findUnique({
    where: { id: requestId },
    include: { hospital: true, requirements: true },
  });
  if (!request) throw notFound('Emergency request not found');

  const units = await prisma.bloodUnit.findMany({
    where: {
      status: BloodUnitStatus.available,
      testingStatus: 'complete',
      expiryDate: { gt: new Date() },
    },
  });
  const bloodBanks = await prisma.bloodBank.findMany({ where: { isActive: true } });

  return findBestMatches(request, units, bloodBanks, request.hospital, new Date(), limit);
}

/** Scores available stock for a pending request, persists the proposals and notifies both sides. */
export async function processEmergencyRequest(requestId: string): Promise<Match[]> {
  const request = await prisma.emergencyRequest.findUnique({
    where: { id: requestId },
    include: { requirements: true },
  });
  if (!request) throw notFound('Emergency request not found');
  if (request.status === RequestStatus.cancelled || request.status === RequestStatus.fulfilled) {
    throw badRequest(`Cannot match a request that is ${request.status}`);
  }

  const candidates = await previewMatches(requestId);
  if (candidates.length === 0) return [];

  const matches = await prisma.$transaction(
    candidates.map((candidate) =>
      prisma.match.upsert({
        where: {
          emergencyRequestId_bloodUnitId: { emergencyRequestId: requestId, bloodUnitId: candidate.unitId },
        },
        create: {
          emergencyRequestId: requestId,
          bloodUnitId: candidate.unitId,
          bloodBankId: candidate.bloodBankId,
          hospitalId: request.hospitalId,
          score: candidate.score,
          compatibilityScore: candidate.breakdown.compatibility,
          urgencyScore: candidate.breakdown.urgency,
          distanceScore: candidate.breakdown.distance,
          expiryScore: candidate.breakdown.expiry,
          bloodBankRating: candidate.breakdown.bloodBankRating,
          estimatedTime: candidate.estimatedMinutes,
        },
        update: {
          score: candidate.score,
          compatibilityScore: candidate.breakdown.compatibility,
          urgencyScore: candidate.breakdown.urgency,
          distanceScore: candidate.breakdown.distance,
          expiryScore: candidate.breakdown.expiry,
          bloodBankRating: candidate.breakdown.bloodBankRating,
          estimatedTime: candidate.estimatedMinutes,
        },
      }),
    ),
  );

  await prisma.emergencyRequest.update({
    where: { id: requestId },
    data: { status: request.status === RequestStatus.pending ? RequestStatus.matched : request.status },
  });

  realtime.toHospital(request.hospitalId, EVENT.matchesProposed, { requestId, matches: matches.slice(0, 5) });
  for (const bloodBankId of new Set(matches.map((match) => match.bloodBankId))) {
    realtime.toBloodBank(bloodBankId, EVENT.potentialMatch, {
      requestId,
      matches: matches.filter((match) => match.bloodBankId === bloodBankId),
    });
  }
  realtime.toAdmins(EVENT.matchesProposed, { requestId, count: matches.length });

  return matches;
}

async function refreshRequestStatus(requestId: string): Promise<RequestStatus> {
  const request = await prisma.emergencyRequest.findUnique({
    where: { id: requestId },
    include: { requirements: true },
  });
  if (!request) throw notFound('Emergency request not found');

  const acceptedCount = await prisma.match.count({
    where: {
      emergencyRequestId: requestId,
      status: { in: [MatchStatus.accepted, MatchStatus.transit, MatchStatus.delivered] },
    },
  });

  const required = totalRequiredUnits(request);
  let status: RequestStatus = RequestStatus.matched;
  if (acceptedCount >= required) status = RequestStatus.fulfilled;
  else if (acceptedCount > 0) status = RequestStatus.partial;

  await prisma.emergencyRequest.update({ where: { id: requestId }, data: { status } });
  realtime.toHospital(request.hospitalId, EVENT.requestStatusChanged, { requestId, status, acceptedCount, required });
  return status;
}

export async function acceptMatch(matchId: string, performedBy: string): Promise<Match> {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { bloodUnit: true } });
  if (!match) throw notFound('Match not found');
  if (match.status !== MatchStatus.proposed) throw badRequest(`Match is already ${match.status}`);
  if (match.bloodUnit.status !== BloodUnitStatus.available) throw badRequest('Blood unit is no longer available');

  // Claim the proposal conditionally so two concurrent accepts cannot both win.
  const claimed = await prisma.match.updateMany({
    where: { id: matchId, status: MatchStatus.proposed },
    data: { status: MatchStatus.accepted, respondedAt: new Date() },
  });
  if (claimed.count === 0) throw badRequest('Match is already accepted');

  const updated = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });

  await changeUnitStatus(match.bloodUnitId, BloodUnitStatus.reserved, performedBy, {
    emergencyRequestId: match.emergencyRequestId,
    notes: `Reserved for match ${matchId}`,
  });

  // Competing proposals for the same unit can no longer be honoured.
  await prisma.match.updateMany({
    where: { bloodUnitId: match.bloodUnitId, id: { not: matchId }, status: MatchStatus.proposed },
    data: { status: MatchStatus.cancelled, respondedAt: new Date() },
  });

  await refreshRequestStatus(match.emergencyRequestId);

  realtime.toHospital(match.hospitalId, EVENT.matchAccepted, { matchId });
  realtime.toBloodBank(match.bloodBankId, EVENT.matchAccepted, { matchId });
  return updated;
}

export async function rejectMatch(matchId: string): Promise<Match> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw notFound('Match not found');
  if (match.status !== MatchStatus.proposed) throw badRequest(`Match is already ${match.status}`);

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: { status: MatchStatus.rejected, respondedAt: new Date() },
  });

  realtime.toHospital(match.hospitalId, EVENT.matchRejected, { matchId });
  realtime.toBloodBank(match.bloodBankId, EVENT.matchRejected, { matchId });
  return updated;
}

const ALLOWED_TRANSITIONS: Partial<Record<MatchStatus, MatchStatus[]>> = {
  [MatchStatus.accepted]: [MatchStatus.transit, MatchStatus.cancelled],
  [MatchStatus.transit]: [MatchStatus.delivered, MatchStatus.cancelled],
};

export async function updateMatchStatus(
  matchId: string,
  status: MatchStatus,
  performedBy: string,
): Promise<Match> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw notFound('Match not found');

  const allowed = ALLOWED_TRANSITIONS[match.status] ?? [];
  if (!allowed.includes(status)) {
    throw badRequest(`Cannot move match from ${match.status} to ${status}`);
  }

  const completedAt = status === MatchStatus.delivered ? new Date() : null;
  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      status,
      completedAt,
      actualTime: completedAt
        ? Math.round((completedAt.getTime() - match.proposedAt.getTime()) / 60000)
        : match.actualTime,
    },
  });

  if (status === MatchStatus.delivered) {
    await changeUnitStatus(match.bloodUnitId, BloodUnitStatus.transfused, performedBy, {
      notes: `Delivered for match ${matchId}`,
    });
  }
  if (status === MatchStatus.cancelled) {
    await changeUnitStatus(match.bloodUnitId, BloodUnitStatus.available, performedBy, {
      emergencyRequestId: null,
      notes: `Match ${matchId} cancelled`,
    });
  }

  await refreshRequestStatus(match.emergencyRequestId);

  realtime.toHospital(match.hospitalId, EVENT.matchStatusChanged, { matchId, status });
  realtime.toBloodBank(match.bloodBankId, EVENT.matchStatusChanged, { matchId, status });
  return updated;
}
