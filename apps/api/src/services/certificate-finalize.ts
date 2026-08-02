import fs from 'node:fs/promises';
import QRCode from 'qrcode';
import { PDFDocument, PDFName, PDFArray, PDFString, StandardFonts, rgb } from 'pdf-lib';
import signpdf from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { SUBFILTER_ETSI_CADES_DETACHED } from '@signpdf/utils';
import { env } from '../config/env';

/** The company's Digital Signature Certificate (DSC), decrypted for signing. */
export type CompanySigner = { p12: Buffer; passphrase: string };

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

  page.drawRectangle({ x: x - 4, y: y - 4, width: qrSize + 8, height: qrSize + 16, color: rgb(1, 1, 1), opacity: 0.82 });
  page.drawImage(qrImage, { x, y: y + 10, width: qrSize, height: qrSize });
  page.drawText(publicId, { x, y: y + 1, size: Math.max(5, qrSize * 0.11), font, color: rgb(0.04, 0.11, 0.23) });

  return pdfDoc.save({ useObjectStreams: false });
}

/**
 * Add an EMPTY, Adobe-recognised signature field (AcroForm /FT /Sig widget with no value) at the
 * given rectangle, plus a thin baseline + caption so a human knows where to sign. This is what lets
 * the authorized signatory or the candidate apply their own DSC later in Adobe / a signing utility.
 */
function addEmptySignatureField(
  pdfDoc: PDFDocument,
  opts: { name: string; caption: string; x: number; y: number; w: number; h: number }
) {
  const context = pdfDoc.context;
  const page = pdfDoc.getPage(0);

  // Visible baseline + caption (drawn content; the widget itself is invisible until signed).
  page.drawLine({
    start: { x: opts.x, y: opts.y + opts.h },
    end: { x: opts.x + opts.w, y: opts.y + opts.h },
    thickness: 0.8,
    color: rgb(0.55, 0.42, 0.28)
  });

  const widget = context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: [opts.x, opts.y, opts.x + opts.w, opts.y + opts.h],
    T: PDFString.of(opts.name),
    F: 4, // Print
    P: page.ref
  });
  const widgetRef = context.register(widget);

  // Attach the widget to the page's annotations.
  const existing = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (existing) existing.push(widgetRef);
  else page.node.set(PDFName.of('Annots'), context.obj([widgetRef]));

  // Ensure an AcroForm exists, mark it as containing signatures, and register the field.
  const form = pdfDoc.getForm();
  const acroDict = form.acroForm.dict;
  const fields = acroDict.lookupMaybe(PDFName.of('Fields'), PDFArray) ?? context.obj([]);
  fields.push(widgetRef);
  acroDict.set(PDFName.of('Fields'), fields);
  // SigFlags 3 = SignaturesExist | AppendOnly, so viewers offer the signing UI.
  acroDict.set(PDFName.of('SigFlags'), context.obj(3));

  return opts.caption; // caption is drawn by the caller if desired; returned for clarity
}

export type FinalizeResult = { signed: boolean };

/**
 * Post-process an issued PDF in place:
 *  1. Always stamp the verification QR + credential ID.
 *  2. Add an "Authorized Signatory" signature field; if a company DSC is supplied, PAdES-sign it
 *     server-side (bulk auto-sign). Otherwise leave it empty for manual Adobe signing.
 *  3. For offer letters, add a second empty "Accepted by (Candidate)" field for the recipient to
 *     counter-sign in Adobe after they verify.
 * Signing failures fall back to the QR-stamped PDF so issuance never breaks.
 */
export async function finalizeCertificatePdf(
  pdfPath: string,
  opts: { verifyUrl: string; publicId: string; signer?: CompanySigner | null; addEmployeeField?: boolean }
): Promise<FinalizeResult> {
  const original = await fs.readFile(pdfPath);
  const stamped = Buffer.from(await stampQr(original, opts.verifyUrl, opts.publicId));

  // Lay out the fields relative to the page so it works for any template size.
  const layoutDoc = await PDFDocument.load(stamped);
  const { width, height } = layoutDoc.getPage(0).getSize();
  const fieldW = width * 0.3;
  const fieldH = height * 0.045;
  const baseY = height * 0.11;
  const employerRect = { name: 'AuthorizedSignatory', caption: 'Authorized Signatory', x: width * 0.1, y: baseY, w: fieldW, h: fieldH };
  const employeeRect = { name: 'CandidateAcceptance', caption: 'Accepted by (Candidate)', x: width * 0.42, y: baseY, w: fieldW, h: fieldH };

  if (!env.CERT_SIGNING_ENABLED) {
    // Signing globally off — still prepare empty fields so documents can be signed in Adobe.
    addEmptySignatureField(layoutDoc, employerRect);
    if (opts.addEmployeeField) addEmptySignatureField(layoutDoc, employeeRect);
    await fs.writeFile(pdfPath, Buffer.from(await layoutDoc.save({ useObjectStreams: false })));
    return { signed: false };
  }

  try {
    if (opts.signer) {
      // Add the empty employee field first (part of the content the employer signature will cover),
      // then add the employer placeholder and sign it with the company DSC.
      if (opts.addEmployeeField) addEmptySignatureField(layoutDoc, employeeRect);
      pdflibAddPlaceholder({
        pdfDoc: layoutDoc,
        reason: `Issued & verifiable at ${opts.verifyUrl}`,
        contactInfo: 'verify.certiflow',
        name: 'Authorized Signatory',
        location: 'CertiFlow',
        subFilter: SUBFILTER_ETSI_CADES_DETACHED
      });
      const withPlaceholder = Buffer.from(await layoutDoc.save({ useObjectStreams: false }));
      const signer = new P12Signer(opts.signer.p12, { passphrase: opts.signer.passphrase });
      const signed = await signpdf.sign(withPlaceholder, signer);
      await fs.writeFile(pdfPath, signed);
      return { signed: true };
    }

    // No company DSC: prepare empty fields for manual Adobe signing (employer + optional employee).
    addEmptySignatureField(layoutDoc, employerRect);
    if (opts.addEmployeeField) addEmptySignatureField(layoutDoc, employeeRect);
    await fs.writeFile(pdfPath, Buffer.from(await layoutDoc.save({ useObjectStreams: false })));
    return { signed: false };
  } catch (error) {
    console.warn('Certificate finalize/signing failed, storing QR-stamped PDF:', error instanceof Error ? error.message : error);
    await fs.writeFile(pdfPath, stamped);
    return { signed: false };
  }
}
