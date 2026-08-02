import { describe, it, expect } from 'vitest';
import forge from 'node-forge';
import { seedTemplateFixture } from './helpers';
import { pool } from '../../db/pool';
import {
  saveCompanyDsc,
  getCompanyDscMeta,
  loadCompanyDscForSigning,
  deleteCompanyDsc,
  parseP12Meta
} from '../company-signing';

// Build a throwaway self-signed .p12 the way a real DSC file is shaped, so we can exercise storage.
function makeSelfSignedP12(passphrase: string, cn = 'Acme HR Pvt Ltd'): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 3);
  const attrs = [{ name: 'commonName', value: cn }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, { algorithm: '3des' });
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary');
}

describe('company DSC storage', () => {
  it('stores encrypted, exposes metadata only, and loads for signing', async () => {
    const { companyId } = await seedTemplateFixture();
    const p12 = makeSelfSignedP12('secret-pass', 'Acme HR Pvt Ltd');

    const meta = await saveCompanyDsc({ companyId, p12, passphrase: 'secret-pass', autoSign: true });
    expect(meta.subjectCn).toBe('Acme HR Pvt Ltd');
    expect(meta.enabled).toBe(true);
    expect(meta.autoSign).toBe(true);
    expect(meta.validTo).toBeTruthy();

    // Stored ciphertext must NOT equal the raw p12 bytes.
    const raw = await pool.query<{ p12_ciphertext: Buffer }>(
      'SELECT p12_ciphertext FROM company_signing_settings WHERE company_id = $1',
      [companyId]
    );
    expect(raw.rows[0].p12_ciphertext.equals(p12)).toBe(false);

    // Metadata endpoint shape carries no key material.
    const fetched = await getCompanyDscMeta(companyId);
    expect(fetched).toMatchObject({ subjectCn: 'Acme HR Pvt Ltd', enabled: true });
    expect(Object.keys(fetched ?? {})).toEqual(['subjectCn', 'validTo', 'autoSign', 'enabled']);

    // Worker load returns a P12 that re-opens with the original passphrase.
    const loaded = await loadCompanyDscForSigning(companyId);
    expect(loaded).not.toBeNull();
    expect(() => parseP12Meta(loaded!.p12, loaded!.passphrase)).not.toThrow();

    await deleteCompanyDsc(companyId);
    expect(await getCompanyDscMeta(companyId)).toBeNull();
  });

  it('rejects a wrong passphrase', async () => {
    const { companyId } = await seedTemplateFixture();
    const p12 = makeSelfSignedP12('right-pass');
    await expect(saveCompanyDsc({ companyId, p12, passphrase: 'wrong-pass', autoSign: true })).rejects.toThrow();
  });

  it('does not load for signing when auto_sign is off', async () => {
    const { companyId } = await seedTemplateFixture();
    const p12 = makeSelfSignedP12('p');
    await saveCompanyDsc({ companyId, p12, passphrase: 'p', autoSign: false });
    expect(await loadCompanyDscForSigning(companyId)).toBeNull();
  });
});
