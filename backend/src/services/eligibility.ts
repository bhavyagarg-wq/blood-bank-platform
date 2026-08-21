export const MIN_DONOR_AGE = 18;
export const MAX_DONOR_AGE = 65;
export const MIN_DONOR_WEIGHT_KG = 50;
export const MIN_HEMOGLOBIN = 12.5;
export const MIN_DAYS_BETWEEN_DONATIONS = 90;

export interface EligibilityInput {
  dateOfBirth: Date;
  weight: number;
  lastDonationDate: Date | null;
  hemoglobin?: number;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  nextEligibleDate: Date | null;
}

export function ageInYears(dateOfBirth: Date, now: Date): number {
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const monthDelta = now.getMonth() - dateOfBirth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dateOfBirth.getDate())) age -= 1;
  return age;
}

export function checkEligibility(input: EligibilityInput, now: Date = new Date()): EligibilityResult {
  const reasons: string[] = [];
  const age = ageInYears(input.dateOfBirth, now);

  if (age < MIN_DONOR_AGE) reasons.push(`Donor must be at least ${MIN_DONOR_AGE} years old`);
  if (age > MAX_DONOR_AGE) reasons.push(`Donor must be at most ${MAX_DONOR_AGE} years old`);
  if (input.weight < MIN_DONOR_WEIGHT_KG) reasons.push(`Donor must weigh at least ${MIN_DONOR_WEIGHT_KG} kg`);
  if (input.hemoglobin !== undefined && input.hemoglobin < MIN_HEMOGLOBIN) {
    reasons.push(`Haemoglobin must be at least ${MIN_HEMOGLOBIN} g/dL`);
  }

  let nextEligibleDate: Date | null = null;
  if (input.lastDonationDate) {
    nextEligibleDate = new Date(
      input.lastDonationDate.getTime() + MIN_DAYS_BETWEEN_DONATIONS * 24 * 60 * 60 * 1000,
    );
    if (nextEligibleDate > now) {
      reasons.push(`Donor must wait ${MIN_DAYS_BETWEEN_DONATIONS} days between donations`);
    }
  }

  return { eligible: reasons.length === 0, reasons, nextEligibleDate };
}

/** Whole blood keeps for 42 days from collection. */
export const SHELF_LIFE_DAYS = 42;

export function expiryDateFor(collectionDate: Date): Date {
  return new Date(collectionDate.getTime() + SHELF_LIFE_DAYS * 24 * 60 * 60 * 1000);
}
