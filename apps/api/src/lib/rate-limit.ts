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

// Failed-login throttle: only *failed* attempts count toward the limit, and a successful
// login resets the counter. After LOGIN_MAX_FAILURES failures within LOGIN_WINDOW_MS the
// account+ip is locked until the oldest failure ages out of the window.
export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const loginFailures = new Map<string, number[]>();

function recentFailures(key: string, now: number) {
  const recent = (loginFailures.get(key) ?? []).filter((t) => now - t < LOGIN_WINDOW_MS);
  loginFailures.set(key, recent);
  return recent;
}

/** Milliseconds remaining on a lockout for this key, or 0 if not locked. */
export function loginLockRemainingMs(key: string): number {
  const now = Date.now();
  const recent = recentFailures(key, now);
  if (recent.length >= LOGIN_MAX_FAILURES) {
    return LOGIN_WINDOW_MS - (now - recent[0]);
  }
  return 0;
}

export function recordLoginFailure(key: string) {
  const now = Date.now();
  const recent = recentFailures(key, now);
  recent.push(now);
  loginFailures.set(key, recent);
}

export function clearLoginFailures(key: string) {
  loginFailures.delete(key);
}
