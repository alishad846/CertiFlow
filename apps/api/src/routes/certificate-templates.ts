import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth, requireRole } from '../middleware/auth';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { getCompanyAccess } from '../services/companies';
import { STOCK_TEMPLATES } from '../services/stock-templates';
import {
  type CertificateFieldConfig,
  createBlankEditorTemplate,
  createFromStockTemplate,
  createCertificateTemplate,
  deleteCertificateTemplate,
  duplicateCertificateTemplate,
  getCertificateTemplateById,
  getActiveCertificateTemplate,
  listCertificateTemplates,
  resolveCertificateIssueDate,
  updateCertificateTemplate,
  updateCertificateTemplateDesign
} from '../services/certificate-templates';
import { readExcelRecipients, buildTemplateContext } from '../services/excel';
import {
  listCertificateBackgroundPreviewPages,
  renderCertificateBackgroundPreviewPage,
  renderCertificatePdfPreview
} from '../services/certificate-render';
import { safeSegment } from '../services/fs';

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
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowed = allowed.includes(file.mimetype) || ['.pdf', '.png', '.jpg', '.jpeg'].includes(ext);
    if (!isAllowed) {
      cb(new AppError('Only PDF, PNG and JPG files are allowed', 400));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

const previewUpload = multer({
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
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const isExcel = allowed.includes(file.mimetype) || ['.xls', '.xlsx'].includes(ext);
    if (!isExcel) {
      cb(new AppError('Only Excel files are allowed', 400));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

const fieldConfigSchema = z.array(
  z.object({
    field: z.string().min(1),
    pageNumber: z.number().int().positive().optional(),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    fontSize: z.number().positive(),
    fontFamily: z.string().min(1),
    color: z.string().min(1),
    align: z.enum(['left', 'center', 'right']),
    text: z.string().optional()
  })
);

function parseFieldConfig(value: unknown): CertificateFieldConfig[] {
  return fieldConfigSchema.parse(value).map((entry) => ({
    field: entry.field,
    ...(entry.pageNumber !== undefined ? { pageNumber: entry.pageNumber } : {}),
    x: entry.x,
    y: entry.y,
    width: entry.width,
    fontSize: entry.fontSize,
    fontFamily: entry.fontFamily,
    color: entry.color,
    align: entry.align,
    ...(entry.text !== undefined ? { text: entry.text } : {})
  }));
}

async function resolveCompanyId(req: { user?: { role: string; companyId: string | null } }, requestedCompanyId?: string) {
  if (req.user?.role === 'super_admin') {
    const companyId = requestedCompanyId?.trim();
    if (!companyId) {
      throw new AppError('Company is required', 400);
    }
    return companyId;
  }
  if (!req.user?.companyId) {
    throw new AppError('Company is required', 400);
  }
  return req.user.companyId;
}

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const requestedCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId.trim() : '';
    const companyId = await resolveCompanyId(req, requestedCompanyId);
    if (req.user?.role === 'company_admin') {
      const company = req.user.companyId ? await getCompanyAccess(req.user.companyId) : null;
      if (!company || company.status !== 'active') {
        throw new AppError('Company access is blocked', 403);
      }
    }

    const templates = await listCertificateTemplates(companyId);
    res.json({ templates });
  })
);

router.get(
  '/my',
  requireAuth,
  asyncHandler(async (req, res) => {
    const requestedCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId.trim() : '';
    const companyId = await resolveCompanyId(req, requestedCompanyId);
    const templates = await listCertificateTemplates(companyId);
    res.json({ templates });
  })
);

// Ready-made template gallery: list shipped stock designs. Must precede GET /:id so "stock"
// isn't parsed as a template id.
router.get(
  '/stock',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const base = `${req.protocol}://${req.get('host')}`;
    res.json({
      templates: STOCK_TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        thumbnailUrl: `${base}/api/editor/stock/${t.file}`
      }))
    });
  })
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const template = await getCertificateTemplateById(String(req.params.id));
    if (!template) {
      throw new AppError('Certificate template not found', 404);
    }
    if (req.user?.role !== 'super_admin' && template.companyId !== req.user?.companyId) {
      throw new AppError('Forbidden', 403);
    }
    res.json({ template });
  })
);

