import { pool } from '../db/pool';
import {
  SUBSCRIPTION_TIERS,
  getSubscriptionTier,
  DEFAULT_SUBSCRIPTION_TIER,
  type SubscriptionTier,
  type SubscriptionFeatures,
  type SubscriptionTierKey
} from '@certiflow/shared';

export type Entitlements = {
  planKey: SubscriptionTierKey;
  tier: SubscriptionTier;
  features: SubscriptionFeatures;
  includedCertificates: number;
  overageInr: number;
  used: number;
  remaining: number;
  overage: number;
  periodStart: string;
  periodEnd: string;
  status: string;
};

type SubscriptionRow = {
  plan_key: string;
  status: string;
  period_start: Date;
  period_end: Date;
  certificates_used: number;
};

/**
 * Load a company's subscription, creating a default (Starter) row if none exists
 * and rolling the billing period forward (resetting usage) when it has elapsed.
 */
async function loadRolledSubscription(companyId: string): Promise<SubscriptionRow> {
  await pool.query(
    `INSERT INTO company_subscriptions (company_id, plan_key) VALUES ($1, $2)
     ON CONFLICT (company_id) DO NOTHING`,
    [companyId, DEFAULT_SUBSCRIPTION_TIER]
  );

  // Roll the period + reset usage if the current window has ended.
  await pool.query(
    `UPDATE company_subscriptions
     SET period_start = NOW(), period_end = NOW() + interval '30 days',
         certificates_used = 0, updated_at = NOW()
     WHERE company_id = $1 AND period_end < NOW()`,
    [companyId]
  );

  const result = await pool.query<SubscriptionRow>(
    `SELECT plan_key, status, period_start, period_end, certificates_used
     FROM company_subscriptions WHERE company_id = $1`,
    [companyId]
  );
  return result.rows[0];
}

export async function getEntitlements(companyId: string): Promise<Entitlements> {
  const row = await loadRolledSubscription(companyId);
  const tier = getSubscriptionTier(row.plan_key) ?? getSubscriptionTier(DEFAULT_SUBSCRIPTION_TIER)!;
  const used = row.certificates_used;
  const remaining = Math.max(0, tier.includedCertificates - used);
  const overage = Math.max(0, used - tier.includedCertificates);

  return {
    planKey: tier.key,
    tier,
    features: tier.features,
    includedCertificates: tier.includedCertificates,
    overageInr: tier.overageInr,
    used,
    remaining,
    overage,
    periodStart: row.period_start.toISOString(),
    periodEnd: row.period_end.toISOString(),
    status: row.status
  };
}

export async function hasFeature(companyId: string, feature: keyof SubscriptionFeatures): Promise<boolean> {
  const entitlements = await getEntitlements(companyId);
  return Boolean(entitlements.features[feature]);
}

/** Count one issued certificate against the current billing period. */
export async function recordCertificateUsage(companyId: string): Promise<void> {
  await loadRolledSubscription(companyId);
  await pool.query(
    `UPDATE company_subscriptions
     SET certificates_used = certificates_used + 1, updated_at = NOW()
     WHERE company_id = $1`,
    [companyId]
  );
}

/** Assign / change a company's plan and start a fresh billing period. */
export async function assignSubscription(companyId: string, planKey: string): Promise<Entitlements> {
  const tier = getSubscriptionTier(planKey);
  if (!tier) {
    throw new Error('Unknown subscription plan');
  }
  await pool.query(
    `INSERT INTO company_subscriptions (company_id, plan_key, status, period_start, period_end, certificates_used)
     VALUES ($1, $2, 'active', NOW(), NOW() + interval '30 days', 0)
     ON CONFLICT (company_id) DO UPDATE SET
       plan_key = EXCLUDED.plan_key,
       status = 'active',
       period_start = NOW(),
       period_end = NOW() + interval '30 days',
       certificates_used = 0,
       updated_at = NOW()`,
    [companyId, tier.key]
  );
  return getEntitlements(companyId);
}

export { SUBSCRIPTION_TIERS };
