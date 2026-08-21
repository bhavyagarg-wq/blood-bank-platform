import { BloodType, RhFactor, calculateCompatibilityScore } from './compatibility';
import {
  ScoreBreakdown,
  calculateBloodBankRatingScore,
  calculateDistanceScore,
  calculateExpiryScore,
  calculateUrgencyScore,
  weightedTotal,
} from './scoring';
import { estimateTravelMinutes, haversineDistanceKm } from '../utils/distance';

export interface MatchableUnit {
  id: string;
  bloodType: BloodType;
  rhFactor: RhFactor;
  bloodBankId: string;
  expiryDate: Date;
  status: string;
  testingStatus: string;
}

export interface MatchableBloodBank {
  id: string;
  latitude: number;
  longitude: number;
  rating: number;
  isActive: boolean;
}

export interface MatchableRequirement {
  bloodType: BloodType;
  rhFactor: RhFactor;
  quantity: number;
}

export interface MatchableRequest {
  id: string;
  urgencyLevel: number;
  requiredBy: Date;
  requirements: MatchableRequirement[];
}

export interface MatchableHospital {
  id: string;
  latitude: number;
  longitude: number;
}

export interface MatchCandidate {
  unitId: string;
  bloodBankId: string;
  score: number;
  breakdown: ScoreBreakdown;
  distanceKm: number;
  estimatedMinutes: number;
}

export const DEFAULT_MATCH_LIMIT = 10;

/**
 * Scores every available, fully tested unit against each blood requirement and
 * returns the best distinct units, highest score first.
 */
export function findBestMatches(
  request: MatchableRequest,
  units: MatchableUnit[],
  bloodBanks: MatchableBloodBank[],
  hospital: MatchableHospital,
  now: Date = new Date(),
  limit: number = DEFAULT_MATCH_LIMIT,
): MatchCandidate[] {
  const bankById = new Map(bloodBanks.map((bank) => [bank.id, bank]));
  const bestByUnit = new Map<string, MatchCandidate>();

  const urgency = calculateUrgencyScore(request.urgencyLevel, request.requiredBy, now);

  for (const requirement of request.requirements) {
    for (const unit of units) {
      if (unit.status !== 'available') continue;
      if (unit.testingStatus !== 'complete') continue;
      if (unit.expiryDate.getTime() <= now.getTime()) continue;

      const bank = bankById.get(unit.bloodBankId);
      if (!bank || !bank.isActive) continue;

      const compatibility = calculateCompatibilityScore(
        requirement.bloodType,
        requirement.rhFactor,
        unit.bloodType,
        unit.rhFactor,
      );
      if (compatibility === 0) continue;

      const distance = calculateDistanceScore(hospital, bank, request.urgencyLevel);
      if (distance === 0) continue;

      const expiry = calculateExpiryScore(unit.expiryDate, now, request.urgencyLevel);
      if (expiry === 0) continue;

      const breakdown: ScoreBreakdown = {
        compatibility,
        urgency,
        distance,
        expiry,
        bloodBankRating: calculateBloodBankRatingScore(bank.rating),
      };

      const distanceKm = haversineDistanceKm(hospital, bank);
      const candidate: MatchCandidate = {
        unitId: unit.id,
        bloodBankId: bank.id,
        score: Number(weightedTotal(breakdown).toFixed(2)),
        breakdown,
        distanceKm: Number(distanceKm.toFixed(2)),
        estimatedMinutes: estimateTravelMinutes(distanceKm),
      };

      const existing = bestByUnit.get(unit.id);
      if (!existing || candidate.score > existing.score) {
        bestByUnit.set(unit.id, candidate);
      }
    }
  }

  return [...bestByUnit.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export function totalRequiredUnits(request: Pick<MatchableRequest, 'requirements'>): number {
  return request.requirements.reduce((sum, requirement) => sum + requirement.quantity, 0);
}
