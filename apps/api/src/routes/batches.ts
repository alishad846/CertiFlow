import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth, requireRole } from '../middleware/auth';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { createBatch } from '../services/batches';
import { getCompanyAccess } from '../services/companies';
import { isCompanyEmailConfigured } from '../services/email';
import { getCertificateTemplateById } from '../services/certificate-templates';
import { pool } from '../db/pool';
import { ensureDir, safeSegment } from '../services/fs';

const router = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const tempDir = path.join(env.UPLOAD_DIR, 'incoming');
      fs.mkdirSync(tempDir, { recursive: true });
      cb(null, tempDir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${safeSegment(file.originalname)}`);
    }
  }),
  fileFilter: (_req, file, cb) => {
    const allowedExcel = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
      'text/plain' // some browsers send CSV as text/plain
    ];
    const allowedDocx = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const allowedTemplates = [
      ...allowedDocx,
      'application/pdf'
    ];
    const allowedAttachments = [
      'application/pdf',
      'image/png',
      'image/jpeg'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const isExcel = allowedExcel.includes(file.mimetype) || ['.xls', '.xlsx', '.csv'].includes(ext);
    const isTemplate = allowedTemplates.includes(file.mimetype) || ['.docx', '.pdf'].includes(ext);
    const isAttachment = allowedAttachments.includes(file.mimetype) || ['.pdf', '.png', '.jpg', '.jpeg'].includes(ext);

    if (file.fieldname === 'excelFile' && !isExcel) {
      cb(new AppError('Only Excel (.xls, .xlsx) or CSV (.csv) files are allowed in the data field', 400));
      return;
    }
    if ((file.fieldname === 'templateFile' || file.fieldname === 'templateFiles') && !isTemplate) {
      cb(new AppError('Only DOCX or PDF files are allowed in the template field', 400));
      return;
    }
    if (file.fieldname === 'attachments' && !isAttachment) {
      cb(new AppError('Only PDF, PNG, JPG, and JPEG files are allowed in the attachment field', 400));
      return;
    }
    if (!isExcel && !isTemplate && !isAttachment) {
      cb(new AppError('Only Excel, DOCX, PDF, PNG, JPG, and JPEG files are allowed', 400));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = req.user?.role === 'super_admin' ? undefined : req.user?.companyId;
    if (req.user?.role === 'company_admin') {
      const company = req.user.companyId ? await getCompanyAccess(req.user.companyId) : null;
      if (!company || company.status !== 'active') {
        throw new AppError('Company access is blocked', 403);
      }
      if (!company.can_view_reports) {
        throw new AppError('Reports access is disabled for this company', 403);
      }
    }
    const result = companyId
      ? await pool.query(
          `SELECT id, name, status, total_rows AS "totalRows", processed_rows AS "processedRows",
                  sent_count AS "sentCount", failed_count AS "failedCount", created_at AS "createdAt"
           FROM batches
           WHERE company_id = $1
           ORDER BY created_at DESC`,
          [companyId]
        )
      : await pool.query(
          `SELECT id, name, status, total_rows AS "totalRows", processed_rows AS "processedRows",
                  sent_count AS "sentCount", failed_count AS "failedCount", created_at AS "createdAt"
           FROM batches
           ORDER BY created_at DESC`
        );

    res.json({ batches: result.rows });
  })
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const batchResult = await pool.query(
      `SELECT id, company_id AS "companyId", name, status, template_type AS "templateType",
              total_rows AS "totalRows", processed_rows AS "processedRows",
              sent_count AS "sentCount", failed_count AS "failedCount",
              created_at AS "createdAt"
       FROM batches WHERE id = $1`,
      [req.params.id]
    );
    const batch = batchResult.rows[0];
    if (!batch) {
      throw new AppError('Batch not found', 404);
    }
    if (req.user?.role !== 'super_admin' && batch.companyId !== req.user?.companyId) {
      throw new AppError('Forbidden', 403);
    }
    if (req.user?.role === 'company_admin') {
      const company = req.user.companyId ? await getCompanyAccess(req.user.companyId) : null;
      if (!company || company.status !== 'active') {
        throw new AppError('Company access is blocked', 403);
      }
      if (!company.can_view_reports) {
        throw new AppError('Reports access is disabled for this company', 403);
      }
    }

    const documents = await pool.query(
      `SELECT id, recipient_name AS "recipientName", recipient_email AS "recipientEmail",
              status, email_status AS "emailStatus", generated_pdf_path AS "generatedPdfPath",
              error_message AS "errorMessage", created_at AS "createdAt"
       FROM documents
       WHERE batch_id = $1
       ORDER BY row_index ASC`,
      [batch.id]
    );

    res.json({ batch, documents: documents.rows });
  })
);

router.post(
  '/',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  upload.fields([
    { name: 'excelFile', maxCount: 1 },
    { name: 'templateFile', maxCount: 1 },
    { name: 'templateFiles', maxCount: 10 },
    { name: 'attachments', maxCount: 10 }
  ]),
  asyncHandler(async (req, res) => {
    const excelFile = (req.files as Record<string, Express.Multer.File[]>)?.excelFile?.[0];
    const templateFile = (req.files as Record<string, Express.Multer.File[]>)?.templateFile?.[0];
    const templateFiles = (req.files as Record<string, Express.Multer.File[]>)?.templateFiles ?? [];
    const attachments = (req.files as Record<string, Express.Multer.File[]>)?.attachments ?? [];
    const batchName = String(req.body.batchName ?? '').trim();
    const templateType = req.body.templateType === 'offer_letter' ? 'offer_letter' : 'certificate';
    const companyId = req.user?.role === 'super_admin' ? String(req.body.companyId ?? '').trim() : req.user?.companyId;
    const certificateTemplateId = String(req.body.certificateTemplateId ?? '').trim();
    const emailMessage = String(req.body.emailMessage ?? '').trim();
    const attachmentMessage = String(req.body.attachmentMessage ?? '').trim();

    if (!companyId) {
      throw new AppError('Company is required for batch creation', 400);
    }
    if (req.user?.role === 'company_admin' && req.user.permissions?.canCreateBatches === false) {
      throw new AppError('You do not have permission to create batches', 403);
    }
    if (!batchName) {
      throw new AppError('Batch name is required', 400);
    }
    if (!excelFile) {
      throw new AppError('Excel file is required', 400);
    }
    if (templateType === 'offer_letter' && !templateFiles.length && !templateFile) {
      throw new AppError('At least one DOCX or PDF file is required', 400);
    }
    const company = await getCompanyAccess(companyId);
    if (!company || company.status !== 'active') {
      throw new AppError('Company is blocked', 403);
    }
    if (!company.can_create_batches) {
      throw new AppError('Batch creation is disabled for this company', 403);
    }
    // Onboarding gate: a company admin must configure and enable an email sender before issuing.
    if (req.user?.role === 'company_admin' && !(await isCompanyEmailConfigured(companyId))) {
      throw new AppError('Configure and enable your email sender in Settings first', 400);
    }

    if (templateType === 'certificate' && certificateTemplateId) {
      const certificateTemplate = await getCertificateTemplateById(certificateTemplateId, companyId);
      if (!certificateTemplate) {
        throw new AppError('Certificate template not found', 404);
      }
    }

    const result = await createBatch({
      companyId,
      createdBy: req.user!.id,
      senderEmail: req.user!.email,
      senderName: company.name,
      emailMessage: emailMessage || undefined,
      attachmentMessage: attachmentMessage || undefined,
      batchName,
      templateType,
      certificateTemplateId: templateType === 'certificate' ? certificateTemplateId : undefined,
      excelFilePath: excelFile.path,
      excelOriginalName: excelFile.originalname,
      templateFiles: templateFiles.length
        ? templateFiles.map((file) => ({ path: file.path, originalName: file.originalname }))
        : templateFile
          ? [{ path: templateFile.path, originalName: templateFile.originalname }]
          : [],
      attachments: attachments.length
        ? attachments.map((file) => ({ path: file.path, originalName: file.originalname, mimeType: file.mimetype }))
        : []
    });

    res.status(201).json({
      message: 'Batch queued successfully',
      ...result
    });
  })
);

export default router;
