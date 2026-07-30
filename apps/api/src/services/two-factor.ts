import crypto from 'node:crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { pool } from '../db/pool';
import { AppError } from '../lib/errors';
import { encryptSecret, decryptSecret } from '../lib/crypto';
import { hashSecret, hashedEquals } from './certificate-id';

authenticator.options = { window: 1 };

const ISSUER = 'CertiFlow';

type TwoFactorRow = {
  two_factor_enabled: boolean;
  two_factor_secret: string | null;
  two_factor_backup_codes: string[];
};

async function loadRow(userId: string): Promise<TwoFactorRow | null> {
  const result = await pool.query<TwoFactorRow>(
    `SELECT two_factor_enabled, two_factor_secret, two_factor_backup_codes FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

/** Generate a fresh (not-yet-enabled) secret + provisioning QR for enrollment. */
export async function setupTwoFactor(userId: string, email: string) {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(email, ISSUER, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  await pool.query(
    `UPDATE users SET two_factor_secret = $2, two_factor_enabled = false, updated_at = NOW() WHERE id = $1`,
    [userId, encryptSecret(secret)]
  );

  return { otpauthUrl, qrDataUrl, secret };
}

function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(4).toString('hex');
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  });
}

/** Verify the enrollment token; on success enable 2FA and return backup codes (once). */
export async function enableTwoFactor(userId: string, token: string): Promise<string[]> {
  const row = await loadRow(userId);
  const secret = row?.two_factor_secret ? decryptSecret(row.two_factor_secret) : null;
  if (!secret) {
    throw new AppError('Start two-factor setup first.', 400);
  }
  if (!authenticator.verify({ token: token.replace(/\s/g, ''), secret })) {
    throw new AppError('That code is incorrect. Try again.', 401);
  }

  const backupCodes = generateBackupCodes();
  const hashed = backupCodes.map((code) => hashSecret(code));
  await pool.query(
    `UPDATE users SET two_factor_enabled = true, two_factor_backup_codes = $2::jsonb, updated_at = NOW() WHERE id = $1`,
    [userId, JSON.stringify(hashed)]
  );
  return backupCodes;
}

export async function disableTwoFactor(userId: string): Promise<void> {
  await pool.query(
    `UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL,
       two_factor_backup_codes = '[]'::jsonb, updated_at = NOW() WHERE id = $1`,
    [userId]
  );
}

export async function isTwoFactorEnabled(userId: string): Promise<boolean> {
  const row = await loadRow(userId);
  return Boolean(row?.two_factor_enabled);
}

/** Verify a login-time TOTP token or a single-use backup code (which is consumed). */
export async function verifyTwoFactor(userId: string, token: string): Promise<boolean> {
  const row = await loadRow(userId);
  if (!row?.two_factor_enabled || !row.two_factor_secret) {
    return false;
  }
  const secret = decryptSecret(row.two_factor_secret);
  if (secret && authenticator.verify({ token: token.replace(/\s/g, ''), secret })) {
    return true;
  }

  // Fall back to a backup code (single use — remove it once matched).
  const codes = Array.isArray(row.two_factor_backup_codes) ? row.two_factor_backup_codes : [];
  const normalized = token.trim().toLowerCase();
  const matchIndex = codes.findIndex((hash) => hashedEquals(normalized, hash));
  if (matchIndex === -1) {
    return false;
  }
  const remaining = codes.filter((_, i) => i !== matchIndex);
  await pool.query(`UPDATE users SET two_factor_backup_codes = $2::jsonb, updated_at = NOW() WHERE id = $1`, [
    userId,
    JSON.stringify(remaining)
  ]);
  return true;
}
