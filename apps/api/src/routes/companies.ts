import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { pool, withTransaction } from '../db/pool';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { rateLimit } from '../lib/rate-limit';
import { testCompanyEmailSettings } from '../services/email';

const router = Router();

function parseOptionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  throw new AppError('Permission flags must be true or false', 400);
}

function normalizeSmtpSecure(port: number, secure: boolean) {
  if (port === 465) {
    return true;
  }
  if (port === 587) {
    return false;
  }
  return secure;
}

function resolveCompanyId(req: import('express').Request) {
  if (req.user?.role === 'company_admin') {
    if (!req.user.companyId) {
      throw new AppError('Company not found', 404);
    }
    return req.user.companyId;
  }

  if (req.user?.role === 'super_admin') {
    const companyId = String(req.query.companyId ?? '').trim();
    if (!companyId) {
      throw new AppError('companyId is required', 400);
    }
    return companyId;
  }

  throw new AppError('Forbidden', 403);
}

router.get(
  '/',
  requireAuth,
  requireRole('super_admin'),
  asyncHandler(async (_req, res) => {
    const result = await pool.query<{
      companyId: string;
      companyName: string;
      status: 'active' | 'blocked';
      creditsRemaining: number;
      canCreateBatches: boolean;
      canRequestUpi: boolean;
      canViewReports: boolean;
      blockedReason: string | null;
      blockedAt: string | null;
      userCount: number;
      batchCount: number;
      paymentCount: number;
      createdAt: string;
      updatedAt: string;
    }>(
      `SELECT c.id AS "companyId", c.name AS "companyName", c.status, c.credits_remaining AS "creditsRemaining",
              c.can_create_batches AS "canCreateBatches", c.can_request_upi AS "canRequestUpi",
              c.can_view_reports AS "canViewReports", c.blocked_reason AS "blockedReason",
              c.blocked_at AS "blockedAt",
              COUNT(DISTINCT u.id)::int AS "userCount",
              COUNT(DISTINCT b.id)::int AS "batchCount",
              COUNT(DISTINCT up.id)::int AS "paymentCount",
              c.created_at AS "createdAt", c.updated_at AS "updatedAt"
       FROM companies c
       LEFT JOIN users u ON u.company_id = c.id
       LEFT JOIN batches b ON b.company_id = c.id
       LEFT JOIN upi_payments up ON up.company_id = c.id
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    );

    res.json({ companies: result.rows });
  })
);

router.post(
  '/:id/block',
  requireAuth,
  requireRole('super_admin'),
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    message: 'Too many company block actions.',
    keyGenerator: (req) => `${req.user?.id ?? req.ip}:company-block`
  }),
  asyncHandler(async (req, res) => {
    const companyId = req.params.id;
    const reason = String(req.body.reason ?? '').trim() || null;

    const result = await withTransaction(async (client) => {
      const company = await client.query<{ id: string; name: string; status: 'active' | 'blocked' }>(
        'SELECT id, name, status FROM companies WHERE id = $1 FOR UPDATE',
        [companyId]
      );
      const record = company.rows[0];
      if (!record) {
        throw new AppError('Company not found', 404);
      }

      await client.query(
        `UPDATE users
         SET token_version = token_version + 1, updated_at = NOW()
         WHERE company_id = $1 AND role = 'company_admin'`,
        [companyId]
      );

      const updated = await client.query(
        `UPDATE companies
         SET status = 'blocked', blocked_reason = $2, blocked_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING id AS "companyId", name AS "companyName", status, credits_remaining AS "creditsRemaining",
                   can_create_batches AS "canCreateBatches", can_request_upi AS "canRequestUpi",
                   can_view_reports AS "canViewReports", blocked_reason AS "blockedReason",
                   blocked_at AS "blockedAt", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [companyId, reason]
      );

      return updated.rows[0];
    });

    res.json({ company: result });
  })
);

