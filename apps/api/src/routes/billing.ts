import { randomUUID } from 'crypto';
import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { pool, withTransaction } from '../db/pool';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { rateLimit } from '../lib/rate-limit';
import { env } from '../config/env';
import { z } from 'zod';
import { type PricingPlan, type PricingPlanKey, PRICING_RULES } from '@certiflow/shared';
import { getCompanyAccess } from '../services/companies';
import { getPricingPlan, listPricingPlans, replacePricingPlans } from '../services/pricing';

const router = Router();

const pricingPlanSchema = z.object({
  key: z.enum(['starter', 'growth', 'scale']),
  name: z.string().min(1),
  description: z.string().min(1),
  credits: z.number().int().positive(),
  amountInr: z.number().nonnegative(),
  recommended: z.boolean().optional().default(false),
  features: z.array(z.string().min(1)).optional().default([])
});

const pricingPlansSchema = z.object({
  plans: z.array(pricingPlanSchema).length(3)
});

function buildUpiLink(params: {
  payeeVpa: string;
  payeeName: string;
  amount: number;
  note: string;
}) {
  const searchParams = new URLSearchParams({
    pa: params.payeeVpa,
    pn: params.payeeName,
    am: params.amount.toFixed(2),
    cu: env.UPI_CURRENCY,
    tn: params.note
  });

  return `upi://pay?${searchParams.toString()}`;
}

async function getCompanyDiscount(companyId: string) {
  const result = await pool.query<{
    discount_percent: number;
    note: string | null;
  }>(
    `SELECT discount_percent, note
     FROM company_discounts
     WHERE company_id = $1`,
    [companyId]
  );

  return result.rows[0] ?? { discount_percent: 0, note: null };
}

function calculateDiscountedAmount(baseAmount: number, discountPercent: number) {
  const discountAmount = Number(((baseAmount * discountPercent) / 100).toFixed(2));
  const amount = Number((baseAmount - discountAmount).toFixed(2));
  return { discountAmount, amount };
}

router.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const plans = await listPricingPlans();
    res.json({ plans });
  })
);

router.patch(
  '/plans',
  requireAuth,
  requireRole('super_admin'),
  asyncHandler(async (req, res) => {
    const parsed = pricingPlansSchema.parse(req.body);
    const updated = await replacePricingPlans(
      parsed.plans.map((plan) => ({
        key: plan.key,
        name: plan.name,
        description: plan.description,
        credits: plan.credits,
        amountInr: plan.amountInr,
        recommended: plan.recommended ?? false,
        features: plan.features
      })) as PricingPlan[],
      req.user!.id
    );

    res.json({ plans: updated });
  })
);

router.get(
  '/upi',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = req.user?.role === 'super_admin' ? req.query.companyId?.toString() : req.user?.companyId;
    if (req.user?.role === 'company_admin') {
      const company = req.user.companyId ? await getCompanyAccess(req.user.companyId) : null;
      if (!company || company.status !== 'active') {
        throw new AppError('Company access is blocked', 403);
      }
      if (!company.can_request_upi) {
        throw new AppError('UPI requests are disabled for this company', 403);
      }
    }
    const result = companyId
      ? await pool.query(
          `SELECT up.id, up.company_id AS "companyId", c.name AS "companyName", up.plan_key AS "planKey",
                  up.plan_name AS "planName", up.credits, up.base_amount_inr AS "baseAmountInr",
                  up.discount_percent AS "discountPercent", up.discount_amount_inr AS "discountAmountInr",
                  up.amount_inr AS "amountInr", up.status, up.transaction_reference AS "transactionReference",
                  up.customer_name AS "customerName", up.customer_email AS "customerEmail",
                  up.payment_note AS "paymentNote", up.created_at AS "createdAt",
                  up.updated_at AS "updatedAt", up.approved_at AS "approvedAt"
           FROM upi_payments up
           JOIN companies c ON c.id = up.company_id
           WHERE up.company_id = $1
           ORDER BY up.created_at DESC`,
          [companyId]
        )
      : await pool.query(
          `SELECT up.id, up.company_id AS "companyId", c.name AS "companyName", up.plan_key AS "planKey",
                  up.plan_name AS "planName", up.credits, up.base_amount_inr AS "baseAmountInr",
                  up.discount_percent AS "discountPercent", up.discount_amount_inr AS "discountAmountInr",
                  up.amount_inr AS "amountInr", up.status, up.transaction_reference AS "transactionReference",
                  up.customer_name AS "customerName", up.customer_email AS "customerEmail",
                  up.payment_note AS "paymentNote", up.created_at AS "createdAt",
                  up.updated_at AS "updatedAt", up.approved_at AS "approvedAt"
           FROM upi_payments up
           JOIN companies c ON c.id = up.company_id
           ORDER BY up.created_at DESC`
        );

    res.json({ payments: result.rows });
  })
);

