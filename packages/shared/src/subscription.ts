export type SubscriptionTierKey = 'starter' | 'growth' | 'scale';

export interface SubscriptionFeatures {
  /** Digitally sign (PAdES) issued certificate PDFs. */
  signedPdfs: boolean;
  /** Company-branded public verification page. */
  brandedVerify: boolean;
  /** "Add to LinkedIn" + social sharing on the claim page. */
  linkedIn: boolean;
  /** Revoke / re-issue certificates. */
  revocation: boolean;
  /** Delivery + claim analytics dashboards. */
  analytics: boolean;
  /** Programmatic issuing via API + webhooks. */
  apiAccess: boolean;
}

export interface SubscriptionTier {
  key: SubscriptionTierKey;
  name: string;
  tagline: string;
  /** Monthly price in INR. */
  priceInr: number;
  /** Certificates included per month before overage. */
  includedCertificates: number;
  /** Price per certificate beyond the monthly allowance. */
  overageInr: number;
  /** Admin seats; 0 = unlimited. */
  seats: number;
  recommended?: boolean;
  features: SubscriptionFeatures;
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    key: 'starter',
    name: 'Starter',
    tagline: 'For small teams issuing their first certificates.',
    priceInr: 999,
    includedCertificates: 100,
    overageInr: 8,
    seats: 1,
    features: {
      signedPdfs: false,
      brandedVerify: false,
      linkedIn: false,
      revocation: false,
      analytics: false,
      apiAccess: false
    }
  },
  {
    key: 'growth',
    name: 'Growth',
    tagline: 'Everything a real credentialing programme needs.',
    priceInr: 4999,
    includedCertificates: 2000,
    overageInr: 4,
    seats: 5,
    recommended: true,
    features: {
      signedPdfs: true,
      brandedVerify: true,
      linkedIn: true,
      revocation: true,
      analytics: true,
      apiAccess: false
    }
  },
  {
    key: 'scale',
    name: 'Scale',
    tagline: 'High volume, API-driven issuing for enterprises.',
    priceInr: 14999,
    includedCertificates: 10000,
    overageInr: 2,
    seats: 0,
    features: {
      signedPdfs: true,
      brandedVerify: true,
      linkedIn: true,
      revocation: true,
      analytics: true,
      apiAccess: true
    }
  }
];

export const SUBSCRIPTION_FEATURE_LABELS: Record<keyof SubscriptionFeatures, string> = {
  signedPdfs: 'Tamper-proof signed PDFs',
  brandedVerify: 'Branded verification page',
  linkedIn: 'Add to LinkedIn & sharing',
  revocation: 'Revoke & re-issue',
  analytics: 'Delivery & claim analytics',
  apiAccess: 'API access & webhooks'
};

export function getSubscriptionTier(key: string): SubscriptionTier | null {
  return SUBSCRIPTION_TIERS.find((tier) => tier.key === key) ?? null;
}

export const DEFAULT_SUBSCRIPTION_TIER: SubscriptionTierKey = 'starter';
