import fs from 'node:fs/promises';
import path from 'node:path';
import type { PoolClient } from 'pg';
import { pool, withTransaction } from '../db/pool';
import { env } from '../config/env';
import { ensureDir } from './fs';
import {
  generatePublicCertificateId,
  generateClaimToken,
  hashSecret,
  sha256Hex
} from './certificate-id';

export type IssueCertificateInput = {
  companyId: string;
  batchId: string | null;
  documentId: string | null;
  templateId: string | null;
  recipientName: string;
  recipientEmail: string;
  title?: string | null;
  sourcePdfPath: string;
  dataSnapshot?: Record<string, unknown>;
  expiresAt?: Date | null;
};

export type IssuedCertificate = {
  id: string;
  publicId: string;
  claimToken: string; // raw token — only returned here, stored hashed
};

function certVersionPath(companyId: string, certificateId: string, versionNo: number) {
  // Lives under CERT_STORE_DIR which is NEVER statically served — download is
  // only possible through the claim-verified streaming endpoint.
  return path.join(env.CERT_STORE_DIR, companyId, certificateId, `v${versionNo}.pdf`);
}

/**
 * Persist an issued certificate: copy the rendered PDF into the gated store,
 * fingerprint it (SHA-256), and create the certificate + first version + claim
 * records atomically. Retries once on the (astronomically rare) public-id or
 * claim-token collision.
 */
export async function issueCertificate(input: IssueCertificateInput): Promise<IssuedCertificate> {
  const pdfBuffer = await fs.readFile(input.sourcePdfPath);
  const sha256 = sha256Hex(pdfBuffer);
  const claimTtlMs = env.CLAIM_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const publicId = generatePublicCertificateId();
    const claimToken = generateClaimToken();
    const claimTokenHash = hashSecret(claimToken);

    try {
      const certificateId = await withTransaction(async (client: PoolClient) => {
        const cert = await client.query<{ id: string }>(
          `INSERT INTO certificates
             (public_id, company_id, batch_id, document_id, template_id,
              recipient_name, recipient_email, title, status, current_version, expires_at, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'issued', 1, $9, $10::jsonb)
           RETURNING id`,
          [
            publicId,
            input.companyId,
            input.batchId,
            input.documentId,
            input.templateId,
            input.recipientName,
            input.recipientEmail,
            input.title ?? null,
            input.expiresAt ?? null,
            JSON.stringify(input.dataSnapshot ?? {})
          ]
        );
        const id = cert.rows[0].id;

        const storedPath = certVersionPath(input.companyId, id, 1);
        await ensureDir(path.dirname(storedPath));
        await fs.writeFile(storedPath, pdfBuffer);

        await client.query(
          `INSERT INTO certificate_versions
             (certificate_id, version_no, pdf_path, pdf_sha256, data_snapshot)
           VALUES ($1, 1, $2, $3, $4::jsonb)`,
          [id, storedPath, sha256, JSON.stringify(input.dataSnapshot ?? {})]
        );

        await client.query(
          `INSERT INTO certificate_claims
             (certificate_id, claim_token_hash, email_on_record, status, expires_at)
           VALUES ($1, $2, lower($3), 'unclaimed', $4)`,
          [id, claimTokenHash, input.recipientEmail, new Date(Date.now() + claimTtlMs)]
        );

        await client.query(
          `INSERT INTO certificate_events (certificate_id, event_type, detail)
           VALUES ($1, 'issued', $2::jsonb)`,
          [id, JSON.stringify({ batchId: input.batchId })]
        );

        return id;
      });

      return { id: certificateId, publicId, claimToken };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      // 23505 = unique_violation (public_id or claim_token_hash) — retry with fresh values.
      if (message.includes('duplicate key') && attempt < 2) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('Failed to allocate a unique certificate id');
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) {
    return '•••';
  }
  const visible = local.slice(0, 1);
  return `${visible}${'•'.repeat(Math.max(2, local.length - 1))}@${domain}`;
}

export type VerificationResult = {
  found: boolean;
  /** Internal id for audit logging only — stripped before sending to clients. */
  certificateId?: string;
  publicId?: string;
  recipientName?: string;
  title?: string | null;
  companyName?: string;
  status?: string;
  issuedAt?: string;
  expiresAt?: string | null;
  revokedReason?: string | null;
  currentVersion?: number;
  metadata?: Record<string, unknown>;
};

/** Public, unauthenticated verification lookup — the source of truth. */
export async function getVerification(publicId: string): Promise<VerificationResult> {
  const result = await pool.query<{
    id: string;
    public_id: string;
    recipient_name: string;
    title: string | null;
    company_name: string;
    status: string;
    issued_at: Date;
    expires_at: Date | null;
    revoked_reason: string | null;
    current_version: number;
    metadata: Record<string, unknown>;
  }>(
    `SELECT c.id, c.public_id, c.recipient_name, c.title, co.name AS company_name, c.status,
            c.issued_at, c.expires_at, c.revoked_reason, c.current_version, c.metadata
     FROM certificates c
     INNER JOIN companies co ON co.id = c.company_id
     WHERE c.public_id = $1`,
    [publicId]
  );

  const row = result.rows[0];
  if (!row) {
    return { found: false };
  }

  const expired = row.expires_at && row.expires_at.getTime() < Date.now();
  const status = expired && row.status === 'issued' ? 'expired' : row.status;

  return {
    found: true,
    certificateId: row.id,
    publicId: row.public_id,
    recipientName: row.recipient_name,
    title: row.title,
    companyName: row.company_name,
    status,
    issuedAt: row.issued_at.toISOString(),
    expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    revokedReason: row.revoked_reason,
    currentVersion: row.current_version,
    metadata: row.metadata
  };
}

/** Absolute path of the current version's gated PDF (for streaming downloads). */
export async function getCurrentVersionPdfPath(certificateId: string): Promise<string | null> {
  const result = await pool.query<{ pdf_path: string }>(
    `SELECT v.pdf_path
     FROM certificates c
     INNER JOIN certificate_versions v
       ON v.certificate_id = c.id AND v.version_no = c.current_version
     WHERE c.id = $1`,
    [certificateId]
  );
  return result.rows[0]?.pdf_path ?? null;
}

export async function logCertificateEvent(
  certificateId: string,
  eventType: string,
  meta: { ip?: string | null; userAgent?: string | null; detail?: Record<string, unknown> } = {}
): Promise<void> {
  await pool.query(
    `INSERT INTO certificate_events (certificate_id, event_type, ip, user_agent, detail)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [certificateId, eventType, meta.ip ?? null, meta.userAgent ?? null, JSON.stringify(meta.detail ?? {})]
  );
}