router.post(
  '/upi',
  requireAuth,
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 8,
    message: 'Too many payment requests.',
    keyGenerator: (req) => `${req.user?.id ?? req.ip}:upi-create`
  }),
  asyncHandler(async (req, res) => {
    const planKey = String(req.body.planKey ?? '').trim();
    const customerName = String(req.body.customerName ?? req.user?.name ?? '').trim();
    const customerEmail = String(req.body.customerEmail ?? req.user?.email ?? '').trim();
    const companyId = req.user?.role === 'super_admin' ? String(req.body.companyId ?? '').trim() : req.user?.companyId;

    if (!companyId) {
      throw new AppError('Company is required', 400);
    }
    if (req.user?.role === 'company_admin' && req.user.permissions?.canRequestUpi === false) {
      throw new AppError('You do not have permission to request billing top-ups', 403);
    }

    const plan = await getPricingPlan(planKey as PricingPlanKey);
    if (!plan) {
      throw new AppError('Invalid pricing plan', 400);
    }
    if (!env.UPI_VPA) {
      throw new AppError('UPI payments are not configured yet. Set UPI_VPA in .env.', 400);
    }

    const companyAccess = await getCompanyAccess(companyId);
    if (!companyAccess || companyAccess.status !== 'active') {
      throw new AppError('Company is blocked', 403);
    }
    if (!companyAccess.can_request_upi) {
      throw new AppError('UPI requests are disabled for this company', 403);
    }

    const companyResult = await pool.query<{ name: string }>('SELECT name FROM companies WHERE id = $1', [companyId]);
    if (!companyResult.rows[0]) {
      throw new AppError('Company not found', 404);
    }

    const discount = await getCompanyDiscount(companyId);
    if (!PRICING_RULES.allowedDiscountPercents.includes(discount.discount_percent as 0 | 5 | 10 | 15 | 20)) {
      throw new AppError('Invalid discount configuration. Use approved pricing rules only.', 400);
    }
    const { discountAmount, amount } = calculateDiscountedAmount(plan.amountInr, discount.discount_percent);
    const paymentId = randomUUID();
    const paymentNote =
      discount.discount_percent > 0
        ? `CertiFlow ${plan.name} top-up with ${discount.discount_percent}% discount`
        : `CertiFlow ${plan.name} top-up`;
    const upiLink = buildUpiLink({
      payeeVpa: env.UPI_VPA,
      payeeName: env.UPI_PAYEE_NAME,
      amount,
      note: paymentNote
    });

    const payment = await pool.query(
      `INSERT INTO upi_payments (
         id, company_id, created_by, plan_key, plan_name, credits,
         base_amount_inr, discount_percent, discount_amount_inr, amount_inr,
         status, customer_name, customer_email, payment_note
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, $12, $13)
       RETURNING id, company_id AS "companyId", plan_key AS "planKey", plan_name AS "planName",
                 credits, base_amount_inr AS "baseAmountInr", discount_percent AS "discountPercent",
                 discount_amount_inr AS "discountAmountInr", amount_inr AS "amountInr", status,
                 transaction_reference AS "transactionReference", customer_name AS "customerName",
                 customer_email AS "customerEmail", payment_note AS "paymentNote",
                 created_at AS "createdAt", updated_at AS "updatedAt", approved_at AS "approvedAt"`,
      [
        paymentId,
        companyId,
        req.user!.id,
        plan.key,
        plan.name,
        plan.credits,
        plan.amountInr,
        discount.discount_percent,
        discountAmount,
        amount,
        customerName || companyResult.rows[0].name,
        customerEmail || null,
        paymentNote
      ]
    );

    res.status(201).json({
      payment: {
        ...payment.rows[0],
        companyName: companyResult.rows[0].name,
        upiLink,
        payeeVpa: env.UPI_VPA,
        payeeName: env.UPI_PAYEE_NAME,
        currency: env.UPI_CURRENCY
      }
    });
  })
);

