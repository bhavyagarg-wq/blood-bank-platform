export type BloodType = 'A' | 'B' | 'AB' | 'O';
export type RhFactor = 'positive' | 'negative';
export type BloodGroup = 'O-' | 'O+' | 'A-' | 'A+' | 'B-' | 'B+' | 'AB-' | 'AB+';

/** Recipient blood group -> donor blood groups that can safely be transfused. */
export const COMPATIBILITY_MATRIX: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

export function toBloodGroup(bloodType: BloodType, rhFactor: RhFactor): BloodGroup {
  return `${bloodType}${rhFactor === 'positive' ? '+' : '-'}` as BloodGroup;
}

export function isCompatible(recipient: BloodGroup, donor: BloodGroup): boolean {
  return COMPATIBILITY_MATRIX[recipient].includes(donor);
}

/** 100 for an identical group, 80 for a compatible substitute, 0 when incompatible. */
export function calculateCompatibilityScore(
  requestedType: BloodType,
  requestedRh: RhFactor,
  availableType: BloodType,
  availableRh: RhFactor,
): number {
  const recipient = toBloodGroup(requestedType, requestedRh);
  const donor = toBloodGroup(availableType, availableRh);

  if (!isCompatible(recipient, donor)) return 0;
  return recipient === donor ? 100 : 80;
}
