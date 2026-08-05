import fs from 'node:fs/promises';
import QRCode from 'qrcode';
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFNumber,
  PDFString,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import signpdf from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { SUBFILTER_ETSI_CADES_DETACHED } from '@signpdf/utils';
import { env } from '../config/env';

/** The company's Digital Signature Certificate (DSC), decrypted for signing. */
export type CompanySigner = { p12: Buffer; passphrase: string };

/** A signature-field rectangle in PDF user space (origin bottom-left). */
type FieldRect = { name: string; x: number; y: number; w: number; h: number };
type QrBox = { x: number; y: number; size: number; margin: number };

async function stampQr(pdfBytes: Buffer, verifyUrl: string, publicId: string): Promise<{ bytes: Uint8Array; qr: QrBox }> {
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

  page.drawRectangle({ x: x - 4, y: y - 4, width: qrSize + 8, height: qrSize + 16, color: rgb(1, 1, 1), opacity: 0.82 });
  page.drawImage(qrImage, { x, y: y + 10, width: qrSize, height: qrSize });
  page.drawText(publicId, { x, y: y + 1, size: Math.max(5, qrSize * 0.11), font, color: rgb(0.04, 0.11, 0.23) });

  return { bytes: await pdfDoc.save({ useObjectStreams: false }), qr: { x, y, size: qrSize, margin } };
}

async function drawSignatureAppearance(
  pdfDoc: PDFDocument,
  rect: FieldRect,
  signerName: string
) {
  const page = pdfDoc.getPage(0);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const now = new Date();
  const date = now.toLocaleDateString();

  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.w,
    height: rect.h,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0)
  });

  page.drawText("Digitally signed by", {
  x: rect.x + 8,
  y: rect.y + rect.h - 18,
  size: 8,
  font
});

page.drawText(signerName, {
  x: rect.x + 8,
  y: rect.y + rect.h - 32,
  size: 10,
  font
});

page.drawText(`Date: ${date}`, {
  x: rect.x + 8,
  y: rect.y + 10,
  size: 8,
  font
});
}

function addUnsignedSignatureField(pdfDoc: PDFDocument, rect: FieldRect) {
  const context = pdfDoc.context;
  const page = pdfDoc.getPage(0);
  const rectArr = [rect.x, rect.y, rect.x + rect.w, rect.y + rect.h];

  // Empty normal appearance. The BBox + empty Resources dict are the known Acrobat workaround that
  // makes Reader render/repair the field's appearance instead of ignoring it.
  const apStream = context.formXObject([], { BBox: rectArr, Resources: {} });

  const widget = context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: rectArr,
    T: PDFString.of(rect.name),
    F: 4, // Print
    P: page.ref,
    AP: { N: context.register(apStream) }
  });
  const widgetRef = context.register(widget);

  const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (annots) annots.push(widgetRef);
  else page.node.set(PDFName.of('Annots'), context.obj([widgetRef]));

  let acroForm = pdfDoc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  if (!acroForm) {
    acroForm = context.obj({ Fields: [] });
    pdfDoc.catalog.set(PDFName.of('AcroForm'), context.register(acroForm));
  }
  const existingFlags = acroForm.lookupMaybe(PDFName.of('SigFlags'), PDFNumber);
  // SigFlags 3 = SignaturesExist | AppendOnly, so viewers offer the signing UI.
  acroForm.set(PDFName.of('SigFlags'), PDFNumber.of((existingFlags?.asNumber() ?? 0) | 3));
  let fields = acroForm.lookupMaybe(PDFName.of('Fields'), PDFArray);
  if (!fields) {
    fields = context.obj([]) as PDFArray;
    acroForm.set(PDFName.of('Fields'), fields);
  }
  fields.push(widgetRef);
}

export type FinalizeResult = { signed: boolean };