router.get(
  '/:id/preview-image',
  asyncHandler(async (req, res) => {
    const template = await getCertificateTemplateById(String(req.params.id));
    if (!template) {
      throw new AppError('Certificate template not found', 404);
    }

    const pageNumber = Math.max(1, Number(req.query.page ?? '1') || 1);
    const preview = await renderCertificateBackgroundPreviewPage(template.backgroundStoredPath, pageNumber);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Preview-Width', String(preview.width));
    res.setHeader('X-Preview-Height', String(preview.height));
    res.send(preview.buffer);
  })
);

router.get(
  '/:id/preview-pages',
  asyncHandler(async (req, res) => {
    const template = await getCertificateTemplateById(String(req.params.id));
    if (!template) {
      throw new AppError('Certificate template not found', 404);
    }

    const pages = await listCertificateBackgroundPreviewPages(template.backgroundStoredPath);
    res.json({
      pages: pages.map((page) => ({
        ...page,
        src: `/certificate-templates/${template.id}/preview-image?page=${page.pageNumber}`
      }))
    });
  })
);

router.post(
  '/:id/duplicate',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const template = await getCertificateTemplateById(String(req.params.id));
    if (!template) {
      throw new AppError('Certificate template not found', 404);
    }
    if (req.user?.role !== 'super_admin' && template.companyId !== req.user?.companyId) {
      throw new AppError('Forbidden', 403);
    }

    const duplicated = await duplicateCertificateTemplate({
      templateId: String(req.params.id),
      companyId: template.companyId,
      createdBy: req.user!.id
    });

    res.status(201).json({ template: duplicated });
  })
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const template = await getCertificateTemplateById(String(req.params.id));
    if (!template) {
      throw new AppError('Certificate template not found', 404);
    }
    if (req.user?.role !== 'super_admin' && template.companyId !== req.user?.companyId) {
      throw new AppError('Forbidden', 403);
    }

    await deleteCertificateTemplate({
      templateId: String(req.params.id),
      companyId: template.companyId
    });

    res.status(204).send();
  })
);

router.post(
  '/',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  upload.single('backgroundImage'),
  asyncHandler(async (req, res) => {
    const backgroundImage = req.file;
    const name = String(req.body.name ?? '').trim();
    const companyId = await resolveCompanyId(req, String(req.body.companyId ?? '').trim());
    const rawFieldConfig = String(req.body.fieldConfig ?? '[]');
    const fieldConfig = parseFieldConfig(JSON.parse(rawFieldConfig));

    if (!backgroundImage) {
      throw new AppError('Background image is required', 400);
    }
    if (!name) {
      throw new AppError('Template name is required', 400);
    }

    const company = await getCompanyAccess(companyId);
    if (!company || company.status !== 'active') {
      throw new AppError('Company is blocked', 403);
    }
    if (!company.can_create_batches) {
      throw new AppError('Batch creation is disabled for this company', 403);
    }

    const template = await createCertificateTemplate({
      companyId,
      createdBy: req.user!.id,
      name,
      backgroundFilePath: backgroundImage.path,
      backgroundOriginalName: backgroundImage.originalname,
      fieldConfig,
      isActive: true
    });

    res.status(201).json({ template });
  })
);

router.post(
  '/blank',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const companyId = await resolveCompanyId(req, String(req.body?.companyId ?? '').trim());

    const company = await getCompanyAccess(companyId);
    if (!company || company.status !== 'active') {
      throw new AppError('Company is blocked', 403);
    }
    if (!company.can_create_batches) {
      throw new AppError('Batch creation is disabled for this company', 403);
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    const template = await createBlankEditorTemplate({
      companyId,
      createdBy: req.user!.id,
      name: name || undefined
    });

    res.status(201).json({ template });
  })
);

