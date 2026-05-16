import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { pool, withTransaction } from '../db/pool';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { rateLimit } from '../lib/rate-limit';

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
      smtp_host: string | null;
      smtp_port: number | null;
      smtp_secure: boolean | null;
      smtp_user: string | null;
      enabled: boolean | null;
      updated_at: string | null;
    }>(
      `SELECT company_id, sender_name, sender_email, smtp_host, smtp_port, smtp_secure, smtp_user, enabled, updated_at
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
            smtpHost: settings.smtp_host,
            smtpPort: settings.smtp_port,
            smtpSecure: settings.smtp_secure,
            smtpUser: settings.smtp_user,
            enabled: settings.enabled,
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
    const senderName = String(req.body.senderName ?? '').trim() || null;
    const senderEmail = String(req.body.senderEmail ?? '').trim() || null;
    const smtpHost = String(req.body.smtpHost ?? '').trim() || null;
    const smtpPort = Number(req.body.smtpPort ?? 587);
    const smtpSecure = Boolean(req.body.smtpSecure);
    const smtpUser = String(req.body.smtpUser ?? '').trim() || null;
    const smtpPass = String(req.body.smtpPass ?? '').trim() || null;
    const enabled = Boolean(req.body.enabled);

    if (!senderEmail) {
      throw new AppError('Sender email is required', 400);
    }
    if (!smtpHost) {
      throw new AppError('SMTP host is required', 400);
    }
    if (!Number.isFinite(smtpPort) || smtpPort <= 0) {
      throw new AppError('SMTP port must be a positive number', 400);
    }
    if (enabled && !smtpUser) {
      throw new AppError('SMTP username is required when sender is enabled', 400);
    }

    const company = await pool.query<{ id: string; name: string }>('SELECT id, name FROM companies WHERE id = $1', [
      companyId
    ]);
    if (!company.rows[0]) {
      throw new AppError('Company not found', 404);
    }

    const existing = await pool.query<{ smtp_pass: string | null }>(
      'SELECT smtp_pass FROM company_email_settings WHERE company_id = $1',
      [companyId]
    );

    const password = smtpPass || existing.rows[0]?.smtp_pass || null;
    if (enabled && !password) {
      throw new AppError('SMTP password is required when sender is enabled', 400);
    }

    const saved = await pool.query(
      `INSERT INTO company_email_settings (
         company_id, sender_name, sender_email, smtp_host, smtp_port,
         smtp_secure, smtp_user, smtp_pass, enabled, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (company_id)
       DO UPDATE SET
         sender_name = EXCLUDED.sender_name,
         sender_email = EXCLUDED.sender_email,
         smtp_host = EXCLUDED.smtp_host,
         smtp_port = EXCLUDED.smtp_port,
         smtp_secure = EXCLUDED.smtp_secure,
         smtp_user = EXCLUDED.smtp_user,
         smtp_pass = EXCLUDED.smtp_pass,
         enabled = EXCLUDED.enabled,
         updated_at = NOW()
       RETURNING company_id AS "companyId", sender_name AS "senderName", sender_email AS "senderEmail",
                 smtp_host AS "smtpHost", smtp_port AS "smtpPort", smtp_secure AS "smtpSecure",
                 smtp_user AS "smtpUser", enabled, updated_at AS "updatedAt"` ,
      [companyId, senderName, senderEmail, smtpHost, smtpPort, smtpSecure, smtpUser, password, enabled]
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