/**
 * Post-process an issued PDF in place:
 *  1. Stamp the verification QR + credential id in the bottom-right.
 *  2. Place a real interactive digital-signature field in the bottom-left:
 *     - With a company DSC: a VISIBLE PAdES signature field is placed and signed server-side. Adobe
 *       renders its own signature appearance on it — for a self-issued DSC that is the familiar
 *       "?" / "Signature not verified" state, on a genuine (cryptographically valid, tamper-evident)
 *       `/Sig` field, not a drawn badge.
 *     - Without a DSC: an EMPTY `/Sig` field so the signatory can sign it in Adobe with their Digital ID.
 *  3. For offer letters, additionally add an empty "Accepted by (Candidate)" `/Sig` field the recipient
 *     clicks to counter-sign in Adobe after verifying.
 * Signing failures fall back to the QR-stamped PDF so issuance never breaks.
 */
export async function finalizeCertificatePdf(
  pdfPath: string,
  opts: {
    verifyUrl: string;
    publicId: string;
    signer?: CompanySigner | null;
    companyName?: string;
    addEmployeeField?: boolean;
  }
): Promise<FinalizeResult> {
  const original = await fs.readFile(pdfPath);
  const { bytes: qrStampedBytes, qr } = await stampQr(original, opts.verifyUrl, opts.publicId);
  const stamped = Buffer.from(qrStampedBytes);

  const layoutDoc = await PDFDocument.load(stamped);
  const { width } = layoutDoc.getPage(0).getSize();

  // Signature field(s) sit in the bottom-left, mirroring the QR in the bottom-right.
  const sigW = Math.min(width * 0.34, 215);
  const employerRect: FieldRect = {
  name: 'AuthorizedSignatory',
  x: qr.margin,
  y: qr.y,
  w: sigW,
  h: qr.size
};
  const candidateRect: FieldRect = {
    name: 'CandidateAcceptance',
    x: qr.margin,
    y: qr.y + qr.size + 12,
    w: sigW,
    h: Math.max(34, qr.size * 0.5)
  };
  const signerDisplayName = opts.companyName ? `${opts.companyName} (Authorized Signatory)` : 'Authorized Signatory';

  if (!env.CERT_SIGNING_ENABLED) {
    addUnsignedSignatureField(layoutDoc, employerRect);
    if (opts.addEmployeeField) addUnsignedSignatureField(layoutDoc, candidateRect);
    await fs.writeFile(pdfPath, Buffer.from(await layoutDoc.save({ useObjectStreams: false })));
    return { signed: false };
  }

  try {
    if (opts.signer) {
      // The candidate field must exist BEFORE we sign, so it is covered by the employer signature.
      if (opts.addEmployeeField) addUnsignedSignatureField(layoutDoc, candidateRect);

      await drawSignatureAppearance(layoutDoc, employerRect, signerDisplayName);

      // VISIBLE PAdES signature for the authorized signatory (widgetRect makes it an on-page field, not
      // the library default invisible [0,0,0,0] one). Adobe draws its signature/validity appearance here.
      pdflibAddPlaceholder({
        pdfDoc: layoutDoc,
        reason: `Issued & verifiable at ${opts.verifyUrl}`,
        contactInfo: 'verify.certiflow',
        name: signerDisplayName,
        location: 'CertiFlow',
        subFilter: SUBFILTER_ETSI_CADES_DETACHED,
        widgetRect: [employerRect.x, employerRect.y, employerRect.x + employerRect.w, employerRect.y + employerRect.h]
      });
      const withPlaceholder = Buffer.from(await layoutDoc.save({ useObjectStreams: false }));
      const signer = new P12Signer(opts.signer.p12, { passphrase: opts.signer.passphrase });
      const signed = await signpdf.sign(withPlaceholder, signer);
      await fs.writeFile(pdfPath, signed);
      return { signed: true };
    }

    // No DSC: leave the authorized-signatory field empty so it can be signed in Adobe.
    addUnsignedSignatureField(layoutDoc, employerRect);
    if (opts.addEmployeeField) addUnsignedSignatureField(layoutDoc, candidateRect);
    await fs.writeFile(pdfPath, Buffer.from(await layoutDoc.save({ useObjectStreams: false })));
    return { signed: false };
  } catch (error) {
    console.warn('Certificate finalize/signing failed, storing QR-stamped PDF:', error instanceof Error ? error.message : error);
    await fs.writeFile(pdfPath, stamped);
    return { signed: false };
  }
}
