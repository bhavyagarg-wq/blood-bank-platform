import { SHELF_LIFE_DAYS, ageInYears, checkEligibility, expiryDateFor } from '../../src/services/eligibility';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const daysBefore = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe('checkEligibility', () => {
  it('accepts a healthy adult donor past the waiting period', () => {
    const result = checkEligibility(
      { dateOfBirth: new Date('1995-01-01'), weight: 65, lastDonationDate: daysBefore(120), hemoglobin: 13.5 },
      NOW,
    );
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('defers donors who are too young, too light, anaemic or too recent', () => {
    const result = checkEligibility(
      { dateOfBirth: new Date('2012-01-01'), weight: 45, lastDonationDate: daysBefore(10), hemoglobin: 11 },
      NOW,
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toHaveLength(4);
    expect(result.nextEligibleDate).toEqual(daysBefore(-80));
  });

  it('computes age without counting an upcoming birthday', () => {
    expect(ageInYears(new Date('1995-06-01'), NOW)).toBe(30);
    expect(ageInYears(new Date('1995-01-01'), NOW)).toBe(31);
  });
});

describe('expiryDateFor', () => {
  it('adds the whole-blood shelf life to the collection date', () => {
    expect(expiryDateFor(NOW).getTime() - NOW.getTime()).toBe(SHELF_LIFE_DAYS * 86_400_000);
  });
});
