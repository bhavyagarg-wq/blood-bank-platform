import {
  MATCH_WEIGHTS,
  calculateBloodBankRatingScore,
  calculateDistanceScore,
  calculateExpiryScore,
  calculateUrgencyScore,
  maxDistanceKm,
  weightedTotal,
} from '../../src/matching/scoring';
import { haversineDistanceKm } from '../../src/utils/distance';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const hoursFromNow = (hours: number) => new Date(NOW.getTime() + hours * 3600_000);
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * 86_400_000);

describe('urgency scoring', () => {
  it('always scores level 1 at the maximum', () => {
    expect(calculateUrgencyScore(1, hoursFromNow(72), NOW)).toBe(100);
  });

  it('penalises a window wider than the urgency level implies', () => {
    expect(calculateUrgencyScore(2, hoursFromNow(1), NOW)).toBe(95);
    expect(calculateUrgencyScore(2, hoursFromNow(10), NOW)).toBe(80);
    expect(calculateUrgencyScore(5, hoursFromNow(100), NOW)).toBe(50);
  });

  it('falls back to a neutral score for unknown levels', () => {
    expect(calculateUrgencyScore(9, hoursFromNow(1), NOW)).toBe(50);
  });
});

describe('distance scoring', () => {
  const hospital = { latitude: 12.9716, longitude: 77.5946 };
  const nearby = { latitude: 12.9698, longitude: 77.6034 };
  const faraway = { latitude: 12.9141, longitude: 74.856 };

  it('scores co-located facilities at 100', () => {
    expect(calculateDistanceScore(hospital, hospital, 1)).toBe(100);
  });

  it('scores a nearby bank highly', () => {
    expect(haversineDistanceKm(hospital, nearby)).toBeLessThan(2);
    expect(calculateDistanceScore(hospital, nearby, 1)).toBeGreaterThan(95);
  });

  it('rejects banks beyond the urgency-dependent radius', () => {
    expect(maxDistanceKm(1)).toBe(50);
    expect(maxDistanceKm(3)).toBe(100);
    expect(maxDistanceKm(5)).toBe(200);
    expect(calculateDistanceScore(hospital, faraway, 1)).toBe(0);
  });
});

describe('expiry scoring', () => {
  it('rejects units expiring within a day', () => {
    expect(calculateExpiryScore(daysFromNow(0.5), NOW, 1)).toBe(0);
  });

  it('prefers a long shelf life for critical requests', () => {
    expect(calculateExpiryScore(daysFromNow(10), NOW, 1)).toBe(100);
    expect(calculateExpiryScore(daysFromNow(3.5), NOW, 1)).toBeCloseTo(50, 5);
  });

  it('prefers near-expiry stock for routine requests to avoid wastage', () => {
    const nearExpiry = calculateExpiryScore(daysFromNow(5), NOW, 5);
    const longLife = calculateExpiryScore(daysFromNow(30), NOW, 5);
    expect(nearExpiry).toBeGreaterThan(longLife);
    expect(longLife).toBe(70);
    expect(calculateExpiryScore(daysFromNow(2), NOW, 5)).toBe(0);
  });
});

describe('weighted total', () => {
  it('sums the weights to 1', () => {
    const sum = Object.values(MATCH_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('returns 100 when every component is perfect', () => {
    expect(
      weightedTotal({ compatibility: 100, urgency: 100, distance: 100, expiry: 100, bloodBankRating: 100 }),
    ).toBeCloseTo(100, 10);
  });

  it('normalises the 1-5 blood bank rating onto 0-100', () => {
    expect(calculateBloodBankRatingScore(5)).toBe(100);
    expect(calculateBloodBankRatingScore(4)).toBe(80);
  });
});
