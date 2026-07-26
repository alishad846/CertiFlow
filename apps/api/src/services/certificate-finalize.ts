import fs from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';
import forge from 'node-forge';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import signpdf from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { env } from '../config/env';
import { ensureDir } from './fs';

let cachedP12: Buffer | null = null;

/** Load a configured P12, or lazily create + cache a self-signed dev one. */
async function getSigningP12(): Promise<Buffer> {
  if (cachedP12) {
    return cachedP12;
  }
  if (env.CERT_SIGNING_P12_PATH) {
    cachedP12 = await fs.readFile(env.CERT_SIGNING_P12_PATH);
    return cachedP12;
  }

  const devPath = path.join(env.CERT_STORE_DIR, 'signing', 'dev-signing.p12');
  try {
    cachedP12 = await fs.readFile(devPath);
    return cachedP12;
  } catch {
    // generate a fresh self-signed P12 (dev only — replace with a CA cert in prod)
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
    const attrs = [
      { name: 'commonName', value: 'CertiFlow' },
      { name: 'organizationName', value: 'CertiFlow' },
      { name: 'countryName', value: 'IN' }
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());
    const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], env.CERT_SIGNING_P12_PASSPHRASE, {
      algorithm: '3des'
    });
    const der = forge.asn1.toDer(asn1).getBytes();
    cachedP12 = Buffer.from(der, 'binary');
    await ensureDir(path.dirname(devPath));
    await fs.writeFile(devPath, cachedP12);
    return cachedP12;
  }
}

async function stampQr(pdfBytes: Buffer, verifyUrl: string, publicId: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const qrPng = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 300 });
  const qrImage = await pdfDoc.embedPng(qrPng);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.getPage(0);
  const { width } = page.getSize();
  const qrSize = Math.max(48, Math.min(96, width * 0.13));
  const margin = Math.max(10, width * 0.02);
  const x = width - margin - qrSize;
  const y = margin;

  // subtle white backing so the QR stays scannable over busy artwork
  page.drawRectangle({
    x: x - 4,
    y: y - 4,
    width: qrSize + 8,
    height: qrSize + 16,
    color: rgb(1, 1, 1),
    opacity: 0.82
  });
  page.drawImage(qrImage, { x, y: y + 10, width: qrSize, height: qrSize });
  page.drawText(publicId, {
    x,
    y: y + 1,
    size: Math.max(5, qrSize * 0.11),
    font,
    color: rgb(0.04, 0.11, 0.23)
  });

  return pdfDoc.save({ useObjectStreams: false });
}

export type FinalizeResult = { signed: boolean };

/**
 * Post-process an issued certificate PDF in place: stamp the verification QR +
 * credential ID, then digitally sign (PAdES). Signing failures fall back to the
 * QR-stamped (unsigned) PDF so issuance never breaks.
 */
export async function finalizeCertificatePdf(
  pdfPath: string,
  opts: { verifyUrl: string; publicId: string }
): Promise<FinalizeResult> {
  const original = await fs.readFile(pdfPath);
  const stamped = Buffer.from(await stampQr(original, opts.verifyUrl, opts.publicId));

  if (!env.CERT_SIGNING_ENABLED) {
    await fs.writeFile(pdfPath, stamped);
    return { signed: false };
  }

  try {
    const pdfDoc = await PDFDocument.load(stamped);
    pdflibAddPlaceholder({
      pdfDoc,
      reason: `Issued & verifiable at ${opts.verifyUrl}`,
      contactInfo: 'verify.certiflow',
      name: 'CertiFlow',
      location: 'CertiFlow'
    });
    const withPlaceholder = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
    const signer = new P12Signer(await getSigningP12(), { passphrase: env.CERT_SIGNING_P12_PASSPHRASE });
    const signed = await signpdf.sign(withPlaceholder, signer);
    await fs.writeFile(pdfPath, signed);
    return { signed: true };
  } catch (error) {
    console.warn('Certificate signing failed, storing unsigned QR PDF:', error instanceof Error ? error.message : error);
    await fs.writeFile(pdfPath, stamped);
    return { signed: false };
  }
}
