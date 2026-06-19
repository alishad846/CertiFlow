import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { pool, withTransaction } from '../db/pool';
import { AppError } from '../lib/errors';
import { env } from '../config/env';
import { ensureDir, safeSegment } from './fs';
import { buildTemplateContext, readExcelRecipients } from './excel';
import { debitCredits } from './credits';
import { batchQueue } from './queue';
import { getActiveCertificateTemplate, getCertificateTemplateById } from './certificate-templates';

function makeFileName(original: string, suffix: string) {
  const ext = path.extname(original) || suffix;
  const base = safeSegment(path.basename(original, ext).slice(0, 60)) || 'file';
  return `${Date.now()}-${randomUUID().slice(0, 8)}-${base}${ext}`;
}

function getTemplateUploadKind(originalName: string) {
  return path.extname(originalName).toLowerCase() === '.pdf' ? 'pdf' : 'docx';
}

export async function createBatch(params: {
  companyId: string;
  createdBy: string;
  senderEmail?: string;
  senderName?: string;
  emailMessage?: string;
  attachmentMessage?: string;
  batchName: string;
  templateType: 'certificate' | 'offer_letter';
  certificateTemplateId?: string;
  excelFilePath: string;
  excelOriginalName: string;
  templateFiles?: Array<{
    path: string;
    originalName: string;
  }>;
  attachments?: Array<{
    path: string;
    originalName: string;
    mimeType?: string;
  }>;
}) {
  const companyExists = await pool.query('SELECT id FROM companies WHERE id = $1', [params.companyId]);
  if (!companyExists.rows[0]) {
    throw new AppError('Company not found', 404);
  }

  const recipients = await readExcelRecipients(params.excelFilePath);
  if (!recipients.length) {
    throw new AppError('The uploaded Excel file does not contain valid recipient rows', 400);
  }

  const batchId = randomUUID();
  const uploadRoot = path.join(env.UPLOAD_DIR, `company-${params.companyId}`, batchId);
  await ensureDir(uploadRoot);

  const movedExcelPath = path.join(uploadRoot, makeFileName(params.excelOriginalName, '.xlsx'));
  const isCertificate = params.templateType === 'certificate';
  const templateFiles = params.templateFiles ?? [];
  if (!isCertificate && !templateFiles.length) {
    throw new AppError('At least one DOCX file is required', 400);
  }
  await fs.copyFile(params.excelFilePath, movedExcelPath);

  const result = await withTransaction(async (client: PoolClient) => {
    const uploadExcel = await client.query<{ id: string }>(
      `INSERT INTO uploads (company_id, original_name, stored_path, kind, created_by)
       VALUES ($1, $2, $3, 'excel', $4)
       RETURNING id`,
      [params.companyId, params.excelOriginalName, movedExcelPath, params.createdBy]
    );

    let certificateTemplate = null as Awaited<ReturnType<typeof getActiveCertificateTemplate>> | null;
    if (isCertificate) {
      if (params.certificateTemplateId) {
        certificateTemplate = await getCertificateTemplateById(params.certificateTemplateId, params.companyId);
        if (!certificateTemplate) {
          throw new AppError('Certificate template not found', 404);
        }
      } else {
        certificateTemplate = await getActiveCertificateTemplate(params.companyId);
        if (!certificateTemplate) {
          throw new AppError('Please create a certificate template first', 400);
        }
      }
    }

    const templateUploads: Array<{ id: string }> = [];
    const attachmentRows: Array<{
      originalName: string;
      storedPath: string;
      mimeType: string | null;
      order: number;
    }> = [];

    for (let index = 0; index < templateFiles.length; index += 1) {
      const template = templateFiles[index];
      const templateExt = path.extname(template.originalName).toLowerCase() === '.pdf' ? '.pdf' : '.docx';
      const movedTemplatePath = path.join(uploadRoot, makeFileName(template.originalName, templateExt));
      await fs.copyFile(template.path, movedTemplatePath);
      const templateKind = getTemplateUploadKind(template.originalName);

      const uploadTemplate = await client.query<{ id: string }>(
        `INSERT INTO uploads (company_id, original_name, stored_path, kind, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [params.companyId, template.originalName, movedTemplatePath, templateKind, params.createdBy]
      );
      templateUploads.push(uploadTemplate.rows[0]);
    }

    for (let index = 0; index < (params.attachments ?? []).length; index += 1) {
      const attachment = params.attachments?.[index];
      if (!attachment) {
        continue;
      }
      const movedAttachmentPath = path.join(uploadRoot, makeFileName(attachment.originalName, path.extname(attachment.originalName) || '.bin'));
      await fs.copyFile(attachment.path, movedAttachmentPath);
      attachmentRows.push({
        originalName: attachment.originalName,
        storedPath: movedAttachmentPath,
        mimeType: attachment.mimeType ?? null,
        order: index
      });
    }

    const batch = await client.query<{ id: string }>(
      `INSERT INTO batches (
        id, company_id, name, template_type, excel_upload_id, template_upload_id, certificate_template_id,
        status, total_rows, processed_rows, sent_count, failed_count, created_by, sender_email, sender_name, email_message, attachment_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'queued', $8, 0, 0, 0, $9, $10, $11, $12, $13)
      RETURNING id`,
      [
        batchId,
        params.companyId,
        params.batchName,
        params.templateType,
        uploadExcel.rows[0].id,
        isCertificate ? (certificateTemplate?.backgroundUploadId ?? uploadExcel.rows[0].id) : templateUploads[0].id,
        isCertificate ? (certificateTemplate?.id ?? null) : null,
        recipients.length,
        params.createdBy,
        params.senderEmail ?? null,
        params.senderName ?? null,
        params.emailMessage ?? null,
        params.attachmentMessage ?? null
      ]
    );

    if (!isCertificate) {
      for (let index = 0; index < templateUploads.length; index += 1) {
        await client.query(
          `INSERT INTO batch_templates (id, batch_id, upload_id, template_order)
           VALUES ($1, $2, $3, $4)`,
          [randomUUID(), batch.rows[0].id, templateUploads[index].id, index]
        );
      }
    }

    for (const attachment of attachmentRows) {
      await client.query(
        `INSERT INTO batch_attachments (id, batch_id, original_name, stored_path, mime_type, attachment_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), batch.rows[0].id, attachment.originalName, attachment.storedPath, attachment.mimeType, attachment.order]
      );
    }

    for (const recipient of recipients) {
      const context = buildTemplateContext(recipient);
      await client.query(
        `INSERT INTO documents (
          id, batch_id, company_id, row_index, recipient_name, recipient_email,
          course, role, joining_date, completion_date, roll_number, source_data, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')`,
        [
          randomUUID(),
          batch.rows[0].id,
          params.companyId,
          recipient.rowIndex,
          recipient.name,
          recipient.email,
          recipient.course,
          recipient.role,
          recipient.joiningDate,
          recipient.completionDate,
          recipient.rollNumber,
          context
        ]
      );
    }

    await debitCredits(client, params.companyId, recipients.length, batch.rows[0].id);
    return batch.rows[0].id;
  });

  try {
    await batchQueue.add(
      'process-batch',
      {
        batchId: result
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000
        }
      }
    );
  } catch (error) {
    await pool.query('UPDATE companies SET credits_remaining = credits_remaining + $1 WHERE id = $2', [
      recipients.length,
      params.companyId
    ]);
    await pool.query(
      'INSERT INTO credit_ledger (company_id, change_amount, reason, reference_id) VALUES ($1, $2, $3, $4)',
      [params.companyId, recipients.length, 'queue_enqueue_refund', result]
    );
    await pool.query(
      `UPDATE documents
       SET status = 'failed', email_status = 'failed', error_message = 'Batch queue failed', updated_at = NOW()
       WHERE batch_id = $1`,
      [result]
    );
    await pool.query(`UPDATE batches SET status = 'failed', updated_at = NOW() WHERE id = $1`, [result]);
    throw error;
  }

  return {
    batchId: result,
    totalRows: recipients.length
  };
}
