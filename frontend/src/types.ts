export type BloodType = 'A' | 'B' | 'AB' | 'O';
export type RhFactor = 'positive' | 'negative';
export type UserRole = 'hospital_admin' | 'blood_bank_admin' | 'donor' | 'system_admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  hospitalId: string | null;
  bloodBankId: string | null;
  donorId: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BloodBankSummary {
  id: string;
  name: string;
  city: string;
}

export interface BloodUnit {
  id: string;
  bloodType: BloodType;
  rhFactor: RhFactor;
  bloodBankId: string;
  collectionDate: string;
  expiryDate: string;
  status: 'available' | 'reserved' | 'transfused' | 'expired' | 'quarantined';
  testingStatus: 'pending' | 'complete' | 'failed';
  volume: number;
  shelf: string;
  refrigerator: string;
  bloodBank?: BloodBankSummary;
}

export interface BloodRequirement {
  id: string;
  bloodType: BloodType;
  rhFactor: RhFactor;
  quantity: number;
  priority: 'critical' | 'urgent' | 'routine';
}

export interface EmergencyRequest {
  id: string;
  hospitalId: string;
  doctorName: string;
  department: string;
  urgencyLevel: number;
  requiredBy: string;
  patientAge: number;
  patientBloodType: BloodType;
  patientRhFactor: RhFactor;
  diagnosis?: string | null;
  status: 'pending' | 'matched' | 'partial' | 'fulfilled' | 'cancelled';
  requirements: BloodRequirement[];
  hospital?: { id: string; name: string; city: string };
  _count?: { matches: number };
}

export interface Match {
  id: string;
  emergencyRequestId: string;
  bloodUnitId: string;
  bloodBankId: string;
  hospitalId: string;
  score: number;
  compatibilityScore: number;
  distanceScore: number;
  urgencyScore: number;
  expiryScore: number;
  bloodBankRating: number;
  status: 'proposed' | 'accepted' | 'rejected' | 'transit' | 'delivered' | 'cancelled';
  estimatedTime: number;
  bloodUnit?: BloodUnit;
  bloodBank?: BloodBankSummary;
  hospital?: BloodBankSummary;
  emergencyRequest?: Pick<EmergencyRequest, 'id' | 'urgencyLevel' | 'requiredBy' | 'status'>;
}

export interface InventoryRow {
  bloodType: BloodType;
  rhFactor: RhFactor;
  available: number;
  reserved: number;
  expiringWithin7Days: number;
}

export interface Donation {
  id: string;
  donorId: string;
  bloodBankId: string;
  donationDate: string;
  donationType: string;
  volume: number;
  status: 'scheduled' | 'completed' | 'deferred' | 'cancelled';
  donor?: { id: string; firstName: string; lastName: string; bloodType: BloodType; rhFactor: RhFactor };
  bloodBank?: { id: string; name: string };
}

export interface Donor {
  id: string;
  firstName: string;
  lastName: string;
  bloodType: BloodType;
  rhFactor: RhFactor;
  email: string;
  phone: string;
  weight: number;
  totalDonations: number;
  lastDonationDate: string | null;
  eligibilityStatus: string;
  notifyByEmail: boolean;
  notifyBySms: boolean;
  notifyByPush: boolean;
  donationFrequency: string;
  donations?: Donation[];
}

export interface Eligibility {
  eligible: boolean;
  reasons: string[];
  nextEligibleDate: string | null;
}

export interface Overview {
  hospitals: number;
  bloodBanks: number;
  donors: number;
  inventory: {
    availableUnits: number;
    reservedUnits: number;
    expiredUnits: number;
    transfusedUnits: number;
  };
  requests: { pending: number; fulfilled: number; total: number };
  deliveredMatches: number;
  matchSuccessRate: number;
  inventoryUtilisationRate: number;
}
