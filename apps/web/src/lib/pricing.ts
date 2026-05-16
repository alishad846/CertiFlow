import { PRICING_PLANS as DEFAULT_PRICING_PLANS, type PricingPlan } from '@certiflow/shared';
import { apiUrl } from './api';

type PricingPlansResponse = {
  plans?: PricingPlan[];
};

export async function getLivePricingPlans(): Promise<PricingPlan[]> {
  try {
    const response = await fetch(`${apiUrl}/billing/plans`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('Failed to load pricing');
    }

    const data = (await response.json()) as PricingPlansResponse;
    if (Array.isArray(data.plans) && data.plans.length) {
      return data.plans;
    }
  } catch {
    // Fall back to the baked-in defaults if the API is unavailable.
  }

  return DEFAULT_PRICING_PLANS;
}