router.get(
  '/upi/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const paymentResult = await pool.query(
      `SELECT up.id, up.company_id AS "companyId", c.name AS "companyName", up.plan_key AS "planKey",
              up.plan_name AS "planName", up.credits, up.base_amount_inr AS "baseAmountInr",
              up.discount_percent AS "discountPercent", up.discount_amount_inr AS "discountAmountInr",
              up.amount_inr AS "amountInr", up.status, up.transaction_reference AS "transactionReference",
              up.customer_name AS "customerName", up.customer_email AS "customerEmail", up.payment_note AS "paymentNote",
              up.created_at AS "createdAt", up.updated_at AS "updatedAt", up.approved_at AS "approvedAt"
       FROM upi_payments up
       JOIN companies c ON c.id = up.company_id
       WHERE up.id = $1`,
      [req.params.id]
    );

    const payment = paymentResult.rows[0];
    if (!payment) {
      throw new AppError('Payment request not found', 404);
    }
    if (req.user?.role !== 'super_admin' && payment.companyId !== req.user?.companyId) {
      throw new AppError('Forbidden', 403);
    }
    if (req.user?.role === 'company_admin' && req.user.permissions?.canRequestUpi === false) {
      throw new AppError('You do not have permission to manage billing top-ups', 403);
    }

    res.json({
      payment,
      upiLink: buildUpiLink({
        payeeVpa: env.UPI_VPA,
        payeeName: env.UPI_PAYEE_NAME,
        amount: Number(payment.amountInr),
        note: payment.paymentNote || `CertiFlow ${payment.planName} top-up`
      }),
      payeeVpa: env.UPI_VPA,
      payeeName: env.UPI_PAYEE_NAME,
      currency: env.UPI_CURRENCY
    });
  })
);

router.post(
  '/upi/:id/submit',
  requireAuth,
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    message: 'Too many payment submissions.',
    keyGenerator: (req) => `${req.user?.id ?? req.ip}:upi-submit`
  }),
  asyncHandler(async (req, res) => {
    const transactionReference = String(req.body.transactionReference ?? '').trim();
    if (!transactionReference) {
      throw new AppError('Transaction reference is required', 400);
    }

    if (req.user?.role === 'company_admin') {
      const company = req.user.companyId ? await getCompanyAccess(req.user.companyId) : null;
      if (!company || company.status !== 'active') {
        throw new AppError('Company access is blocked', 403);
      }
      if (!company.can_request_upi) {
        throw new AppError('UPI requests are disabled for this company', 403);
      }
    }

    const paymentResult = await pool.query<{ company_id: string }>(
      'SELECT company_id FROM upi_payments WHERE id = $1',
      [req.params.id]
    );
    const payment = paymentResult.rows[0];
    if (!payment) {
      throw new AppError('Payment request not found', 404);
    }
    if (req.user?.role !== 'super_admin' && payment.company_id !== req.user?.companyId) {
      throw new AppError('Forbidden', 403);
    }

    const updated = await pool.query(
      `UPDATE upi_payments
       SET transaction_reference = $2, status = 'submitted', updated_at = NOW()
       WHERE id = $1
       RETURNING id, status, transaction_reference AS "transactionReference", updated_at AS "updatedAt"`,
      [req.params.id, transactionReference]
    );

    res.json({ payment: updated.rows[0] });
  })
);

