import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { pool, withTransaction } from '../db/pool';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { ensureDir, safeSegment } from './fs';

export type CertificateFieldConfig = {
  field: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  align: 'left' | 'center' | 'right';
  text?: string;
};

export type CertificateIssueDateMode = 'current_date' | 'manual';

type CertificateTemplateRow = {
  id: string;
  company_id: string;
  name: string;
  background_upload_id: string;
  field_config: CertificateFieldConfig[] | string;
  issue_date_mode: CertificateIssueDateMode | string;
  issue_date_value: string | null;
  image_width: number;
  image_height: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  background_original_name: string;
  background_stored_path: string;
};

function toFileUrl(storedPath: string) {
  const baseDir = path.resolve(env.UPLOAD_DIR);
  const relative = path.relative(baseDir, path.resolve(storedPath)).split(path.sep).join('/');
  if (relative.startsWith('..')) {
    return '';
  }
  return `/files/${relative}`;
}

function normalizeFieldConfig(value: CertificateFieldConfig[] | string) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as CertificateFieldConfig[];
    } catch {
      return [];
    }
  }
  return value ?? [];
}

function normalizeIssueDateMode(value: CertificateIssueDateMode | string | null | undefined): CertificateIssueDateMode {
  return value === 'manual' ? 'manual' : 'current_date';
}

function normalizeIssueDateValue(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mapTemplateRow(row: CertificateTemplateRow) {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    backgroundUploadId: row.background_upload_id,
    fieldConfig: normalizeFieldConfig(row.field_config),
    issueDateMode: normalizeIssueDateMode(row.issue_date_mode),
    issueDateValue: normalizeIssueDateValue(row.issue_date_value),
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    backgroundUrl: toFileUrl(row.background_stored_path),
    backgroundOriginalName: row.background_original_name,
    backgroundStoredPath: row.background_stored_path
  };
}

export async function listCertificateTemplates(companyId: string) {
  const result = await pool.query<CertificateTemplateRow>(
    `SELECT ct.id, ct.company_id, ct.name, ct.background_upload_id, ct.field_config,
            ct.issue_date_mode, ct.issue_date_value,
            ct.image_width, ct.image_height, ct.is_active, ct.created_at, ct.updated_at,
            u.original_name AS background_original_name, u.stored_path AS background_stored_path
     FROM certificate_templates ct
     INNER JOIN uploads u ON u.id = ct.background_upload_id
     WHERE ct.company_id = $1
     ORDER BY ct.is_active DESC, ct.updated_at DESC, ct.created_at DESC`,
    [companyId]
  );

  return result.rows.map(mapTemplateRow);
}

export async function getCertificateTemplateById(templateId: string, companyId?: string) {
  const result = await pool.query<CertificateTemplateRow>(
    `SELECT ct.id, ct.company_id, ct.name, ct.background_upload_id, ct.field_config,
            ct.issue_date_mode, ct.issue_date_value,
            ct.image_width, ct.image_height, ct.is_active, ct.created_at, ct.updated_at,
            u.original_name AS background_original_name, u.stored_path AS background_stored_path
     FROM certificate_templates ct
     INNER JOIN uploads u ON u.id = ct.background_upload_id
     WHERE ct.id = $1 ${companyId ? 'AND ct.company_id = $2' : ''}
     LIMIT 1`,
    companyId ? [templateId, companyId] : [templateId]
  );

  return result.rows[0] ? mapTemplateRow(result.rows[0]) : null;
}

export async function getActiveCertificateTemplate(companyId: string) {
  const result = await pool.query<CertificateTemplateRow>(
    `SELECT ct.id, ct.company_id, ct.name, ct.background_upload_id, ct.field_config,
            ct.issue_date_mode, ct.issue_date_value,
            ct.image_width, ct.image_height, ct.is_active, ct.created_at, ct.updated_at,
            u.original_name AS background_original_name, u.stored_path AS background_stored_path
     FROM certificate_templates ct
     INNER JOIN uploads u ON u.id = ct.background_upload_id
     WHERE ct.company_id = $1
     ORDER BY ct.is_active DESC, ct.updated_at DESC, ct.created_at DESC
     LIMIT 1`,
    [companyId]
  );

  return result.rows[0] ? mapTemplateRow(result.rows[0]) : null;
}

