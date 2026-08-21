import { z } from 'zod';

export const bloodTypeSchema = z.enum(['A', 'B', 'AB', 'O']);
export const rhFactorSchema = z.enum(['positive', 'negative']);
export const genderSchema = z.enum(['male', 'female', 'other']);

export const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zipCode: z.string().min(1),
  country: z.string().min(1).default('India'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const contactSchema = z.object({
  phone: z.string().min(6),
  email: z.string().email(),
  emergencyContact: z.string().min(6),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const idParamSchema = z.object({ id: z.string().uuid() });
