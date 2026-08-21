import { z } from 'zod';
import { addressSchema, bloodTypeSchema, contactSchema, genderSchema, rhFactorSchema } from './common';

export * from './common';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['hospital_admin', 'blood_bank_admin', 'donor', 'system_admin']),
  hospitalId: z.string().uuid().optional(),
  bloodBankId: z.string().uuid().optional(),
  donorId: z.string().uuid().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const hospitalSchema = z.object({
  name: z.string().min(1),
  licenseNumber: z.string().min(1),
  address: addressSchema,
  contact: contactSchema,
  rating: z.number().min(1).max(5).default(4),
});

export const bloodBankSchema = z.object({
  name: z.string().min(1),
  licenseNumber: z.string().min(1),
  address: addressSchema,
  contact: contactSchema,
  totalCapacity: z.number().int().positive().default(500),
  opensAt: z.string().default('08:00'),
  closesAt: z.string().default('20:00'),
  openDays: z.array(z.string()).default(['mon', 'tue', 'wed', 'thu', 'fri', 'sat']),
  rating: z.number().min(1).max(5).default(4),
});

export const donorSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.coerce.date(),
  gender: genderSchema,
  bloodType: bloodTypeSchema,
  rhFactor: rhFactorSchema,
  phone: z.string().min(6),
  email: z.string().email(),
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zipCode: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  weight: z.number().positive(),
  preferredBloodBankId: z.string().uuid().optional(),
  notifyByEmail: z.boolean().default(true),
  notifyBySms: z.boolean().default(false),
  notifyByPush: z.boolean().default(false),
  donationFrequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly']).default('quarterly'),
});

export const bloodUnitSchema = z.object({
  bloodType: bloodTypeSchema,
  rhFactor: rhFactorSchema,
  bloodBankId: z.string().uuid(),
  donorId: z.string().uuid().optional(),
  collectionDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  volume: z.number().positive().default(450),
  shelf: z.string().default('A1'),
  refrigerator: z.string().default('R1'),
});

export const testResultSchema = z.object({
  hiv: z.boolean(),
  hepatitisB: z.boolean(),
  hepatitisC: z.boolean(),
  syphilis: z.boolean(),
  notes: z.string().optional(),
});

export const unitStatusSchema = z.object({
  status: z.enum(['available', 'reserved', 'transfused', 'expired', 'quarantined']),
  notes: z.string().optional(),
});

export const emergencyRequestSchema = z.object({
  hospitalId: z.string().uuid().optional(),
  requestedBy: z.object({
    doctorName: z.string().min(1),
    department: z.string().min(1),
    contactNumber: z.string().min(6),
  }),
  bloodRequirements: z
    .array(
      z.object({
        bloodType: bloodTypeSchema,
        rhFactor: rhFactorSchema,
        quantity: z.number().int().positive(),
        priority: z.enum(['critical', 'urgent', 'routine']).default('urgent'),
      }),
    )
    .min(1),
  urgency: z.object({
    level: z.number().int().min(1).max(5),
    requiredBy: z.coerce.date(),
  }),
  patientInfo: z.object({
    age: z.number().int().min(0).max(130),
    gender: genderSchema,
    bloodType: bloodTypeSchema,
    rhFactor: rhFactorSchema,
    diagnosis: z.string().optional(),
  }),
});

export const matchStatusSchema = z.object({
  status: z.enum(['transit', 'delivered', 'cancelled']),
});

export const donationSchema = z.object({
  donorId: z.string().uuid(),
  bloodBankId: z.string().uuid(),
  donationDate: z.coerce.date(),
  donationType: z.enum(['whole_blood', 'platelets', 'plasma', 'red_blood_cells']).default('whole_blood'),
  volume: z.number().positive().default(450),
  healthScreening: z.object({
    hemoglobin: z.number().positive(),
    systolic: z.number().int().positive(),
    diastolic: z.number().int().positive(),
    temperature: z.number(),
    weight: z.number().positive(),
    questionsPassed: z.boolean().default(true),
  }),
  notes: z.string().optional(),
});

export const completeDonationSchema = z.object({
  shelf: z.string().default('A1'),
  refrigerator: z.string().default('R1'),
});
