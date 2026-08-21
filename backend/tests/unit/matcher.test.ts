import {
  MatchableBloodBank,
  MatchableHospital,
  MatchableRequest,
  MatchableUnit,
  findBestMatches,
  totalRequiredUnits,
} from '../../src/matching/matcher';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * 86_400_000);

const hospital: MatchableHospital = { id: 'hosp', latitude: 12.9716, longitude: 77.5946 };

const nearBank: MatchableBloodBank = {
  id: 'near',
  latitude: 12.9698,
  longitude: 77.6034,
  rating: 5,
  isActive: true,
};
const midBank: MatchableBloodBank = {
  id: 'mid',
  latitude: 12.8916,
  longitude: 77.5983,
  rating: 4,
  isActive: true,
};
const farBank: MatchableBloodBank = {
  id: 'far',
  latitude: 12.9141,
  longitude: 74.856,
  rating: 5,
  isActive: true,
};

function unit(overrides: Partial<MatchableUnit> & Pick<MatchableUnit, 'id' | 'bloodBankId'>): MatchableUnit {
  return {
    bloodType: 'A',
    rhFactor: 'positive',
    expiryDate: daysFromNow(20),
    status: 'available',
    testingStatus: 'complete',
    ...overrides,
  };
}

const criticalRequest: MatchableRequest = {
  id: 'req',
  urgencyLevel: 1,
  requiredBy: new Date(NOW.getTime() + 3600_000),
  requirements: [{ bloodType: 'A', rhFactor: 'positive', quantity: 2 }],
};

describe('findBestMatches', () => {
  it('ranks an exact-group, nearby unit above a compatible, more distant one', () => {
    const units = [
      unit({ id: 'exact-near', bloodBankId: nearBank.id }),
      unit({ id: 'substitute-mid', bloodBankId: midBank.id, bloodType: 'O', rhFactor: 'negative' }),
    ];

    const matches = findBestMatches(criticalRequest, units, [nearBank, midBank], hospital, NOW);

    expect(matches.map((match) => match.unitId)).toEqual(['exact-near', 'substitute-mid']);
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
    expect(matches[0].breakdown.compatibility).toBe(100);
    expect(matches[1].breakdown.compatibility).toBe(80);
  });

  it('excludes units that are unavailable, untested, expired or incompatible', () => {
    const units = [
      unit({ id: 'reserved', bloodBankId: nearBank.id, status: 'reserved' }),
      unit({ id: 'pending-test', bloodBankId: nearBank.id, testingStatus: 'pending' }),
      unit({ id: 'expired', bloodBankId: nearBank.id, expiryDate: daysFromNow(-1) }),
      unit({ id: 'incompatible', bloodBankId: nearBank.id, bloodType: 'B', rhFactor: 'positive' }),
    ];

    expect(findBestMatches(criticalRequest, units, [nearBank], hospital, NOW)).toEqual([]);
  });

  it('drops blood banks outside the urgency radius and inactive banks', () => {
    const units = [
      unit({ id: 'far-unit', bloodBankId: farBank.id }),
      unit({ id: 'inactive-unit', bloodBankId: 'inactive' }),
    ];
    const inactiveBank: MatchableBloodBank = { ...nearBank, id: 'inactive', isActive: false };

    expect(findBestMatches(criticalRequest, units, [farBank, inactiveBank], hospital, NOW)).toEqual([]);
  });

  it('returns each unit at most once even when several requirements match it', () => {
    const request: MatchableRequest = {
      ...criticalRequest,
      requirements: [
        { bloodType: 'A', rhFactor: 'positive', quantity: 1 },
        { bloodType: 'AB', rhFactor: 'positive', quantity: 1 },
      ],
    };
    const units = [unit({ id: 'shared', bloodBankId: nearBank.id })];

    const matches = findBestMatches(request, units, [nearBank], hospital, NOW);
    expect(matches).toHaveLength(1);
    expect(matches[0].breakdown.compatibility).toBe(100);
  });

  it('honours the result limit and reports travel estimates', () => {
    const units = Array.from({ length: 15 }, (_, index) =>
      unit({ id: `unit-${index}`, bloodBankId: nearBank.id }),
    );

    const matches = findBestMatches(criticalRequest, units, [nearBank], hospital, NOW, 5);
    expect(matches).toHaveLength(5);
    expect(matches[0].distanceKm).toBeGreaterThan(0);
    expect(matches[0].estimatedMinutes).toBeGreaterThanOrEqual(15);
  });
});

describe('totalRequiredUnits', () => {
  it('sums the quantities across requirements', () => {
    expect(
      totalRequiredUnits({
        requirements: [
          { bloodType: 'A', rhFactor: 'positive', quantity: 2 },
          { bloodType: 'O', rhFactor: 'negative', quantity: 3 },
        ],
      }),
    ).toBe(5);
  });
});
