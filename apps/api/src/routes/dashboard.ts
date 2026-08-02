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

    // 14-day issued-vs-claimed certificate series for the dashboard trend chart.
    const certsSeriesQuery = companyFilter
      ? `SELECT to_char(gs, 'YYYY-MM-DD') AS date,
           (SELECT COUNT(*)::int FROM certificates c WHERE c.company_id = $1 AND c.issued_at::date = gs::date) AS issued,
           (SELECT COUNT(*)::int FROM certificates c WHERE c.company_id = $1 AND c.claimed_at::date = gs::date) AS claimed
         FROM generate_series(CURRENT_DATE - interval '13 days', CURRENT_DATE, interval '1 day') gs
         ORDER BY gs`
      : `SELECT to_char(gs, 'YYYY-MM-DD') AS date,
           (SELECT COUNT(*)::int FROM certificates c WHERE c.issued_at::date = gs::date) AS issued,
           (SELECT COUNT(*)::int FROM certificates c WHERE c.claimed_at::date = gs::date) AS claimed
         FROM generate_series(CURRENT_DATE - interval '13 days', CURRENT_DATE, interval '1 day') gs
         ORDER BY gs`;

    const [documents, sent, failed, pending, credits, batches, certsSeries] = await Promise.all([
      pool.query(statsQuery.documents, companyFilter ? [companyFilter] : []),
      pool.query(statsQuery.sent, companyFilter ? [companyFilter] : []),
      pool.query(statsQuery.failed, companyFilter ? [companyFilter] : []),
      pool.query(statsQuery.pending, companyFilter ? [companyFilter] : []),
      pool.query(statsQuery.credits, companyFilter ? [companyFilter] : []),
      pool.query(statsQuery.batches, companyFilter ? [companyFilter] : []),
      pool.query(certsSeriesQuery, companyFilter ? [companyFilter] : [])
    ]);

    const emailsSent = sent.rows[0]?.count ?? 0;
    const failedEmails = failed.rows[0]?.count ?? 0;
    const pendingEmails = pending.rows[0]?.count ?? 0;

    res.json({
      totalGeneratedDocuments: documents.rows[0]?.count ?? 0,
      remainingCredits: credits.rows[0]?.credits ?? 0,
      emailsSent,
      failedEmails,
      pendingEmails,
      totalBatches: batches.rows[0]?.count ?? 0,
      // Delivery breakdown for the donut chart.
      delivery: { sent: emailsSent, failed: failedEmails, pending: pendingEmails },
      // Issued vs claimed over the last 14 days for the trend chart.
      certificates: certsSeries.rows.map((r) => ({
        date: r.date as string,
        issued: Number(r.issued ?? 0),
        claimed: Number(r.claimed ?? 0)
      }))
    });
  })
);

export default router;
