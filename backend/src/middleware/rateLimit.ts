import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/errors';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Minimal in-memory fixed-window rate limiter. Sufficient for a single-process
 * deployment; a shared store would be needed behind a load balancer.
 */
export function rateLimit(limit: number, windowMs: number) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > limit) {
      next(new HttpError(429, 'Too many requests, please slow down'));
      return;
    }
    next();
  };
}
