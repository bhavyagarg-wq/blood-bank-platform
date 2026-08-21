import { Coordinates, haversineDistanceKm } from '../utils/distance';

export const MATCH_WEIGHTS = {
  compatibility: 0.35,
  urgency: 0.25,
  distance: 0.2,
  expiry: 0.15,
  bloodBankRating: 0.05,
} as const;

const HOUR_MS = 1000 * 60 * 60;
const DAY_MS = HOUR_MS * 24;

/**
 * Urgency level 1 is the most critical. The score is reduced when the request
 * window is wider than what the level implies.
 */
export function calculateUrgencyScore(urgencyLevel: number, requiredBy: Date, now: Date): number {
  const hoursUntilNeeded = (requiredBy.getTime() - now.getTime()) / HOUR_MS;

  switch (urgencyLevel) {
    case 1:
      return 100;
    case 2:
      return hoursUntilNeeded <= 2 ? 95 : 80;
    case 3:
      return hoursUntilNeeded <= 6 ? 85 : 70;
    case 4:
      return hoursUntilNeeded <= 24 ? 75 : 60;
    case 5:
      return hoursUntilNeeded <= 48 ? 65 : 50;
    default:
      return 50;
  }
}

/** Maximum acceptable travel distance widens as the request gets less urgent. */
export function maxDistanceKm(urgencyLevel: number): number {
  if (urgencyLevel <= 2) return 50;
  if (urgencyLevel <= 3) return 100;
  return 200;
}

export function calculateDistanceScore(
  hospital: Coordinates,
  bloodBank: Coordinates,
  urgencyLevel: number,
): number {
  const distance = haversineDistanceKm(hospital, bloodBank);
  const limit = maxDistanceKm(urgencyLevel);

  if (distance > limit) return 0;
  return Math.max(0, 100 - (distance / limit) * 100);
}

/**
 * Critical requests favour units with a long shelf life; routine requests favour
 * units nearing expiry so that stock is used before it is wasted.
 */
export function calculateExpiryScore(expiryDate: Date, now: Date, urgencyLevel: number): number {
  const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / DAY_MS;

  if (daysUntilExpiry < 1) return 0;

  if (urgencyLevel <= 2) {
    return daysUntilExpiry >= 7 ? 100 : (daysUntilExpiry / 7) * 100;
  }

  if (daysUntilExpiry <= 3) return 0;
  if (daysUntilExpiry <= 21) return 100 - ((daysUntilExpiry - 3) / 18) * 30;
  return 70;
}

export function calculateBloodBankRatingScore(rating: number): number {
  return (rating / 5) * 100;
}

export interface ScoreBreakdown {
  compatibility: number;
  urgency: number;
  distance: number;
  expiry: number;
  bloodBankRating: number;
}

export function weightedTotal(breakdown: ScoreBreakdown): number {
  return (
    MATCH_WEIGHTS.compatibility * breakdown.compatibility +
    MATCH_WEIGHTS.urgency * breakdown.urgency +
    MATCH_WEIGHTS.distance * breakdown.distance +
    MATCH_WEIGHTS.expiry * breakdown.expiry +
    MATCH_WEIGHTS.bloodBankRating * breakdown.bloodBankRating
  );
}
