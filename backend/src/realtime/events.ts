export const ROOM = {
  hospital: (id: string) => `hospital:${id}`,
  bloodBank: (id: string) => `bloodbank:${id}`,
  donor: (id: string) => `donor:${id}`,
  admin: () => 'admin',
} as const;

export const EVENT = {
  inventoryUpdated: 'inventory_updated',
  emergencyRequestCreated: 'emergency_request_created',
  matchesProposed: 'matches_proposed',
  potentialMatch: 'potential_match',
  matchAccepted: 'match_accepted',
  matchRejected: 'match_rejected',
  matchStatusChanged: 'match_status_changed',
  requestStatusChanged: 'request_status_changed',
  donationScheduled: 'donation_scheduled',
} as const;
