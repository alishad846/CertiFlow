import { type PoolClient } from 'pg';
import { pool, withTransaction } from '../db/pool';
import { AppError } from '../lib/errors';
import { PRICING_PLANS as DEFAULT_PRICING_PLANS, type PricingPlan, type PricingPlanKey } from '@certiflow/shared';

type PricingPlanRow = {
  plan_key: PricingPlanKey;
  name: string;
  description: string;
  credits: number | string;
  amount_inr: number | string;
  recommended: boolean;
  features: unknown;
  display_order: number | string;
};

function toNumber(value: number | string) {
  return Number(value);
}

function normalizeFeatures(features: unknown) {
  if (Array.isArray(features)) {
    return features.map((feature) => String(feature).trim()).filter(Boolean);
  }
  return [];
}

function normalizePricingPlan(row: PricingPlanRow): PricingPlan {
  return {
    key: row.plan_key,
    name: row.name,
    description: row.description,
    credits: toNumber(row.credits),
    amountInr: toNumber(row.amount_inr),
    recommended: Boolean(row.recommended),
    features: normalizeFeatures(row.features)
  };
}

async function seedPricingPlans(client: PoolClient) {
  for (let index = 0; index < DEFAULT_PRICING_PLANS.length; index += 1) {
    const plan = DEFAULT_PRICING_PLANS[index];
    await client.query(
      `INSERT INTO pricing_plans (
         plan_key, name, description, credits, amount_inr, recommended, features, display_order
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       ON CONFLICT (plan_key) DO NOTHING`,
      [
        plan.key,
        plan.name,
        plan.description,
        plan.credits,
        plan.amountInr,
        Boolean(plan.recommended),
        JSON.stringify(plan.features),
        index
      ]
    );
  }
}

async function ensurePricingPlansSeeded(client?: PoolClient) {
  if (client) {
    const existing = await client.query('SELECT COUNT(*)::int AS count FROM pricing_plans');
    if ((existing.rows[0]?.count ?? 0) === 0) {
      await seedPricingPlans(client);
    }
    return;
  }

  await withTransaction(async (tx) => {
    const existing = await tx.query('SELECT COUNT(*)::int AS count FROM pricing_plans');
    if ((existing.rows[0]?.count ?? 0) === 0) {
      await seedPricingPlans(tx);
    }
  });
}

export async function listPricingPlans() {
  await ensurePricingPlansSeeded();
  const result = await pool.query<PricingPlanRow>(
    `SELECT plan_key, name, description, credits, amount_inr, recommended, features, display_order
     FROM pricing_plans
     ORDER BY display_order ASC, plan_key ASC`
  );

  return result.rows.map(normalizePricingPlan);
}

export async function getPricingPlan(planKey: PricingPlanKey) {
  await ensurePricingPlansSeeded();
  const result = await pool.query<PricingPlanRow>(
    `SELECT plan_key, name, description, credits, amount_inr, recommended, features, display_order
     FROM pricing_plans
     WHERE plan_key = $1`,
    [planKey]
  );

  return result.rows[0] ? normalizePricingPlan(result.rows[0]) : null;
}

export async function replacePricingPlans(plans: PricingPlan[], updatedBy: string) {
  if (plans.length !== DEFAULT_PRICING_PLANS.length) {
    throw new AppError(`Expected ${DEFAULT_PRICING_PLANS.length} pricing plans`, 400);
  }

  const knownKeys = new Set(DEFAULT_PRICING_PLANS.map((plan) => plan.key));
  for (const plan of plans) {
    if (!knownKeys.has(plan.key)) {
      throw new AppError(`Unknown plan key: ${plan.key}`, 400);
    }
    if (!Number.isFinite(plan.credits) || plan.credits <= 0) {
      throw new AppError(`Credits for ${plan.key} must be a positive number`, 400);
    }
    if (!Number.isFinite(plan.amountInr) || plan.amountInr < 0) {
      throw new AppError(`Amount for ${plan.key} must be a valid number`, 400);
    }
  }

  await withTransaction(async (client) => {
    await seedPricingPlans(client);

    for (let index = 0; index < plans.length; index += 1) {
      const plan = plans[index];
      await client.query(
        `UPDATE pricing_plans
         SET name = $2,
             description = $3,
             credits = $4,
             amount_inr = $5,
             recommended = $6,
             features = $7::jsonb,
             display_order = $8,
             updated_by = $9,
             updated_at = NOW()
         WHERE plan_key = $1`,
        [
          plan.key,
          plan.name,
          plan.description,
          Math.round(plan.credits),
          Number(plan.amountInr.toFixed(2)),
          Boolean(plan.recommended),
          JSON.stringify(plan.features),
          index,
          updatedBy
        ]
      );
    }
  });

  return listPricingPlans();
}