router.post(
  '/:id/unblock',
  requireAuth,
  requireRole('super_admin'),
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    message: 'Too many company unblock actions.',
    keyGenerator: (req) => `${req.user?.id ?? req.ip}:company-unblock`
  }),
  asyncHandler(async (req, res) => {
    const companyId = req.params.id;

    const result = await withTransaction(async (client) => {
      const company = await client.query<{ id: string; name: string }>('SELECT id, name FROM companies WHERE id = $1', [
        companyId
      ]);
      if (!company.rows[0]) {
        throw new AppError('Company not found', 404);
      }

      await client.query(
        `UPDATE users
         SET token_version = token_version + 1, updated_at = NOW()
         WHERE company_id = $1 AND role = 'company_admin'`,
        [companyId]
      );

      const updated = await client.query(
        `UPDATE companies
         SET status = 'active', blocked_reason = NULL, blocked_at = NULL, updated_at = NOW()
         WHERE id = $1
         RETURNING id AS "companyId", name AS "companyName", status, credits_remaining AS "creditsRemaining",
                   can_create_batches AS "canCreateBatches", can_request_upi AS "canRequestUpi",
                   can_view_reports AS "canViewReports", blocked_reason AS "blockedReason",
                   blocked_at AS "blockedAt", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [companyId]
      );

      return updated.rows[0];
    });

    res.json({ company: result });
  })
);

router.patch(
  '/:id/permissions',
  requireAuth,
  requireRole('super_admin'),
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 15,
    message: 'Too many permission updates.',
    keyGenerator: (req) => `${req.user?.id ?? req.ip}:company-permissions`
  }),
  asyncHandler(async (req, res) => {
    const companyId = req.params.id;
    const parsed = {
      canCreateBatches: parseOptionalBoolean(req.body.canCreateBatches),
      canRequestUpi: parseOptionalBoolean(req.body.canRequestUpi),
      canViewReports: parseOptionalBoolean(req.body.canViewReports)
    };

    const company = await pool.query<{ id: string; name: string }>('SELECT id, name FROM companies WHERE id = $1', [
      companyId
    ]);
    if (!company.rows[0]) {
      throw new AppError('Company not found', 404);
    }

    const updated = await pool.query(
      `UPDATE companies
       SET can_create_batches = COALESCE($2, can_create_batches),
           can_request_upi = COALESCE($3, can_request_upi),
           can_view_reports = COALESCE($4, can_view_reports),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id AS "companyId", name AS "companyName", status, credits_remaining AS "creditsRemaining",
                 can_create_batches AS "canCreateBatches", can_request_upi AS "canRequestUpi",
                 can_view_reports AS "canViewReports", blocked_reason AS "blockedReason",
                 blocked_at AS "blockedAt", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [companyId, parsed.canCreateBatches ?? null, parsed.canRequestUpi ?? null, parsed.canViewReports ?? null]
    );

    res.json({ company: updated.rows[0] });
  })
);

router.get(
  '/email-settings',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = resolveCompanyId(req);
    const company = await pool.query<{ id: string; name: string }>('SELECT id, name FROM companies WHERE id = $1', [
      companyId
    ]);
    if (!company.rows[0]) {
      throw new AppError('Company not found', 404);
    }

    const result = await pool.query<{
      company_id: string;
      sender_name: string | null;
      sender_email: string | null;
      reply_to_name: string | null;
      reply_to_email: string | null;
      smtp_host: string | null;
      smtp_port: number | null;
      smtp_secure: boolean | null;
      smtp_allow_invalid_certs: boolean | null;
      smtp_user: string | null;
      enabled: boolean | null;
      email_subject_template: string | null;
      email_body_template: string | null;
      brand_logo_url: string | null;
      brand_primary_color: string | null;
      claim_subject: string | null;
      claim_message: string | null;
      updated_at: string | null;
    }>(
      `SELECT company_id, sender_name, sender_email, reply_to_name, reply_to_email, smtp_host, smtp_port,
              smtp_secure, smtp_allow_invalid_certs, smtp_user, enabled, email_subject_template, email_body_template,
              brand_logo_url, brand_primary_color, claim_subject, claim_message, updated_at
       FROM company_email_settings
       WHERE company_id = $1`,
      [companyId]
    );

    const settings = result.rows[0] ?? null;
    res.json({
      company: {
        companyId,
        companyName: company.rows[0].name
      },
      settings: settings
        ? {
          companyId: settings.company_id,
          senderName: settings.sender_name,
          senderEmail: settings.sender_email,
          replyToName: settings.reply_to_name,
          replyToEmail: settings.reply_to_email,
          smtpHost: settings.smtp_host,
          smtpPort: settings.smtp_port,
          smtpSecure: settings.smtp_secure,
          smtpAllowInvalidCerts: settings.smtp_allow_invalid_certs,
          smtpUser: settings.smtp_user,
          enabled: settings.enabled,
          emailSubjectTemplate: settings.email_subject_template,
          emailBodyTemplate: settings.email_body_template,
          brandLogoUrl: settings.brand_logo_url,
          brandPrimaryColor: settings.brand_primary_color,
          claimSubject: settings.claim_subject,
          claimMessage: settings.claim_message,
          updatedAt: settings.updated_at
        }
        : null
    });
  })
);

