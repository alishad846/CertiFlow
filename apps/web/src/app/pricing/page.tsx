import Link from 'next/link';
import { ArrowRight, Banknote, CheckCircle2, QrCode, ShieldCheck, Smartphone } from 'lucide-react';
import { PRICING_PLANS, PRICING_RULES } from '@certiflow/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const steps = [
  'Choose a credit pack that matches your monthly volume.',
  'Pay through UPI using the generated request or app intent.',
  'Submit your transaction reference and let the super admin approve it.'
];

export default function PricingPage() {
  return (
    <main className="min-h-screen px-4 py-6 text-ink md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="overflow-hidden border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.03),rgba(42,141,240,0.05))]">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent-50 px-4 py-2 text-sm font-semibold text-accent-700">
              <ShieldCheck className="h-4 w-4" />
              UPI-friendly credit pricing
            </div>
            <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-6xl" style={{ fontFamily: 'var(--font-heading)' }}>
              Buy credits with a simple UPI payment flow.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              CertiFlow keeps pricing simple: choose a plan, pay via UPI, then top up your credits after the payment is approved.
            </p>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr] lg:items-start">
          <div className="grid gap-6 lg:grid-cols-3">
            {PRICING_PLANS.map((plan) => (
              <Card key={plan.key} className="relative overflow-hidden">
                {plan.recommended ? (
                  <div className="absolute right-4 top-4">
                    <Badge tone="blue">Recommended</Badge>
                  </div>
                ) : null}
                <p className="text-sm font-semibold text-slate-500">{plan.name}</p>
                <div className="mt-3 flex items-end gap-2">
                  <div className="text-4xl font-bold tracking-tight">Rs. {plan.amountInr.toLocaleString('en-IN')}</div>
                </div>
                <p className="mt-2 text-sm font-semibold text-accent-700">{plan.credits.toLocaleString('en-IN')} credits</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{plan.description}</p>
                <ul className="mt-5 space-y-2 text-sm text-slate-600">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-accent-700" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Button asChild variant={plan.recommended ? 'primary' : 'secondary'} className="w-full">
                    <Link href="/register">
                      Get started
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <Card className="self-start space-y-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">UPI checkout</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">How payment works</h2>
            </div>

            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-2xl bg-slate-50 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white font-semibold text-accent-700 shadow-sm">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{step}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(42,141,240,0.12),rgba(42,141,240,0.04))] text-accent-700">
                  <QrCode className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-ink">UPI intent and approvals</p>
                  <p className="text-sm text-slate-500">Open the payment request in your UPI app, then submit the reference number for review.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-slate-50 p-4">
              <div className="flex items-center gap-2 font-semibold text-ink">
                <Smartphone className="h-4 w-4 text-accent-700" />
                Best for phone-based UPI payments
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This MVP uses direct UPI requests, so you can pay from any UPI app without a gateway account.
              </p>
            </div>
            <div className="rounded-[24px] bg-slate-50 p-4">
              <div className="flex items-center gap-2 font-semibold text-ink">
                <Banknote className="h-4 w-4 text-accent-700" />
                Credits are added after approval
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Super admins can verify the transaction and top up company credits from the billing screen.
              </p>
            </div>

            <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Strict pricing rules</p>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-amber-900/90">
                <li>Plan prices are managed by super admin from the Billing screen.</li>
                <li>Discount steps are limited to {PRICING_RULES.allowedDiscountPercents.join('%, ')}% only.</li>
                <li>Every UPI request is priced on the server before checkout.</li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
