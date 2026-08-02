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
  /** Pre-allocated public id (so the QR can be stamped before issuing). */
  publicId?: string;
  /** Whether the source PDF is digitally signed. */
  signed?: boolean;
  /** Page-1 raster of the final PDF, pre-rendered at issuance for the claim-page preview. Best-effort. */
  previewPngBuffer?: Buffer | null;
};

/** Reserve a collision-free public credential id (used before rendering the QR). */
export async function allocateUniquePublicId(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = generatePublicCertificateId();
    const existing = await pool.query('SELECT 1 FROM certificates WHERE public_id = $1', [candidate]);
    if (existing.rowCount === 0) {
      return candidate;
    }
  }
  throw new Error('Failed to allocate a unique certificate id');
}

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

function certVersionPreviewPath(companyId: string, certificateId: string, versionNo: number) {
  return path.join(env.CERT_STORE_DIR, companyId, certificateId, `v${versionNo}-preview.png`);
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
    const publicId = input.publicId ?? generatePublicCertificateId();
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
        if (input.previewPngBuffer) {
          await fs.writeFile(certVersionPreviewPath(input.companyId, id, 1), input.previewPngBuffer);
        }

        await client.query(
          `INSERT INTO certificate_versions
             (certificate_id, version_no, pdf_path, pdf_sha256, signed, data_snapshot)
           VALUES ($1, 1, $2, $3, $4, $5::jsonb)`,
          [id, storedPath, sha256, input.signed ?? false, JSON.stringify(input.dataSnapshot ?? {})]
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
  signed?: boolean;
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
    signed: boolean | null;
    metadata: Record<string, unknown>;
  }>(
    `SELECT c.id, c.public_id, c.recipient_name, c.title, co.name AS company_name, c.status,
            c.issued_at, c.expires_at, c.revoked_reason, c.current_version, c.metadata,
            (SELECT v.signed FROM certificate_versions v
              WHERE v.certificate_id = c.id AND v.version_no = c.current_version) AS signed
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
    signed: Boolean(row.signed),
    metadata: row.metadata
  };
}

export type FileIntegrityResult = {
  found: boolean;
  /** Internal id for audit logging only — stripped before sending to clients. */
  certificateId?: string;
  status?: string;
  /** True iff the uploaded file's SHA-256 matches ANY issued version's stored hash. */
  matches?: boolean;
  /** True iff it matches the CURRENT version specifically (superseded versions still count as "matches: true" but not current). */
  matchesCurrentVersion?: boolean;
  matchedVersionNo?: number | null;
  matchedVersionSigned?: boolean;
};

/**
 * Compare an uploaded file's SHA-256 against every version we ever issued for this credential id.
 * This is the actual tamper check — the public /verify/:publicId lookup only confirms an id exists
 * and returns what we have on record, it says nothing about a specific file in someone's hands. A
 * QR/ID match alone does NOT prove a physical or downloaded copy is unmodified.
 */
export async function checkFileIntegrity(publicId: string, fileBuffer: Buffer): Promise<FileIntegrityResult> {
  const sha256 = sha256Hex(fileBuffer);

  const certResult = await pool.query<{ id: string; status: string; current_version: number }>(
    `SELECT id, status, current_version FROM certificates WHERE public_id = $1`,
    [publicId]
  );
  const cert = certResult.rows[0];
  if (!cert) {
    return { found: false };
  }

  const versions = await pool.query<{ version_no: number; pdf_sha256: string; signed: boolean }>(
    `SELECT version_no, pdf_sha256, signed FROM certificate_versions WHERE certificate_id = $1`,
    [cert.id]
  );
  const matched = versions.rows.find((v) => v.pdf_sha256 === sha256) ?? null;

  return {
    found: true,
    certificateId: cert.id,
    status: cert.status,
    matches: Boolean(matched),
    matchesCurrentVersion: matched?.version_no === cert.current_version,
    matchedVersionNo: matched?.version_no ?? null,
    matchedVersionSigned: Boolean(matched?.signed)
  };
}

/** Current version's gated PDF path + certificate status (download guards on status). */
export async function getCurrentVersionPdfPath(
  certificateId: string
): Promise<{ pdfPath: string; status: string } | null> {
  const result = await pool.query<{ pdf_path: string; status: string }>(
    `SELECT v.pdf_path, c.status
     FROM certificates c
     INNER JOIN certificate_versions v
       ON v.certificate_id = c.id AND v.version_no = c.current_version
     WHERE c.id = $1`,
    [certificateId]
  );
  const row = result.rows[0];
  return row ? { pdfPath: row.pdf_path, status: row.status } : null;
}

/** Pre-rendered page-1 preview for the current version, if one was generated at issuance. */
export async function getCurrentVersionPreviewPath(
  certificateId: string
): Promise<{ previewPath: string; status: string } | null> {
  const result = await pool.query<{ company_id: string; current_version: number; status: string }>(
    `SELECT company_id, current_version, status FROM certificates WHERE id = $1`,
    [certificateId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    previewPath: certVersionPreviewPath(row.company_id, certificateId, row.current_version),
    status: row.status
  };
}

export type CertificateListItem = {
  id: string;
  publicId: string;
  recipientName: string;
  recipientEmail: string;
  title: string | null;
  status: string;
  claimStatus: string | null;
  issuedAt: string;
  claimedAt: string | null;
};

/** Company-scoped list of issued certificates (cursor paginated by issued_at). */
export async function listCompanyCertificates(
  companyId: string,
  opts: { limit?: number; before?: string | null } = {}
): Promise<CertificateListItem[]> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const params: unknown[] = [companyId];
  let cursorClause = '';
  if (opts.before) {
    params.push(opts.before);
    cursorClause = `AND c.issued_at < $${params.length}`;
  }
  params.push(limit);

  const result = await pool.query<{
    id: string;
    public_id: string;
    recipient_name: string;
    recipient_email: string;
    title: string | null;
    status: string;
    claim_status: string | null;
    issued_at: Date;
    claimed_at: Date | null;
  }>(
    `SELECT c.id, c.public_id, c.recipient_name, c.recipient_email, c.title, c.status,
            cl.status AS claim_status, c.issued_at, c.claimed_at
     FROM certificates c
     LEFT JOIN certificate_claims cl ON cl.certificate_id = c.id
     WHERE c.company_id = $1 ${cursorClause}
     ORDER BY c.issued_at DESC
     LIMIT $${params.length}`,
    params
  );

  return result.rows.map((row) => ({
    id: row.id,
    publicId: row.public_id,
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email,
    title: row.title,
    status: row.status,
    claimStatus: row.claim_status,
    issuedAt: row.issued_at.toISOString(),
    claimedAt: row.claimed_at ? row.claimed_at.toISOString() : null
  }));
}

/** Revoke a certificate (company-scoped). Verification page then shows REVOKED. */
export async function revokeCertificate(
  certificateId: string,
  companyId: string,
  reason: string | null,
  userId: string | null
): Promise<boolean> {
  const result = await pool.query<{ id: string }>(
    `UPDATE certificates
     SET status = 'revoked', revoked_at = NOW(), revoked_reason = $3, updated_at = NOW()
     WHERE id = $1 AND company_id = $2 AND status <> 'revoked'
     RETURNING id`,
    [certificateId, companyId, reason]
  );
  if (!result.rows[0]) {
    return false;
  }
  await logCertificateEvent(certificateId, 'revoked', { detail: { by: userId, reason } });
  return true;
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
