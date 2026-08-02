import path from 'path';
import fs from 'fs/promises';
import { Job } from 'bullmq';
import type { Browser } from 'puppeteer';
import { pool } from '../db/pool';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { buildTemplateContext } from '../services/excel';
import { renderDocxTemplate } from '../services/docx';
import { convertDocxToPdf } from '../services/pdf';
import { renderPdfTemplate } from '../services/pdf-template';
import { sendEmail } from '../services/email';
import { renderPersonalizedAttachment } from '../services/attachment-template';
import {
  getActiveCertificateTemplate,
  getCertificateTemplateById,
  resolveCertificateIssueDate
} from '../services/certificate-templates';
import { renderCertificatePdf, renderCertificateBackgroundPreviewPage } from '../services/certificate-render';
import { renderEditorPdf, launchRenderBrowser } from '../services/editor-render';
import { ensureDir, safeSegment } from '../services/fs';
import { emailQueue } from '../services/queue';
import { renderTemplateString } from '../services/template-placeholders';
import { issueCertificate, allocateUniquePublicId } from '../services/certificates';
import { finalizeCertificatePdf } from '../services/certificate-finalize';
import { recordCertificateUsage } from '../services/subscriptions';
import { loadCompanyDscForSigning } from '../services/company-signing';

function buildClaimEmailHtml(
  message: string,
  context: Record<string, unknown>,
  claimUrl: string,
  meta: { companyName: string; isOfferLetter: boolean }
) {
  const name = String(context?.name ?? '').trim() || 'there';
  const resolved = renderTemplateString(
    message || `Congratulations ${name}! Your certificate is ready to claim.`,
    context
  ).trim();
  const safe = escapeHtml(resolved || `Congratulations ${name}!`).replace(/\r?\n/g, '<br>');
  const documentLabel = meta.isOfferLetter ? 'Offer Letter' : 'Certificate';
  const companyName = escapeHtml(meta.companyName || 'CertiFlow');

  // Table-based, inline-styled markup — the layout email clients (Gmail/Outlook/Apple Mail) render
  // consistently; no external CSS/webfonts, only websafe serif/mono stacks that approximate the
  // product's Cormorant/JetBrains Mono look while degrading gracefully.
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#e7e2d9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding-bottom:22px;">
              <span style="font-family:'Courier New',Courier,monospace;font-size:12px;letter-spacing:6px;color:#0b1b3a;text-transform:uppercase;">CertiFlow</span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f5f0e6;border:1px solid #d8ceb4;border-radius:20px;padding:0;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:5px;background-color:#b8922e;border-radius:20px 20px 0 0;line-height:5px;font-size:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:40px 44px 8px;text-align:center;">
                    <span style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:4px;color:#8a6e22;text-transform:uppercase;">A ${documentLabel} from ${companyName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 44px 0;text-align:center;">
                    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.35;color:#0b1b3a;">${safe}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:30px 44px 6px;text-align:center;">
                    <a href="${claimUrl}" style="display:inline-block;background-color:#0b1b3a;color:#f5f0e6;text-decoration:none;padding:15px 40px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.06em;">CLAIM NOW</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 44px 40px;text-align:center;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:#857a66;">Or open this link in your browser:<br>
                      <a href="${claimUrl}" style="color:#8a6e22;word-break:break-all;">${claimUrl}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:26px;">
              <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:3px;color:#857a66;text-transform:uppercase;">Secured &amp; verified by CertiFlow</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type BatchTemplateFile = {
  path: string;
  originalName: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailHtml(message: string, context: Record<string, unknown>, attachmentMessage?: string | null) {
  const name = String(context?.name ?? '').trim() || 'Recipient';
  const resolvedMessage = renderTemplateString(message || '', context).trim();
  const resolvedAttachment = renderTemplateString(attachmentMessage || '', context).trim();

  const parts = [`<p>${escapeHtml(resolvedMessage || `Hello ${name},`).replace(/\r?\n/g, '<br>')}</p>`];
  if (resolvedAttachment) {
    parts.push(`<p>${escapeHtml(resolvedAttachment).replace(/\r?\n/g, '<br>')}</p>`);
  }

  return parts.join('');
}

async function getBatchTemplateFiles(batchId: string, fallbackTemplateUploadId: string | null) {
  const templates = await pool.query<{
    template_order: number;
    stored_path: string;
    original_name: string;
  }>(
    `SELECT bt.template_order, u.stored_path, u.original_name
     FROM batch_templates bt
     INNER JOIN uploads u ON u.id = bt.upload_id
     WHERE bt.batch_id = $1
     ORDER BY bt.template_order ASC`,
    [batchId]
  );

  if (templates.rows.length > 0) {
    return templates.rows.map((row) => ({
      path: row.stored_path,
      originalName: row.original_name
    })) as BatchTemplateFile[];
  }

  if (!fallbackTemplateUploadId) {
    throw new AppError('Template file missing', 400);
  }

  const legacyTemplate = await pool.query<{
    stored_path: string;
    original_name: string;
  }>('SELECT stored_path, original_name FROM uploads WHERE id = $1', [fallbackTemplateUploadId]);

  const template = legacyTemplate.rows[0];
  if (!template?.stored_path) {
    throw new AppError('Template file missing', 400);
  }

  return [
    {
      path: template.stored_path,
      originalName: template.original_name
    }
  ] as BatchTemplateFile[];
}

async function getBatchAttachments(batchId: string) {
  const result = await pool.query<{
    stored_path: string;
    original_name: string;
  }>(
    `SELECT stored_path, original_name
     FROM batch_attachments
     WHERE batch_id = $1
     ORDER BY attachment_order ASC`,
    [batchId]
  );

  return result.rows.map((row) => ({
    path: row.stored_path,
    filename: row.original_name
  }));
}

async function refreshBatchCounts(batchId: string) {
  const currentBatch = await pool.query<{ status: string }>('SELECT status FROM batches WHERE id = $1', [batchId]);
  const counts = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE email_status = 'sent')::int AS sent,
       COUNT(*) FILTER (WHERE email_status = 'failed')::int AS failed,
       COUNT(*) FILTER (WHERE generated_docx_path IS NOT NULL OR generated_pdf_path IS NOT NULL)::int AS processed
     FROM documents
     WHERE batch_id = $1`,
    [batchId]
  );

  const row = counts.rows[0];
  const terminalStatus = row.failed + row.sent === row.total ? (row.failed > 0 ? 'completed_with_failures' : 'completed') : 'sending';
  const currentStatus = currentBatch.rows[0]?.status ?? 'queued';
  const status =
    currentStatus === 'completed' || currentStatus === 'completed_with_failures' || currentStatus === 'failed'
      ? currentStatus
      : terminalStatus;
  await pool.query(
    `UPDATE batches
     SET processed_rows = $2, sent_count = $3, failed_count = $4, status = $5, updated_at = NOW()
     WHERE id = $1`,
    [batchId, row.processed, row.sent, row.failed, status]
  );
}

async function markDocumentFailed(documentId: string, batchId: string, errorMessage: string) {
  await pool.query(
    `UPDATE documents
     SET status = 'failed', email_status = 'failed', error_message = $2, updated_at = NOW()
     WHERE id = $1`,
    [documentId, errorMessage]
  );
  await pool.query(
    `INSERT INTO email_logs (id, company_id, document_id, status, error_message)
     VALUES (gen_random_uuid(), (SELECT company_id FROM documents WHERE id = $1), $1, 'failed', $2)`,
    [documentId, errorMessage]
  );
  await refreshBatchCounts(batchId);
}

export async function processBatchJob(job: Job<{ batchId: string }>) {
  const batchResult = await pool.query<{
    id: string;
    company_id: string;
    template_upload_id: string | null;
    certificate_template_id: string | null;
    name: string;
    template_type: 'certificate' | 'offer_letter';
    sender_email: string | null;
    sender_name: string | null;
    email_message: string | null;
    attachment_message: string | null;
  }>(
    `SELECT b.id, b.company_id, b.template_upload_id, b.certificate_template_id, b.name, b.template_type,
            b.sender_email, b.sender_name, b.email_message, b.attachment_message
     FROM batches b
     WHERE b.id = $1`,
    [job.data.batchId]
  );

  const batch = batchResult.rows[0];
  if (!batch) {
    throw new AppError('Batch not found', 404);
  }

  const batchAttachments = await getBatchAttachments(batch.id);
  const templateFiles = batch.template_type === 'offer_letter' ? await getBatchTemplateFiles(batch.id, batch.template_upload_id) : [];
  const certificateTemplate =
    batch.template_type === 'certificate'
      ? batch.certificate_template_id
        ? await getCertificateTemplateById(batch.certificate_template_id, batch.company_id)
        : await getActiveCertificateTemplate(batch.company_id)
      : null;

  await pool.query(`UPDATE batches SET status = 'processing', updated_at = NOW() WHERE id = $1`, [batch.id]);

  const isCertificateBatch = batch.template_type === 'certificate' && Boolean(certificateTemplate);
  const appBase = env.APP_URL.replace(/\/+$/, '');
  const claimSettingsResult = isCertificateBatch
    ? await pool.query<{ claim_message: string | null; claim_subject: string | null }>(
        `SELECT claim_message, claim_subject FROM company_email_settings WHERE company_id = $1`,
        [batch.company_id]
      )
    : null;
  const claimMessage = claimSettingsResult?.rows[0]?.claim_message ?? batch.email_message ?? '';
  const claimSubject = claimSettingsResult?.rows[0]?.claim_subject ?? batch.name;

  const docsResult = await pool.query<{
    id: string;
    recipient_name: string;
    recipient_email: string;
    source_data: Record<string, unknown>;
    row_index: number;
  }>(
    `SELECT id, recipient_name, recipient_email, source_data, row_index
     FROM documents
     WHERE batch_id = $1
     ORDER BY row_index ASC`,
    [batch.id]
  );

  const outputRoot = path.join(env.UPLOAD_DIR, `company-${batch.company_id}`, batch.id, 'generated');
  await ensureDir(outputRoot);
  const pdfDir = path.join(outputRoot, 'pdf');
  await ensureDir(pdfDir);

  // Editor-engine certificates are rendered by a headless browser. Launch one Chromium for the whole
  // batch and share it across recipients — per-recipient launches would dominate the render cost.
  const needsEditorRender =
    isCertificateBatch &&
    certificateTemplate?.renderEngine === 'editor' &&
    Boolean(certificateTemplate?.editorDocument);
  let renderBrowser: Browser | null = null;
  if (needsEditorRender) {
    try {
      renderBrowser = await launchRenderBrowser();
    } catch (error) {
      // Fall back to per-recipient launches inside renderEditorPdf if the shared launch fails.
      console.warn(
        'Failed to launch shared render browser; will retry per recipient:',
        error instanceof Error ? error.message : error
      );
    }
  }

  try {
  for (let index = 0; index < docsResult.rows.length; index += 50) {
    const chunk = docsResult.rows.slice(index, index + 50);

    for (const document of chunk) {
      const context = buildTemplateContext(document.source_data as any);
      const certificateContext =
        batch.template_type === 'certificate' && certificateTemplate
          ? {
              ...context,
              issue_date: resolveCertificateIssueDate(certificateTemplate)
            }
          : context;
      const safeName = safeSegment(document.recipient_name || 'recipient');
      const generatedAttachments: Array<{ path: string; filename: string }> = [];
      const personalizedAttachmentDir = path.join(outputRoot, 'attachments', `${document.row_index}-${safeName}`);
      let primaryDocxPath: string | null = null;
      let primaryPdfPath: string | null = null;
      let claimUrl: string | null = null;
      let isOfferLetter = false;

      try {
        if (batch.template_type === 'certificate' && certificateTemplate) {
          const baseName = `${document.row_index}-${safeName}`;
          const certificateDir = path.join(outputRoot, 'certificate');

          // Reserve the public id up-front so it can be merged into the design (an editor template may
          // print `{{certificate_id}}` on the certificate itself) and reused by the QR + signing step.
          const publicId = await allocateUniquePublicId();

          let renderedPdfPath: string;
          let renderedPngPath: string | null = null;

          if (certificateTemplate.renderEngine === 'editor' && certificateTemplate.editorDocument) {
            // Canva-editor design → headless render at native size, merged per recipient.
            await ensureDir(certificateDir);
            renderedPdfPath = path.join(certificateDir, `${safeSegment(baseName)}.pdf`);
            const { pdf } = await renderEditorPdf({
              editorDocument: certificateTemplate.editorDocument,
              context: { ...certificateContext, certificate_id: publicId },
              browser: renderBrowser ?? undefined
            });
            await fs.writeFile(renderedPdfPath, pdf);
          } else {
            // Legacy coordinate template → composite text fields over the background image/PDF.
            const rendered = await renderCertificatePdf({
              backgroundPath: certificateTemplate.backgroundStoredPath,
              fields: certificateTemplate.fieldConfig,
              context: certificateContext,
              outputDir: certificateDir,
              baseName
            });
            renderedPdfPath = rendered.pdfPath;
            renderedPngPath = rendered.pngPath;
          }

          primaryDocxPath = renderedPngPath;
          primaryPdfPath = renderedPdfPath;

          // Certificate flow: stamp a verification QR, add signature field(s), and auto-sign with the
          // company DSC when configured. Then store it in the gated store, create the verifiable
          // certificate + claim records, and email a claim link instead of attaching the PDF.
          const companyDsc = await loadCompanyDscForSigning(batch.company_id);
          // Offer-letter templates (built from an offer-letter design) get a candidate counter-sign
          // field; plain certificates get only the authorized-signatory field.
          const offerLetterRow = await pool.query<{ is_offer_letter: boolean }>(
            'SELECT is_offer_letter FROM certificate_templates WHERE id = $1',
            [certificateTemplate.id]
          );
          isOfferLetter = Boolean(offerLetterRow.rows[0]?.is_offer_letter);
          const finalized = await finalizeCertificatePdf(renderedPdfPath, {
            verifyUrl: `${appBase}/verify/${publicId}`,
            publicId,
            signer: companyDsc,
            companyName: batch.sender_name ?? undefined,
            addEmployeeField: isOfferLetter
          });
          await recordCertificateUsage(batch.company_id);

          // Best-effort page-1 raster for the claim-page preview, done once here instead of on every
          // page view. Never blocks issuance — a failure just means the claim page shows no preview.
          let previewPngBuffer: Buffer | null = null;
          try {
            const preview = await renderCertificateBackgroundPreviewPage(renderedPdfPath, 1);
            previewPngBuffer = preview.buffer;
          } catch (error) {
            console.warn('Certificate preview render failed, continuing without one:', error instanceof Error ? error.message : error);
          }

          const issued = await issueCertificate({
            companyId: batch.company_id,
            batchId: batch.id,
            documentId: document.id,
            templateId: certificateTemplate.id,
            recipientName: document.recipient_name,
            recipientEmail: document.recipient_email,
            title: certificateTemplate.name ?? batch.name,
            sourcePdfPath: renderedPdfPath,
            dataSnapshot: certificateContext as Record<string, unknown>,
            publicId,
            signed: finalized.signed,
            previewPngBuffer
          });
          claimUrl = `${appBase}/claim/${issued.claimToken}`;
        } else {
          for (let templateIndex = 0; templateIndex < templateFiles.length; templateIndex += 1) {
            const template = templateFiles[templateIndex];
            const templateBase = safeSegment(
              path.basename(template.originalName, path.extname(template.originalName)) || `template-${templateIndex + 1}`
            );
            const suffix = `${templateIndex + 1}-${templateBase}`;
            const pdfName = `${document.row_index}-${safeName}-${suffix}.pdf`;
            const templateExt = path.extname(template.originalName).toLowerCase();
            const pdfPath = path.join(pdfDir, pdfName);

            if (templateExt === '.pdf') {
              await renderPdfTemplate({
                templatePath: template.path,
                outputPath: pdfPath,
                data: context
              });
              if (!primaryPdfPath) {
                primaryPdfPath = pdfPath;
              }
            } else {
              const docxPath = path.join(outputRoot, `${document.row_index}-${safeName}-${suffix}.docx`);
              await renderDocxTemplate({
                templatePath: template.path,
                outputPath: docxPath,
                data: context
              });

              const convertedPdfPath = await convertDocxToPdf(docxPath, pdfDir);
              if (!primaryDocxPath) {
                primaryDocxPath = docxPath;
                primaryPdfPath = convertedPdfPath;
              }
              generatedAttachments.push({
                path: convertedPdfPath,
                filename: path.basename(convertedPdfPath)
              });
              continue;
            }
            generatedAttachments.push({
              path: pdfPath,
              filename: pdfName
            });
          }
        }

        const extraAttachments = batchAttachments.length
          ? await Promise.all(
              batchAttachments.map((attachment) =>
                renderPersonalizedAttachment({
                  templatePath: attachment.path,
                  originalName: attachment.filename,
                  outputDir: personalizedAttachmentDir,
                  data: certificateContext,
                  overlayTemplate: batch.attachment_message ?? undefined
                })
              )
            )
          : [];

        if (primaryDocxPath || primaryPdfPath) {
          await pool.query(
            `UPDATE documents
             SET generated_docx_path = $2, generated_pdf_path = $3, status = 'processing', updated_at = NOW()
             WHERE id = $1`,
            [document.id, primaryDocxPath ?? null, primaryPdfPath ?? null]
          );
        } else {
          await pool.query(
            `UPDATE documents
             SET status = 'processing', updated_at = NOW()
             WHERE id = $1`,
            [document.id]
          );
        }

        // Certificate: send a claim link, no PDF attachment (only company extras).
        // Other document types: keep attaching the generated PDF(s).
        const emailAttachments = claimUrl ? extraAttachments : [...generatedAttachments, ...extraAttachments];
        const emailHtml = claimUrl
          ? buildClaimEmailHtml(claimMessage, certificateContext, claimUrl, {
              companyName: batch.sender_name ?? 'CertiFlow',
              isOfferLetter
            })
          : buildEmailHtml(batch.email_message ?? '', certificateContext, batch.attachment_message ?? undefined);
        const emailSubject = claimUrl ? claimSubject : batch.name;

        await emailQueue.add(
          'send-email',
          {
            companyId: batch.company_id,
            batchId: batch.id,
            documentId: document.id,
            recipientName: document.recipient_name,
            recipientEmail: document.recipient_email,
            subject: emailSubject,
            html: emailHtml,
            pdfPath: emailAttachments[0]?.path,
            attachmentName: emailAttachments[0]?.filename,
            attachments: emailAttachments,
            senderEmail: batch.sender_email ?? undefined,
            senderName: batch.sender_name ?? undefined
          },
          {
  attempts: 3,

  delay: Math.floor(Math.random() * env.EMAIL_QUEUE_JITTER_MS),

  backoff: {
    type: 'exponential',
    delay: 5000
  }
}
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate document';
        await markDocumentFailed(document.id, batch.id, message);
      }
    }

    await refreshBatchCounts(batch.id);
    if (index + 50 < docsResult.rows.length) {
      await sleep(env.EMAIL_BATCH_DELAY_MS);
    }
  }
  } finally {
    if (renderBrowser) {
      await renderBrowser.close().catch(() => undefined);
    }
  }

  await pool.query(
    `UPDATE batches
     SET status = 'sending', updated_at = NOW()
     WHERE id = $1 AND status NOT IN ('completed', 'completed_with_failures', 'failed')`,
    [batch.id]
  );
}

export async function processEmailJob(
  job: Job<{
    companyId: string;
    batchId: string;
    documentId: string;
    recipientName: string;
    recipientEmail: string;
    subject: string;
    html: string;
    pdfPath?: string;
    attachmentName?: string;
    attachments?: Array<{
      path: string;
      filename: string;
    }>;
    senderEmail?: string;
    senderName?: string;
  }>
) {
 const documentResult = await pool.query<{
  email_status: string;
  batch_id: string;
}>(
  `UPDATE documents
   SET email_status = 'sending',
       updated_at = NOW()
   WHERE id = $1
     AND email_status = 'pending'
   RETURNING email_status, batch_id`,
  [job.data.documentId]
);

const document = documentResult.rows[0];
  if (!document) {
  console.log(
    `Skipping email job for document ${job.data.documentId} (already processing or sent).`
  );
  return;
}

  try {
    await sendEmail({
      to: job.data.recipientEmail,
      subject: job.data.subject,
      html: job.data.html,
      attachmentPath: job.data.pdfPath,
      attachmentName: job.data.attachmentName,
      attachments: job.data.attachments,
      companyId: job.data.companyId,
      recipientName: job.data.recipientName,
      batchId: job.data.batchId,
      documentId: job.data.documentId,
      senderEmail: job.data.senderEmail,
      senderName: job.data.senderName
    });

    await pool.query(
      `UPDATE documents
       SET status = 'sent', email_status = 'sent', updated_at = NOW()
       WHERE id = $1`,
      [job.data.documentId]
    );

    await pool.query(
      `INSERT INTO email_logs (id, company_id, document_id, status, provider_message_id)
       VALUES (gen_random_uuid(), (SELECT company_id FROM documents WHERE id = $1), $1, 'sent', $2)`,
      [job.data.documentId, `${job.id}`]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email send failed';
    const lowerMessage = message.toLowerCase();

const shouldRetry =
  lowerMessage.includes('timeout') ||
  lowerMessage.includes('connection') ||
  lowerMessage.includes('network') ||
  lowerMessage.includes('temporary');
    const shouldMarkFailed =
  !shouldRetry ||
  (job.attemptsMade ?? 0) + 1 >= (job.opts.attempts ?? 1);

    if (!shouldMarkFailed) {
  await pool.query(
    `UPDATE documents
     SET retry_count = retry_count + 1,
         email_status = 'pending',
         updated_at = NOW()
     WHERE id = $1`,
    [job.data.documentId]
  );
}

    if (shouldMarkFailed) {
      await pool.query(
        `UPDATE documents
         SET status = 'failed', email_status = 'failed', error_message = $2, updated_at = NOW()
         WHERE id = $1`,
        [job.data.documentId, message]
      );
      await pool.query(
        `INSERT INTO email_logs (id, company_id, document_id, status, error_message)
         VALUES (gen_random_uuid(), (SELECT company_id FROM documents WHERE id = $1), $1, 'failed', $2)`,
        [job.data.documentId, message]
      );
    }

    if (shouldRetry) {
  throw error;
}

return;
  } finally {
    await refreshBatchCounts(job.data.batchId);
  }
}