router.post(
  '/upi/:id/approve',
  requireAuth,
  requireRole('super_admin'),
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    message: 'Too many approval attempts.',
    keyGenerator: (req) => `${req.user?.id ?? req.ip}:upi-approve`
  }),
  asyncHandler(async (req, res) => {
    const result = await withTransaction(async (client) => {
      const paymentResult = await client.query<{
        id: string;
        company_id: string;
        credits: number;
        status: 'pending' | 'submitted' | 'approved' | 'rejected';
        transaction_reference: string | null;
        plan_name: string;
      }>(
        'SELECT id, company_id, credits, status, transaction_reference, plan_name FROM upi_payments WHERE id = $1 FOR UPDATE',
        [req.params.id]
      );

      const payment = paymentResult.rows[0];
      if (!payment) {
        throw new AppError('Payment request not found', 404);
      }

      if (payment.status === 'approved') {
        return payment;
      }

      await client.query('UPDATE companies SET credits_remaining = credits_remaining + $1, updated_at = NOW() WHERE id = $2', [
        payment.credits,
        payment.company_id
      ]);

      await client.query(
        'INSERT INTO credit_ledger (company_id, change_amount, reason, reference_id) VALUES ($1, $2, $3, $4)',
        [payment.company_id, payment.credits, 'upi_topup', payment.id]
      );

      const updated = await client.query(
        `UPDATE upi_payments
         SET status = 'approved', approved_by = $2, approved_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING id, company_id, credits, status, transaction_reference, plan_name`,
        [payment.id, req.user!.id]
      );

      return updated.rows[0];
    });

    res.json({ payment: result });
  })
);

router.get(
  '/discounts',
  requireAuth,
  asyncHandler(async (req, res) => {
    const isSuperAdmin = req.user?.role === 'super_admin';
    const companyId = isSuperAdmin ? req.query.companyId?.toString().trim() : req.user?.companyId;

    const result = companyId
      ? await pool.query(
          `SELECT c.id AS "companyId", c.name AS "companyName", c.credits_remaining AS "creditsRemaining",
                  COALESCE(cd.discount_percent, 0)::int AS "discountPercent", cd.note, cd.updated_at AS "updatedAt"
           FROM companies c
           LEFT JOIN company_discounts cd ON cd.company_id = c.id
           WHERE c.id = $1`,
          [companyId]
        )
      : await pool.query(
          `SELECT c.id AS "companyId", c.name AS "companyName", c.credits_remaining AS "creditsRemaining",
                  COALESCE(cd.discount_percent, 0)::int AS "discountPercent", cd.note, cd.updated_at AS "updatedAt"
           FROM companies c
           LEFT JOIN company_discounts cd ON cd.company_id = c.id
           ORDER BY c.name ASC`
        );

    res.json({ companies: result.rows });
  })
);

router.post(
  '/discounts',
  requireAuth,
  requireRole('super_admin'),
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    message: 'Too many discount updates.',
    keyGenerator: (req) => `${req.user?.id ?? req.ip}:discount-update`
  }),
  asyncHandler(async (req, res) => {
    const companyId = String(req.body.companyId ?? '').trim();
    const note = String(req.body.note ?? '').trim();
    const discountPercent = Number(req.body.discountPercent);

    if (!companyId) {
      throw new AppError('Company is required', 400);
    }
    if (!Number.isFinite(discountPercent) || !Number.isInteger(discountPercent)) {
      throw new AppError('Discount percent must be a whole number', 400);
    }
    if (!PRICING_RULES.allowedDiscountPercents.includes(discountPercent as 0 | 5 | 10 | 15 | 20)) {
      throw new AppError(
        `Discount percent must be one of: ${PRICING_RULES.allowedDiscountPercents.join(', ')}.`,
        400
      );
    }

    const companyExists = await pool.query('SELECT id, name FROM companies WHERE id = $1', [companyId]);
    if (!companyExists.rows[0]) {
      throw new AppError('Company not found', 404);
    }

    const updated = await pool.query(
      `INSERT INTO company_discounts (
         company_id, discount_percent, note, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT (company_id)
       DO UPDATE SET
         discount_percent = EXCLUDED.discount_percent,
         note = EXCLUDED.note,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING id, company_id AS "companyId", discount_percent AS "discountPercent", note, updated_at AS "updatedAt"`,
      [companyId, discountPercent, note || null, req.user!.id]
    );

    res.status(201).json({
      company: {
        companyId,
        companyName: companyExists.rows[0].name,
        ...updated.rows[0]
      }
    });
  })
);

export default router;
