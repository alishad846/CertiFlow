import forge from 'node-forge';
import { pool } from '../db/pool';
import { AppError } from '../lib/errors';
import { encryptSecret, decryptSecret } from '../lib/crypto-at-rest';

export type CompanyDscMeta = {
  subjectCn: string | null;
  validTo: string | null;
  autoSign: boolean;
  enabled: boolean;
};

/**
 * Parse a PKCS#12 (.pfx/.p12) with its passphrase, returning the signer certificate's common name
 * and expiry. Throws AppError(400) if the passphrase is wrong or no certificate is present — this is
 * how we validate an uploaded DSC before storing it.
 */
export function parseP12Meta(p12: Buffer, passphrase: string): { subjectCn: string | null; validTo: Date | null } {
  let p12Obj: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(p12.toString('binary'));
    p12Obj = forge.pkcs12.pkcs12FromAsn1(asn1, passphrase);
  } catch {
    throw new AppError('Could not open the certificate — check the file and passphrase.', 400);
  }
  const certBags = p12Obj.getBags({ bagType: forge.pki.oids.certBag });
  const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;
  if (!cert) {
    throw new AppError('No certificate found in the uploaded file.', 400);
  }
  const cn = cert.subject.getField('CN');
  return { subjectCn: cn?.value ?? null, validTo: cert.validity.notAfter ?? null };
}

export async function saveCompanyDsc(params: {
  companyId: string;
  p12: Buffer;
  passphrase: string;
  autoSign: boolean;
}): Promise<CompanyDscMeta> {
  const { subjectCn, validTo } = parseP12Meta(params.p12, params.passphrase);
  const p12Enc = encryptSecret(params.p12);
  const passEnc = encryptSecret(Buffer.from(params.passphrase, 'utf8'));

  const result = await pool.query<{ subject_cn: string | null; valid_to: Date | null; auto_sign: boolean; enabled: boolean }>(
    `INSERT INTO company_signing_settings (
       company_id, p12_ciphertext, p12_iv, p12_tag, pass_ciphertext, pass_iv, pass_tag,
       subject_cn, valid_to, auto_sign, enabled, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true, NOW())
     ON CONFLICT (company_id) DO UPDATE SET
       p12_ciphertext = EXCLUDED.p12_ciphertext, p12_iv = EXCLUDED.p12_iv, p12_tag = EXCLUDED.p12_tag,
       pass_ciphertext = EXCLUDED.pass_ciphertext, pass_iv = EXCLUDED.pass_iv, pass_tag = EXCLUDED.pass_tag,
       subject_cn = EXCLUDED.subject_cn, valid_to = EXCLUDED.valid_to, auto_sign = EXCLUDED.auto_sign,
       enabled = true, updated_at = NOW()
     RETURNING subject_cn, valid_to, auto_sign, enabled`,
    [
      params.companyId,
      p12Enc.ciphertext, p12Enc.iv, p12Enc.tag,
      passEnc.ciphertext, passEnc.iv, passEnc.tag,
      subjectCn, validTo, params.autoSign
    ]
  );
  const row = result.rows[0];
  return {
    subjectCn: row.subject_cn,
    validTo: row.valid_to ? row.valid_to.toISOString() : null,
    autoSign: row.auto_sign,
    enabled: row.enabled
  };
}

/** Metadata only — never returns key material. Safe to expose over the API. */
export async function getCompanyDscMeta(companyId: string): Promise<CompanyDscMeta | null> {
  const result = await pool.query<{ subject_cn: string | null; valid_to: Date | null; auto_sign: boolean; enabled: boolean }>(
    `SELECT subject_cn, valid_to, auto_sign, enabled FROM company_signing_settings WHERE company_id = $1`,
    [companyId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    subjectCn: row.subject_cn,
    validTo: row.valid_to ? row.valid_to.toISOString() : null,
    autoSign: row.auto_sign,
    enabled: row.enabled
  };
}

/**
 * Worker-only: returns the decrypted P12 + passphrase for signing, but ONLY when the company's DSC
 * is enabled and auto-sign is on. Returns null otherwise (no DSC, disabled, or manual-sign mode).
 */
export async function loadCompanyDscForSigning(
  companyId: string
): Promise<{ p12: Buffer; passphrase: string } | null> {
  const result = await pool.query<{
    p12_ciphertext: Buffer; p12_iv: Buffer; p12_tag: Buffer;
    pass_ciphertext: Buffer; pass_iv: Buffer; pass_tag: Buffer;
    auto_sign: boolean; enabled: boolean;
  }>(
    `SELECT p12_ciphertext, p12_iv, p12_tag, pass_ciphertext, pass_iv, pass_tag, auto_sign, enabled
     FROM company_signing_settings WHERE company_id = $1`,
    [companyId]
  );
  const row = result.rows[0];
  if (!row || !row.enabled || !row.auto_sign) return null;
  const p12 = decryptSecret({ ciphertext: row.p12_ciphertext, iv: row.p12_iv, tag: row.p12_tag });
  const passphrase = decryptSecret({ ciphertext: row.pass_ciphertext, iv: row.pass_iv, tag: row.pass_tag }).toString('utf8');
  return { p12, passphrase };
}

export async function deleteCompanyDsc(companyId: string): Promise<void> {
  await pool.query('DELETE FROM company_signing_settings WHERE company_id = $1', [companyId]);
}
