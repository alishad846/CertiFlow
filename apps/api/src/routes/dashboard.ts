import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { getCompanyAccess } from '../services/companies';
import { AppError } from '../lib/errors';

const router = Router();

router.get(
  '/stats',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyFilter = req.user?.role === 'super_admin' ? null : req.user?.companyId;
    if (req.user?.role === 'company_admin') {
      const company = req.user.companyId ? await getCompanyAccess(req.user.companyId) : null;
      if (!company || company.status !== 'active') {
        throw new AppError('Company access is blocked', 403);
      }
      if (!company.can_view_reports) {
        throw new AppError('Reports access is disabled for this company', 403);
      }
    }

    const statsQuery = companyFilter
      ? {
          documents: 'SELECT COUNT(*)::int AS count FROM documents WHERE company_id = $1',
          sent: `SELECT COUNT(*)::int AS count FROM email_logs WHERE company_id = $1 AND status = 'sent'`,
          failed: `SELECT COUNT(*)::int AS count FROM email_logs WHERE company_id = $1 AND status = 'failed'`,
          pending: `SELECT COUNT(*)::int AS count FROM documents WHERE company_id = $1 AND status IN ('pending', 'processing')`,
          credits: 'SELECT credits_remaining::int AS credits FROM companies WHERE id = $1',
          batches: 'SELECT COUNT(*)::int AS count FROM batches WHERE company_id = $1'
        }
      : {
          documents: 'SELECT COUNT(*)::int AS count FROM documents',
          sent: `SELECT COUNT(*)::int AS count FROM email_logs WHERE status = 'sent'`,
          failed: `SELECT COUNT(*)::int AS count FROM email_logs WHERE status = 'failed'`,
          pending: `SELECT COUNT(*)::int AS count FROM documents WHERE status IN ('pending', 'processing')`,
          credits: 'SELECT COALESCE(SUM(credits_remaining), 0)::int AS credits FROM companies',
          batches: 'SELECT COUNT(*)::int AS count FROM batches'
        };

    const [documents, sent, failed, pending, credits, batches] = await Promise.all([
      pool.query(statsQuery.documents, companyFilter ? [companyFilter] : []),
      pool.query(statsQuery.sent, companyFilter ? [companyFilter] : []),
      pool.query(statsQuery.failed, companyFilter ? [companyFilter] : []),
      pool.query(statsQuery.pending, companyFilter ? [companyFilter] : []),
      pool.query(statsQuery.credits, companyFilter ? [companyFilter] : []),
      pool.query(statsQuery.batches, companyFilter ? [companyFilter] : [])
    ]);

    res.json({
      totalGeneratedDocuments: documents.rows[0]?.count ?? 0,
      remainingCredits: credits.rows[0]?.credits ?? 0,
      emailsSent: sent.rows[0]?.count ?? 0,
      failedEmails: failed.rows[0]?.count ?? 0,
      pendingEmails: pending.rows[0]?.count ?? 0,
      totalBatches: batches.rows[0]?.count ?? 0
    });
  })
);

export default router;
