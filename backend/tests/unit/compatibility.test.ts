import {
  COMPATIBILITY_MATRIX,
  calculateCompatibilityScore,
  isCompatible,
  toBloodGroup,
} from '../../src/matching/compatibility';

describe('blood group compatibility', () => {
  it('formats blood groups from type and rh factor', () => {
    expect(toBloodGroup('AB', 'positive')).toBe('AB+');
    expect(toBloodGroup('O', 'negative')).toBe('O-');
  });

  it('treats O- as the universal donor', () => {
    for (const recipient of Object.keys(COMPATIBILITY_MATRIX) as (keyof typeof COMPATIBILITY_MATRIX)[]) {
      expect(isCompatible(recipient, 'O-')).toBe(true);
    }
  });

  it('treats AB+ as the universal recipient', () => {
    expect(COMPATIBILITY_MATRIX['AB+']).toHaveLength(8);
  });

  it('rejects incompatible transfusions', () => {
    expect(isCompatible('O-', 'O+')).toBe(false);
    expect(isCompatible('A+', 'B+')).toBe(false);
    expect(calculateCompatibilityScore('O', 'negative', 'A', 'positive')).toBe(0);
  });

  it('scores an exact group higher than a compatible substitute', () => {
    expect(calculateCompatibilityScore('A', 'positive', 'A', 'positive')).toBe(100);
    expect(calculateCompatibilityScore('A', 'positive', 'O', 'negative')).toBe(80);
  });
});
