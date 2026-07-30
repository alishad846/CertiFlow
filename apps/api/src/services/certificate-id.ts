import crypto from 'node:crypto';
import { env } from '../config/env';

/**
 * Crockford base32 alphabet (no I, L, O, U — avoids visual ambiguity so the
 * printed credential ID can be read/transcribed off a certificate reliably).
 */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function crockford(bytes: Buffer): string {
  let out = '';
  for (const byte of bytes) {
    out += CROCKFORD[byte % 32];
  }
  return out;
}

/**
 * Public, human-transcribable credential ID printed on the certificate and used
 * in the /verify/{id} URL. Non-sequential + high-entropy so IDs can't be
 * enumerated. Uniqueness is additionally enforced by a DB unique index (callers
 * retry on the rare collision). Example: `CF-7K2M9Q-4TVX`.
 */
export function generatePublicCertificateId(): string {
  const a = crockford(crypto.randomBytes(6)).slice(0, 6);
  const b = crockford(crypto.randomBytes(6)).slice(0, 4);
  return `CF-${a}-${b}`;
}

/** Opaque, single-purpose claim secret embedded in the emailed claim URL. */
export function generateClaimToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** 6-digit numeric OTP using a CSPRNG (never Math.random for security codes). */
export function generateOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Keyed hash for anything we must store but should not keep in plaintext
 * (claim tokens, OTPs). A DB leak then reveals neither valid claim URLs nor
 * live OTPs. Constant-time comparison via {@link hashedEquals}.
 */
export function hashSecret(value: string): string {
  return crypto.createHmac('sha256', env.JWT_SECRET).update(value).digest('hex');
}

export function hashedEquals(rawValue: string, storedHash: string): boolean {
  const computed = hashSecret(rawValue);
  const a = Buffer.from(computed);
  const b = Buffer.from(storedHash);
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/** SHA-256 of a file buffer — the tamper-evidence fingerprint stored per version. */
export function sha256Hex(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
