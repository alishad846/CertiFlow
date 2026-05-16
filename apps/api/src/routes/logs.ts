import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { getCompanyAccess } from '../services/companies';

const router = Router();

router.get(
  '/email',
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const offset = Number(req.query.offset ?? 0);
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

    const query = companyId
      ? {
          text: `SELECT el.id, d.recipient_name AS "recipientName", d.recipient_email AS "recipientEmail",
                        el.status, el.error_message AS "errorMessage",
                        el.created_at AS "createdAt", d.batch_id AS "batchId"
                 FROM email_logs el
                 JOIN documents d ON d.id = el.document_id
                 WHERE el.company_id = $1
                 ORDER BY el.created_at DESC
                 LIMIT $2 OFFSET $3`,
          values: [companyId, limit, offset]
        }
      : {
          text: `SELECT el.id, d.recipient_name AS "recipientName", d.recipient_email AS "recipientEmail",
                        el.status, el.error_message AS "errorMessage",
                        el.created_at AS "createdAt", d.batch_id AS "batchId"
                 FROM email_logs el
                 JOIN documents d ON d.id = el.document_id
                 ORDER BY el.created_at DESC
                 LIMIT $1 OFFSET $2`,
          values: [limit, offset]
        };

    const result = await pool.query(query.text, query.values);
    res.json({ logs: result.rows, limit, offset });
  })
);

export default router;
