import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import forge from 'node-forge';
import { PDFDocument } from 'pdf-lib';
import { finalizeCertificatePdf } from '../certificate-finalize';

async function makeBasePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]); // A4-ish
  return Buffer.from(await doc.save());
}

function makeSelfSignedP12(passphrase: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);
  cert.setSubject([{ name: 'commonName', value: 'Test Employer' }]);
  cert.setIssuer([{ name: 'commonName', value: 'Test Employer' }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, { algorithm: '3des' });
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary');
}

const countFields = (buf: Buffer) => (buf.toString('latin1').match(/\/FT\s*\/Sig/g) || []).length;
const countSigned = (buf: Buffer) => (buf.toString('latin1').match(/\/Type\s*\/Sig(?![a-zA-Z])/g) || []).length;

async function writeTemp(): Promise<string> {
  const p = path.join(os.tmpdir(), `cf-finalize-${randomUUID()}.pdf`);
  await fs.writeFile(p, await makeBasePdf());
  return p;
}

describe('finalizeCertificatePdf DSC signing', () => {
  it('offer letter with a company DSC: two signature fields, one signed (PAdES)', async () => {
    const pdfPath = await writeTemp();
    const result = await finalizeCertificatePdf(pdfPath, {
      verifyUrl: 'http://localhost:3000/verify/CF-TEST-0001',
      publicId: 'CF-TEST-0001',
      signer: { p12: makeSelfSignedP12('pw'), passphrase: 'pw' },
      addEmployeeField: true
    });
    expect(result.signed).toBe(true);
    const out = await fs.readFile(pdfPath);
    expect(countFields(out)).toBe(2); // employer + employee
    expect(countSigned(out)).toBe(1); // only employer is signed
    expect(out.toString('latin1')).toMatch(/ETSI\.CAdES\.detached/);
    await fs.unlink(pdfPath);
  });

  it('offer letter without a DSC: two empty signature fields, none signed', async () => {
    const pdfPath = await writeTemp();
    const result = await finalizeCertificatePdf(pdfPath, {
      verifyUrl: 'http://localhost:3000/verify/CF-TEST-0002',
      publicId: 'CF-TEST-0002',
      signer: null,
      addEmployeeField: true
    });
    expect(result.signed).toBe(false);
    const out = await fs.readFile(pdfPath);
    expect(countFields(out)).toBe(2);
    expect(countSigned(out)).toBe(0);
    await fs.unlink(pdfPath);
  });

  it('certificate (no employee field) with DSC: one signed field', async () => {
    const pdfPath = await writeTemp();
    const result = await finalizeCertificatePdf(pdfPath, {
      verifyUrl: 'http://localhost:3000/verify/CF-TEST-0003',
      publicId: 'CF-TEST-0003',
      signer: { p12: makeSelfSignedP12('pw'), passphrase: 'pw' },
      addEmployeeField: false
    });
    expect(result.signed).toBe(true);
    const out = await fs.readFile(pdfPath);
    expect(countFields(out)).toBe(1);
    expect(countSigned(out)).toBe(1);
    await fs.unlink(pdfPath);
  });
});