router.patch(
  '/email-settings',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = resolveCompanyId(req);
    const company = await pool.query<{ id: string; name: string }>('SELECT id, name FROM companies WHERE id = $1', [
      companyId
    ]);
    if (!company.rows[0]) {
      throw new AppError('Company not found', 404);
    }

    const senderName = String(req.body.senderName ?? '').trim() || company.rows[0].name;
    const senderEmail = String(req.body.senderEmail ?? '').trim() || null;
    const replyToName = String(req.body.replyToName ?? '').trim() || null;
    const replyToEmail = String(req.body.replyToEmail ?? '').trim() || null;
    const smtpHost = String(req.body.smtpHost ?? '').trim() || null;
    let smtpPort = Number(req.body.smtpPort);
    if (!Number.isFinite(smtpPort) || smtpPort <= 0) {
      smtpPort = 587;
    }
    const smtpSecure = Boolean(req.body.smtpSecure);
    const normalizedSmtpSecure = normalizeSmtpSecure(smtpPort, smtpSecure);
    const smtpAllowInvalidCerts = parseOptionalBoolean(req.body.smtpAllowInvalidCerts) ?? false;
    const smtpUser = String(req.body.smtpUser ?? '').trim() || null;
    const smtpPass = String(req.body.smtpPass ?? '').trim() || null;
    const emailSubjectTemplate = String(req.body.emailSubjectTemplate ?? '').trim() || null;
    const emailBodyTemplate = String(req.body.emailBodyTemplate ?? '').trim() || null;
    const brandLogoUrl = String(req.body.brandLogoUrl ?? '').trim() || null;
    const brandPrimaryColor = String(req.body.brandPrimaryColor ?? '').trim() || null;
    const claimSubject = String(req.body.claimSubject ?? '').trim().slice(0, 200) || null;
    const claimMessage = String(req.body.claimMessage ?? '').trim().slice(0, 4000) || null;

    const existing = await pool.query<{ smtp_pass: string | null }>(
      'SELECT smtp_pass FROM company_email_settings WHERE company_id = $1',
      [companyId]
    );

    const password = smtpPass || existing.rows[0]?.smtp_pass || null;
    const enabled = Boolean(senderEmail && smtpHost && smtpUser && password);

    const saved = await pool.query(
      `INSERT INTO company_email_settings (
         company_id, sender_name, sender_email, reply_to_name, reply_to_email, smtp_host, smtp_port,
         smtp_secure, smtp_allow_invalid_certs, smtp_user, smtp_pass, enabled, email_subject_template, email_body_template,
         brand_logo_url, brand_primary_color, claim_subject, claim_message, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
       ON CONFLICT (company_id)
       DO UPDATE SET
         sender_name = EXCLUDED.sender_name,
         sender_email = EXCLUDED.sender_email,
         reply_to_name = EXCLUDED.reply_to_name,
         reply_to_email = EXCLUDED.reply_to_email,
         smtp_host = EXCLUDED.smtp_host,
         smtp_port = EXCLUDED.smtp_port,
         smtp_secure = EXCLUDED.smtp_secure,
         smtp_allow_invalid_certs = EXCLUDED.smtp_allow_invalid_certs,
         smtp_user = EXCLUDED.smtp_user,
         smtp_pass = EXCLUDED.smtp_pass,
         enabled = EXCLUDED.enabled,
         email_subject_template = EXCLUDED.email_subject_template,
         email_body_template = EXCLUDED.email_body_template,
         brand_logo_url = EXCLUDED.brand_logo_url,
         brand_primary_color = EXCLUDED.brand_primary_color,
         claim_subject = EXCLUDED.claim_subject,
         claim_message = EXCLUDED.claim_message,
         updated_at = NOW()
       RETURNING company_id AS "companyId", sender_name AS "senderName", sender_email AS "senderEmail",
                 reply_to_name AS "replyToName", reply_to_email AS "replyToEmail",
                 smtp_host AS "smtpHost", smtp_port AS "smtpPort", smtp_secure AS "smtpSecure",
                 smtp_allow_invalid_certs AS "smtpAllowInvalidCerts", smtp_user AS "smtpUser", enabled, email_subject_template AS "emailSubjectTemplate",
                 email_body_template AS "emailBodyTemplate", brand_logo_url AS "brandLogoUrl",
                 brand_primary_color AS "brandPrimaryColor", claim_subject AS "claimSubject",
                 claim_message AS "claimMessage", updated_at AS "updatedAt"` ,
      [
        companyId,
        senderName,
        senderEmail,
        replyToName,
        replyToEmail,
        smtpHost,
        smtpPort,
        normalizedSmtpSecure,
        smtpAllowInvalidCerts,
        smtpUser,
        password,
        enabled,
        emailSubjectTemplate,
        emailBodyTemplate,
        brandLogoUrl,
        brandPrimaryColor,
        claimSubject,
        claimMessage
      ]
    );

    res.json({
      company: {
        companyId,
        companyName: company.rows[0].name
      },
      settings: saved.rows[0]
    });
  })
);

router.post(
  '/email-settings/test',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = resolveCompanyId(req);
    const company = await pool.query<{ id: string; name: string }>('SELECT id, name FROM companies WHERE id = $1', [
      companyId
    ]);
    if (!company.rows[0]) {
      throw new AppError('Company not found', 404);
    }

    await testCompanyEmailSettings(companyId);

    res.json({
      ok: true,
      message: 'SMTP login test succeeded'
    });
  })
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('super_admin'),
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    message: 'Too many company deletions.',
    keyGenerator: (req) => `${req.user?.id ?? req.ip}:company-delete`
  }),
  asyncHandler(async (req, res) => {
    const companyId = req.params.id;

    await withTransaction(async (client) => {
      const company = await client.query<{ id: string; name: string }>('SELECT id, name FROM companies WHERE id = $1', [
        companyId
      ]);
      if (!company.rows[0]) {
        throw new AppError('Company not found', 404);
      }

      await client.query('DELETE FROM users WHERE company_id = $1 AND role = $2', [companyId, 'company_admin']);
      await client.query('DELETE FROM companies WHERE id = $1', [companyId]);
    });

    res.json({ ok: true });
  })
);

export default router;
