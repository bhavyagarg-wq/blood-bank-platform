import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { env } from '../config/env';
import { forbidden, unauthorized } from '../lib/errors';

export interface AuthPayload {
  userId: string;
  role: UserRole;
  hospitalId: string | null;
  bloodBankId: string | null;
  donorId: string | null;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthPayload;
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, env.jwtSecret) as AuthPayload;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(unauthorized('Missing bearer token'));
    return;
  }

  try {
    req.auth = verifyToken(header.slice('Bearer '.length));
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(unauthorized());
      return;
    }
    if (roles.length > 0 && !roles.includes(req.auth.role)) {
      next(forbidden(`Requires one of: ${roles.join(', ')}`));
      return;
    }
    next();
  };
}

/** System admins bypass ownership checks; everyone else must own the resource. */
export function assertOwnership(auth: AuthPayload, ownerId: string | null, field: keyof AuthPayload): void {
  if (auth.role === 'system_admin') return;
  if (!ownerId || auth[field] !== ownerId) {
    throw forbidden('You do not have access to this resource');
  }
}
