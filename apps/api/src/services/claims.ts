import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { sendSystemEmail } from './email';
import { generateOtp, hashSecret, hashedEquals } from './certificate-id';
import { maskEmail, logCertificateEvent } from './certificates';

const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const CLAIM_AUDIENCE = 'certiflow-claim';

type ClaimRow = {
  id: string;
  certificate_id: string;
  email_on_record: string;
  status: 'unclaimed' | 'otp_sent' | 'verified' | 'expired';
  otp_hash: string | null;
  otp_expires_at: Date | null;
  otp_attempts: number;
  otp_last_sent_at: Date | null;
  expires_at: Date;
};

async function loadClaimByToken(rawToken: string): Promise<ClaimRow | null> {
  const tokenHash = hashSecret(rawToken);
  const result = await pool.query<ClaimRow>(
    `SELECT id, certificate_id, email_on_record, status, otp_hash, otp_expires_at,
            otp_attempts, otp_last_sent_at, expires_at
     FROM certificate_claims
     WHERE claim_token_hash = $1`,
    [tokenHash]
  );
  return result.rows[0] ?? null;
}

export type ClaimContext = {
  status: 'claimable' | 'expired' | 'revoked';
  maskedEmail: string;
  recipientName: string;
  companyName: string;
  /** Generic document kind — never the internal template name (e.g. "Classic Navy"). */
  documentType: 'certificate' | 'offer_letter';
  /** Recipient-specific context line (course / program / role), not a template identifier. */
  program: string | null;
  publicId: string;
};

function pickProgram(metadata: Record<string, unknown> | null, isOfferLetter: boolean): string | null {
  if (!metadata) return null;
  const value = isOfferLetter
    ? metadata.role ?? metadata.position
    : metadata.course ?? metadata.role;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || null;
}

/** Public metadata to render the claim page — never leaks the full email or internal template name. */
export async function getClaimContext(rawToken: string): Promise<ClaimContext> {
  const claim = await loadClaimByToken(rawToken);
  if (!claim) {
    throw new AppError('This claim link is not valid.', 404);
  }

  const cert = await pool.query<{
    recipient_name: string;
    public_id: string;
    status: string;
    company_name: string;
    metadata: Record<string, unknown> | null;
    is_offer_letter: boolean | null;
  }>(
    `SELECT c.recipient_name, c.public_id, c.status, co.name AS company_name, c.metadata,
            ct.is_offer_letter
     FROM certificates c
     INNER JOIN companies co ON co.id = c.company_id
     LEFT JOIN certificate_templates ct ON ct.id = c.template_id
     WHERE c.id = $1`,
    [claim.certificate_id]
  );
  const row = cert.rows[0];
  if (!row) {
    throw new AppError('This claim link is not valid.', 404);
  }

  let status: ClaimContext['status'] = 'claimable';
  if (row.status === 'revoked') {
    status = 'revoked';
  } else if (claim.expires_at.getTime() < Date.now()) {
    status = 'expired';
  }

  const isOfferLetter = Boolean(row.is_offer_letter);

  return {
    status,
    maskedEmail: maskEmail(claim.email_on_record),
    recipientName: row.recipient_name,
    companyName: row.company_name,
    documentType: isOfferLetter ? 'offer_letter' : 'certificate',
    program: pickProgram(row.metadata, isOfferLetter),
    publicId: row.public_id
  };
}

function assertClaimUsable(claim: ClaimRow) {
  if (claim.expires_at.getTime() < Date.now()) {
    throw new AppError('This claim link has expired.', 410);
  }
}

/** Verify the typed email matches the on-record email, then email an OTP to it. */
export async function requestClaimOtp(rawToken: string, email: string, ip: string | null): Promise<{ maskedEmail: string }> {
  const claim = await loadClaimByToken(rawToken);
  if (!claim) {
    throw new AppError('This claim link is not valid.', 404);
  }
  assertClaimUsable(claim);

  const typed = email.trim().toLowerCase();
  // Identity binding: the OTP is only ever sent to the on-record inbox, so only
  // the true recipient can proceed. Mismatch is rejected without sending.
  if (typed !== claim.email_on_record.trim().toLowerCase()) {
    throw new AppError('That email does not match our records for this certificate.', 403);
  }

  if (claim.otp_last_sent_at && Date.now() - claim.otp_last_sent_at.getTime() < OTP_RESEND_COOLDOWN_MS) {
    throw new AppError('An OTP was just sent. Please wait a minute before requesting another.', 429);
  }

  const otp = generateOtp();
  const otpHash = hashSecret(otp);
  const expiresAt = new Date(Date.now() + env.CLAIM_OTP_TTL_MINUTES * 60 * 1000);

  await pool.query(
    `UPDATE certificate_claims
     SET otp_hash = $2, otp_expires_at = $3, otp_attempts = 0,
         otp_last_sent_at = NOW(), status = 'otp_sent', updated_at = NOW()
     WHERE id = $1`,
    [claim.id, otpHash, expiresAt]
  );

  await sendSystemEmail({
    to: claim.email_on_record,
    subject: 'Your CertiFlow verification code',
    html: buildOtpEmailHtml(otp),
    recipientName: ''
  });

  await logCertificateEvent(claim.certificate_id, 'otp_sent', { ip });
  return { maskedEmail: maskEmail(claim.email_on_record) };
}

