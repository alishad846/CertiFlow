import path from 'path';
import { Job } from 'bullmq';
import { pool } from '../db/pool';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { buildTemplateContext } from '../services/excel';
import { renderDocxTemplate } from '../services/docx';
import { convertDocxToPdf } from '../services/pdf';
import { sendEmail } from '../services/email';
import { renderPersonalizedAttachment } from '../services/attachment-template';
import { getCertificateTemplateById, resolveCertificateIssueDate } from '../services/certificate-templates';
import { renderCertificatePdf } from '../services/certificate-render';
import { ensureDir, safeSegment } from '../services/fs';
import { emailQueue } from '../services/queue';

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

function buildEmailHtml(message: string, recipientName: string) {
  const resolved = message.replace(/{{\s*name\s*}}/gi, recipientName).trim();
  const safeText = escapeHtml(resolved || `Hello ${recipientName},`);
  return `<p>${safeText.replace(/\r?\n/g, '<br>')}</p><p>Please find your attached document.</p>`;
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
       COUNT(*) FILTER (WHERE generated_docx_path IS NOT NULL)::int AS processed
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
    batch.template_type === 'certificate' && batch.certificate_template_id
      ? await getCertificateTemplateById(batch.certificate_template_id, batch.company_id)
      : null;

  if (batch.template_type === 'certificate' && !certificateTemplate) {
    throw new AppError('Certificate template missing', 400);
  }

  await pool.query(`UPDATE batches SET status = 'processing', updated_at = NOW() WHERE id = $1`, [batch.id]);

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

      try {
        if (batch.template_type === 'certificate' && certificateTemplate) {
          const baseName = `${document.row_index}-${safeName}`;
          const rendered = await renderCertificatePdf({
            backgroundPath: certificateTemplate.backgroundStoredPath,
            fields: certificateTemplate.fieldConfig,
            context: certificateContext,
            outputDir: path.join(outputRoot, 'certificate'),
            baseName
          });
          primaryDocxPath = rendered.pngPath;
          primaryPdfPath = rendered.pdfPath;
          generatedAttachments.push({
            path: rendered.pdfPath,
            filename: `${baseName}.pdf`
          });
        } else {
          for (let templateIndex = 0; templateIndex < templateFiles.length; templateIndex += 1) {
            const template = templateFiles[templateIndex];
            const templateBase = safeSegment(
              path.basename(template.originalName, path.extname(template.originalName)) || `template-${templateIndex + 1}`
            );
            const suffix = `${templateIndex + 1}-${templateBase}`;
            const docxPath = path.join(outputRoot, `${document.row_index}-${safeName}-${suffix}.docx`);
            const pdfName = `${document.row_index}-${safeName}-${suffix}.pdf`;

            await renderDocxTemplate({
              templatePath: template.path,
              outputPath: docxPath,
              data: context
            });

            const pdfPath = await convertDocxToPdf(docxPath, pdfDir);
            if (!primaryDocxPath) {
              primaryDocxPath = docxPath;
              primaryPdfPath = pdfPath;
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

        if (!primaryDocxPath || !primaryPdfPath) {
          throw new AppError('Failed to generate document attachments', 500);
        }

        await pool.query(
          `UPDATE documents
           SET generated_docx_path = $2, generated_pdf_path = $3, status = 'processing', updated_at = NOW()
           WHERE id = $1`,
          [document.id, primaryDocxPath, primaryPdfPath]
        );

        await emailQueue.add(
          'send-email',
          {
            companyId: batch.company_id,
            batchId: batch.id,
            documentId: document.id,
            recipientName: document.recipient_name,
            recipientEmail: document.recipient_email,
            subject: `${batch.name} - ${batch.template_type === 'certificate' ? 'Certificate' : 'Offer Letter'}`,
            html: buildEmailHtml(batch.email_message ?? '', document.recipient_name),
            pdfPath: generatedAttachments[0]?.path,
            attachmentName: generatedAttachments[0]?.filename,
            attachments: [...generatedAttachments, ...extraAttachments],
            senderEmail: batch.sender_email ?? undefined,
            senderName: batch.sender_name ?? undefined
          },
          {
            attempts: 3,
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
    `SELECT d.email_status, d.batch_id
     FROM documents d
     WHERE d.id = $1`,
    [job.data.documentId]
  );
  const document = documentResult.rows[0];
  if (!document) {
    throw new AppError('Document not found', 404);
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
    const shouldMarkFailed = (job.attemptsMade ?? 0) + 1 >= (job.opts.attempts ?? 1);

    await pool.query(
      `UPDATE documents
       SET retry_count = retry_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [job.data.documentId]
    );

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

    throw error;
  } finally {
    await refreshBatchCounts(job.data.batchId);
  }
}
