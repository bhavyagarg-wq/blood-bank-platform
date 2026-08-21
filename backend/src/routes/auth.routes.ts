import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { conflict, unauthorized } from '../lib/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, signToken } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { loginSchema, registerSchema } from '../schemas';

export const authRouter = Router();

authRouter.post(
  '/register',
  rateLimit(20, 60_000),
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw conflict('A user with this email already exists');

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        role: body.role,
        passwordHash: await bcrypt.hash(body.password, 10),
        hospitalId: body.hospitalId ?? null,
        bloodBankId: body.bloodBankId ?? null,
        donorId: body.donorId ?? null,
      },
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  }),
);

authRouter.post(
  '/login',
  rateLimit(10, 60_000),
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.isActive) throw unauthorized('Invalid credentials');

    const passwordMatches = await bcrypt.compare(body.password, user.passwordHash);
    if (!passwordMatches) throw unauthorized('Invalid credentials');

    const token = signToken({
      userId: user.id,
      role: user.role,
      hospitalId: user.hospitalId,
      bloodBankId: user.bloodBankId,
      donorId: user.donorId,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hospitalId: user.hospitalId,
        bloodBankId: user.bloodBankId,
        donorId: user.donorId,
      },
    });
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        hospitalId: true,
        bloodBankId: true,
        donorId: true,
      },
    });
    res.json(user);
  }),
);