/** Validate the OTP (with attempt cap + lockout) and return a claim session token. */
export async function verifyClaimOtp(
  rawToken: string,
  email: string,
  otp: string,
  ip: string | null
): Promise<{ claimSession: string; certificateId: string }> {
  const claim = await loadClaimByToken(rawToken);
  if (!claim) {
    throw new AppError('This claim link is not valid.', 404);
  }
  assertClaimUsable(claim);

  if (email.trim().toLowerCase() !== claim.email_on_record.trim().toLowerCase()) {
    throw new AppError('That email does not match our records for this certificate.', 403);
  }
  if (!claim.otp_hash || !claim.otp_expires_at) {
    throw new AppError('Please request a verification code first.', 400);
  }
  if (claim.otp_attempts >= env.CLAIM_MAX_OTP_ATTEMPTS) {
    throw new AppError('Too many incorrect attempts. Please request a new verification code.', 429);
  }
  if (claim.otp_expires_at.getTime() < Date.now()) {
    throw new AppError('This verification code has expired. Please request a new one.', 410);
  }

  if (!hashedEquals(otp.trim(), claim.otp_hash)) {
    await pool.query(
      `UPDATE certificate_claims SET otp_attempts = otp_attempts + 1, updated_at = NOW() WHERE id = $1`,
      [claim.id]
    );
    throw new AppError('Incorrect verification code.', 401);
  }

  // Success — mark verified/claimed and clear the OTP material.
  await pool.query(
    `UPDATE certificate_claims
     SET status = 'verified', verified_at = NOW(), verified_ip = $2,
         otp_hash = NULL, otp_expires_at = NULL, updated_at = NOW()
     WHERE id = $1`,
    [claim.id, ip]
  );
  await pool.query(
    `UPDATE certificates
     SET status = CASE WHEN status = 'issued' THEN 'claimed' ELSE status END,
         claimed_at = COALESCE(claimed_at, NOW()), updated_at = NOW()
     WHERE id = $1`,
    [claim.certificate_id]
  );
  await logCertificateEvent(claim.certificate_id, 'claimed', { ip });

  const claimSession = jwt.sign({ cid: claim.id }, env.JWT_SECRET, {
    subject: claim.certificate_id,
    audience: CLAIM_AUDIENCE,
    expiresIn: `${env.CLAIM_SESSION_TTL_MINUTES}m`
  });

  return { claimSession, certificateId: claim.certificate_id };
}

/** Verify a claim-session token (from the download endpoint). Fails closed. */
export function verifyClaimSession(token: string): { certificateId: string } {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { audience: CLAIM_AUDIENCE }) as { sub: string };
    return { certificateId: payload.sub };
  } catch {
    throw new AppError('Your claim session has expired. Please verify again.', 401);
  }
}

function buildOtpEmailHtml(otp: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #d6cfc1; border-radius: 16px; background-color: #f4f1ea;">
      <h2 style="color: #0b1b3a; margin: 0 0 4px; font-size: 22px;">CertiFlow</h2>
      <p style="color: #94703f; font-size: 13px; margin: 0 0 20px; letter-spacing: 2px; text-transform: uppercase;">Certificate verification</p>
      <p style="color: #33436b; font-size: 15px; line-height: 1.6;">Use this code to verify your email and claim your certificate:</p>
      <div style="margin: 24px 0; text-align: center;">
        <div style="display: inline-block; padding: 14px 28px; background: #ffffff; border-radius: 12px; font-size: 30px; font-weight: bold; letter-spacing: 8px; color: #0b1b3a; border: 2px dashed #b48a5a;">${otp}</div>
      </div>
      <p style="color: #6b769a; font-size: 13px; line-height: 1.6;">This code expires in ${env.CLAIM_OTP_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.</p>
    </div>
  `;
}
