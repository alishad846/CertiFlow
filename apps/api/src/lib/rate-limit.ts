import type { NextFunction, Request, Response } from 'express';
import { AppError } from './errors';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
};

const buckets = new Map<string, number[]>();

export function rateLimit({ windowMs, max, message, keyGenerator }: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = (keyGenerator ? keyGenerator(req) : req.ip) || 'unknown';
    const now = Date.now();
    const bucket = buckets.get(key) ?? [];
    const recent = bucket.filter((timestamp) => now - timestamp < windowMs);

    if (recent.length >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      next(new AppError(`${message} Try again in ${retryAfterSeconds} seconds.`, 429));
      return;
    }

    recent.push(now);
    buckets.set(key, recent);
    next();
  };
}
