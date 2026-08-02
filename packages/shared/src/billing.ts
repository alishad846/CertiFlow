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
    description: '500 credits to send your first batches.',
    credits: 500,
    amountInr: 1499,
    features: ['500 document credits', 'Signed, verifiable PDFs', 'QR + tamper-evident verification']
  },
  {
    key: 'growth',
    name: 'Growth',
    description: '2,000 credits — best value for active teams.',
    credits: 2000,
    amountInr: 4999,
    recommended: true,
    features: ['2,000 document credits', 'Priority batch processing', 'Best value per credit']
  },
  {
    key: 'scale',
    name: 'Scale',
    description: '5,000 credits for high-volume sending.',
    credits: 5000,
    amountInr: 9999,
    features: ['5,000 document credits', 'Highest volume sending', 'Ideal for large hiring drives']
  }
];

export function getPricingPlan(planKey: string) {
  return PRICING_PLANS.find((plan) => plan.key === planKey) ?? null;
}