export async function createCertificateTemplate(params: {
  companyId: string;
  createdBy: string;
  name: string;
  fieldConfig: CertificateFieldConfig[];
  issueDateMode?: CertificateIssueDateMode;
  issueDateValue?: string | null;
  backgroundFilePath: string;
  backgroundOriginalName: string;
  isActive?: boolean;
}) {
  const companyExists = await pool.query('SELECT id FROM companies WHERE id = $1', [params.companyId]);
  if (!companyExists.rows[0]) {
    throw new AppError('Company not found', 404);
  }

  const templateId = randomUUID();
  const uploadRoot = path.join(env.UPLOAD_DIR, `company-${params.companyId}`, 'certificate-templates', templateId);
  await ensureDir(uploadRoot);

  const ext = path.extname(params.backgroundOriginalName).toLowerCase() || '.png';
  const storedName = `${safeSegment(path.basename(params.backgroundOriginalName, ext)) || 'certificate'}${ext}`;
  const storedPath = path.join(uploadRoot, `${Date.now()}-${storedName}`);
  await fs.copyFile(params.backgroundFilePath, storedPath);
  const metadata = await sharp(storedPath).metadata();

  return withTransaction(async (client) => {
    const upload = await client.query<{ id: string }>(
      `INSERT INTO uploads (company_id, original_name, stored_path, kind, created_by)
       VALUES ($1, $2, $3, 'image', $4)
       RETURNING id`,
      [params.companyId, params.backgroundOriginalName, storedPath, params.createdBy]
    );

    if (params.isActive !== false) {
      await client.query(
        `UPDATE certificate_templates
         SET is_active = false, updated_at = NOW()
         WHERE company_id = $1`,
        [params.companyId]
      );
    }

    const created = await client.query<CertificateTemplateRow>(
      `INSERT INTO certificate_templates (
        id, company_id, name, background_upload_id, field_config, issue_date_mode, issue_date_value, image_width, image_height, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)
      RETURNING id, company_id, name, background_upload_id, field_config, issue_date_mode, issue_date_value, image_width, image_height, is_active, created_at, updated_at`,
      [
        templateId,
        params.companyId,
        params.name,
        upload.rows[0].id,
        JSON.stringify(params.fieldConfig ?? []),
        params.issueDateMode ?? 'current_date',
        normalizeIssueDateValue(params.issueDateValue),
        metadata.width ?? 0,
        metadata.height ?? 0,
        params.isActive ?? true,
        params.createdBy
      ]
    );

    const template = created.rows[0];
    if (!template) {
      throw new AppError('Failed to create certificate template', 500);
    }

    return mapTemplateRow({
      ...template,
      background_original_name: params.backgroundOriginalName,
      background_stored_path: storedPath
    });
  });
}

export async function updateCertificateTemplate(params: {
  templateId: string;
  companyId: string;
  updatedBy: string;
  name?: string;
  fieldConfig?: CertificateFieldConfig[];
  issueDateMode?: CertificateIssueDateMode;
  issueDateValue?: string | null;
  isActive?: boolean;
}) {
  const current = await getCertificateTemplateById(params.templateId, params.companyId);
  if (!current) {
    throw new AppError('Certificate template not found', 404);
  }

  return withTransaction(async (client) => {
    if (params.isActive === true) {
      await client.query(
        `UPDATE certificate_templates
         SET is_active = false, updated_at = NOW()
         WHERE company_id = $1`,
        [params.companyId]
      );
    }

    const result = await client.query<CertificateTemplateRow>(
      `UPDATE certificate_templates
       SET name = COALESCE($3, name),
           field_config = COALESCE($4::jsonb, field_config),
           issue_date_mode = COALESCE($5, issue_date_mode),
           issue_date_value = COALESCE($6, issue_date_value),
           is_active = COALESCE($7, is_active),
           updated_by = $8,
           updated_at = NOW()
       WHERE id = $1 AND company_id = $2
       RETURNING id, company_id, name, background_upload_id, field_config, issue_date_mode, issue_date_value, image_width, image_height, is_active, created_at, updated_at`,
      [
        params.templateId,
        params.companyId,
        params.name ?? null,
        params.fieldConfig ? JSON.stringify(params.fieldConfig) : null,
        params.issueDateMode ?? null,
        params.issueDateValue === undefined ? null : normalizeIssueDateValue(params.issueDateValue),
        params.isActive ?? null,
        params.updatedBy
      ]
    );

    const updated = result.rows[0];
    if (!updated) {
      throw new AppError('Certificate template not found', 404);
    }

    const currentRow = await client.query<{ original_name: string; stored_path: string }>(
      `SELECT u.original_name, u.stored_path
       FROM uploads u
       WHERE u.id = $1`,
      [updated.background_upload_id]
    );
    const upload = currentRow.rows[0];
    return mapTemplateRow({
      ...updated,
      background_original_name: upload?.original_name ?? 'certificate.png',
      background_stored_path: upload?.stored_path ?? ''
    });
  });
}

export async function deleteCertificateTemplate(params: { templateId: string; companyId: string }) {
  const current = await getCertificateTemplateById(params.templateId, params.companyId);
  if (!current) {
    throw new AppError('Certificate template not found', 404);
  }

  await withTransaction(async (client) => {
    await client.query('DELETE FROM certificate_templates WHERE id = $1 AND company_id = $2', [
      params.templateId,
      params.companyId
    ]);
    await client.query('DELETE FROM uploads WHERE id = $1', [current.backgroundUploadId]);
  });

  if (current.backgroundStoredPath) {
    await fs.rm(current.backgroundStoredPath, { force: true }).catch(() => undefined);
  }
}

export async function duplicateCertificateTemplate(params: {
  templateId: string;
  companyId: string;
  createdBy: string;
}) {
  const current = await getCertificateTemplateById(params.templateId, params.companyId);
  if (!current) {
    throw new AppError('Certificate template not found', 404);
  }

  return createCertificateTemplate({
    companyId: params.companyId,
    createdBy: params.createdBy,
    name: `${current.name} Copy`,
    backgroundFilePath: current.backgroundStoredPath,
    backgroundOriginalName: current.backgroundOriginalName,
    fieldConfig: current.fieldConfig,
    issueDateMode: current.issueDateMode,
    issueDateValue: current.issueDateValue,
    isActive: false
  });
}

export function resolveCertificateIssueDate(template: {
  issueDateMode?: CertificateIssueDateMode;
  issueDateValue?: string | null;
}) {
  const rawValue =
    template.issueDateMode === 'manual' && template.issueDateValue
      ? template.issueDateValue
      : new Date().toISOString().slice(0, 10);
  const date = new Date(`${rawValue}T00:00:00`);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  }
  if (template.issueDateMode === 'manual' && template.issueDateValue) {
    return template.issueDateValue;
  }
  return rawValue;
}