// Clone a stock design into the company and open it in the editor.
router.post(
  '/from-stock',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const companyId = await resolveCompanyId(req, String(req.body?.companyId ?? '').trim());

    const company = await getCompanyAccess(companyId);
    if (!company || company.status !== 'active') {
      throw new AppError('Company is blocked', 403);
    }
    if (!company.can_create_batches) {
      throw new AppError('Batch creation is disabled for this company', 403);
    }

    const stockId = String(req.body?.stockId ?? '').trim();
    const template = await createFromStockTemplate({
      companyId,
      createdBy: req.user!.id,
      stockId,
      assetBase: `${req.protocol}://${req.get('host')}`
    });

    res.status(201).json({ template });
  })
);

router.post(
  '/preview',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  previewUpload.single('excelFile'),
  asyncHandler(async (req, res) => {
    const excelFile = req.file;
    const companyId = await resolveCompanyId(req, String(req.body.companyId ?? '').trim());
    const requestedTemplateId = String(req.body.certificateTemplateId ?? '').trim();
    if (!excelFile) {
      throw new AppError('Excel file is required', 400);
    }

    try {
      const template = requestedTemplateId
        ? await getCertificateTemplateById(requestedTemplateId, companyId)
        : await getActiveCertificateTemplate(companyId);
      if (!template) {
        throw new AppError('Please create a certificate template first', 400);
      }

      const recipients = await readExcelRecipients(excelFile.path);
      if (!recipients.length) {
        throw new AppError('The uploaded Excel file does not contain valid recipient rows', 400);
      }

      const previewBuffer = await renderCertificatePdfPreview({
        backgroundPath: template.backgroundStoredPath,
        fields: template.fieldConfig,
        context: {
          ...buildTemplateContext(recipients[0]),
          issue_date: resolveCertificateIssueDate(template)
        }
      });

      const contentType = path.extname(template.backgroundStoredPath).toLowerCase() === '.pdf' ? 'application/pdf' : 'image/png';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store');
      res.send(previewBuffer);
    } finally {
      await fs.promises.unlink(excelFile.path).catch(() => undefined);
    }
  })
);

router.put(
  '/:id',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const template = await getCertificateTemplateById(String(req.params.id));
    if (!template) {
      throw new AppError('Certificate template not found', 404);
    }
    if (req.user?.role !== 'super_admin' && template.companyId !== req.user?.companyId) {
      throw new AppError('Forbidden', 403);
    }

    const body = z.object({
      name: z.string().min(1).optional(),
      isActive: z.boolean().optional(),
      fieldConfig: fieldConfigSchema.optional(),
      issueDateMode: z.enum(['current_date', 'manual']).optional(),
      issueDateValue: z.string().nullable().optional()
    });

    const parsed = body.parse(req.body);
    const updated = await updateCertificateTemplate({
      templateId: String(req.params.id),
      companyId: template.companyId,
      updatedBy: req.user!.id,
      name: parsed.name,
      isActive: parsed.isActive,
      fieldConfig: parsed.fieldConfig ? parseFieldConfig(parsed.fieldConfig) : undefined,
      issueDateMode: parsed.issueDateMode,
      issueDateValue: parsed.issueDateValue ?? undefined
    });

    res.json({ template: updated });
  })
);

router.put(
  '/:id/design',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const template = await getCertificateTemplateById(String(req.params.id));
    if (!template) throw new AppError('Certificate template not found', 404);
    if (req.user?.role !== 'super_admin' && template.companyId !== req.user?.companyId) {
      throw new AppError('Forbidden', 403);
    }
    // Multi-tenant guardrail: a blocked company cannot author certificate designs, mirroring the
    // company-active gate on the create/blank/from-stock routes. (Super admins are not company-scoped.)
    if (req.user?.role !== 'super_admin') {
      const company = await getCompanyAccess(template.companyId);
      if (!company || company.status !== 'active') {
        throw new AppError('Company is blocked', 403);
      }
    }
    if (!req.body || typeof req.body !== 'object' || !('editorDocument' in req.body)) {
      throw new AppError('editorDocument is required', 400);
    }
    const body = z.object({
      name: z.string().min(1).optional(),
      editorDocument: z.unknown()
    }).parse(req.body);
    const updated = await updateCertificateTemplateDesign({
      templateId: String(req.params.id),
      companyId: template.companyId,
      updatedBy: req.user!.id,
      name: body.name,
      editorDocument: body.editorDocument
    });
    res.json({ template: updated });
  })
);

export default router;
