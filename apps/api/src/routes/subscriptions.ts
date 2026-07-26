import { Router } from 'express';
import { z } from 'zod';
import type { Request } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { AppError } from '../lib/errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { SUBSCRIPTION_TIERS } from '@certiflow/shared';
import { getEntitlements, assignSubscription } from '../services/subscriptions';

const router = Router();

function resolveScopedCompanyId(req: Request): string {
  if (req.user?.role === 'super_admin') {
    const q = typeof req.query.companyId === 'string' ? req.query.companyId.trim() : '';
    if (!q) {
      throw new AppError('companyId query parameter is required for super admin.', 400);
    }
    return q;
  }
  if (!req.user?.companyId) {
    throw new AppError('No company associated with this account.', 403);
  }
  return req.user.companyId;
}

// Current plan + usage + the full tier catalogue (for the plans page).
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = resolveScopedCompanyId(req);
    const entitlements = await getEntitlements(companyId);
    res.json({ tiers: SUBSCRIPTION_TIERS, entitlements });
  })
);

// Super admin assigns/changes a company's plan (starts a fresh billing period).
router.post(
  '/assign',
  requireAuth,
  requireRole('super_admin'),
  asyncHandler(async (req, res) => {
    const { companyId, planKey } = z
      .object({ companyId: z.string().uuid(), planKey: z.enum(['starter', 'growth', 'scale']) })
      .parse(req.body);
    const entitlements = await assignSubscription(companyId, planKey);
    res.json({ ok: true, entitlements });
  })
);

export default router;
