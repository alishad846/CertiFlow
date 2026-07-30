export type PricingPlanKey = 'starter' | 'growth' | 'scale';
export type UpiPaymentStatus = 'pending' | 'submitted' | 'approved' | 'rejected';

export interface PricingPlan {
  key: PricingPlanKey;
  name: string;
  description: string;
  credits: number;
  amountInr: number;
  recommended?: boolean;
  features: string[];
}

export const PRICING_RULES = {
  maxCompanyDiscountPercent: 20,
  discountStepPercent: 5,
  allowedDiscountPercents: [0, 5, 10, 15, 20] as const,
  allowedPaymentStatuses: ['pending', 'submitted', 'approved', 'rejected'] as const
};

export interface CompanyDiscountRecord {
  companyId: string;
  companyName: string;
  creditsRemaining: number;
  discountPercent: number;
  note: string | null;
  updatedAt: string | null;
}

export interface UpiPaymentRecord {
  id: string;
  companyId: string;
  companyName: string;
  planKey: PricingPlanKey;
  planName: string;
  credits: number;
  baseAmountInr: number;
  discountPercent: number;
  discountAmountInr: number;
  amountInr: number;
  status: UpiPaymentStatus;
  transactionReference: string | null;
  customerName: string | null;
  customerEmail: string | null;
  paymentNote: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    key: 'starter',
    name: 'Starter',
    description: 'For small teams that want to buy credits in a simple way.',
    credits: 500,
    amountInr: 1499,
    features: ['500 credits included', 'Batch generation support', 'Email logs and retries']
  },
  {
    key: 'growth',
    name: 'Growth',
    description: 'Best for regular certificate and offer letter batches.',
    credits: 2000,
    amountInr: 4999,
    recommended: true,
    features: ['2,000 credits included', 'Priority batch processing', 'Best value for active teams']
  },
  {
    key: 'scale',
    name: 'Scale',
    description: 'For larger operations that need more credits upfront.',
    credits: 5000,
    amountInr: 9999,
    features: ['5,000 credits included', 'Higher volume sending', 'Ideal for teams sending at scale']
  }
];

export function getPricingPlan(planKey: string) {
  return PRICING_PLANS.find((plan) => plan.key === planKey) ?? null;
}
