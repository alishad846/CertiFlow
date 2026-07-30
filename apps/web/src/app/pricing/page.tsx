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
        <Card>
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-bronze-deep">
              <ShieldCheck className="h-4 w-4" />
              Simple UPI credit pricing
            </div>
            <h1 className="mt-5 font-serif text-4xl tracking-tight text-ink md:text-6xl">
              Buy credits with a simple UPI payment flow.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-ink-soft">
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
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-ink-faint">{plan.name}</p>
                <div className="mt-3 flex items-end gap-2">
                  <div className="font-serif text-4xl text-ink">Rs. {plan.amountInr.toLocaleString('en-IN')}</div>
                </div>
                <p className="mt-2 text-sm font-medium text-bronze-deep">{plan.credits.toLocaleString('en-IN')} credits</p>
                <p className="mt-3 text-sm leading-6 text-ink-soft">{plan.description}</p>
                <ul className="mt-5 space-y-2 text-sm text-ink-soft">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-bronze-deep" />
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
              <p className="eyebrow">UPI checkout</p>
              <h2 className="mt-2 font-serif text-3xl text-ink">How payment works</h2>
            </div>

            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-2xl border border-[color:var(--color-border)] bg-paper/40 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-bronze/25 bg-bronze/10 font-serif text-base text-bronze-deep">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-ink-soft">{step}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[24px] border border-dashed border-[color:var(--color-border)] bg-paper-bright p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-bronze/25 bg-bronze/10 text-bronze-deep">
                  <QrCode className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-serif text-lg text-ink">UPI intent and approvals</p>
                  <p className="text-sm text-ink-soft">Open the payment request in your UPI app, then submit the reference number for review.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[color:var(--color-border)] bg-paper/40 p-4">
              <div className="flex items-center gap-2 font-serif text-base text-ink">
                <Smartphone className="h-4 w-4 text-bronze-deep" />
                Best for UPI payments made from a phone
              </div>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                This MVP uses direct UPI requests, so you can pay from any UPI app without a gateway account.
              </p>
            </div>
            <div className="rounded-[24px] border border-[color:var(--color-border)] bg-paper/40 p-4">
              <div className="flex items-center gap-2 font-serif text-base text-ink">
                <Banknote className="h-4 w-4 text-bronze-deep" />
                Credits are added after approval
              </div>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                Super admins can verify the transaction and top up company credits from the billing screen.
              </p>
            </div>

            <div className="rounded-[24px] border border-bronze/25 bg-bronze/8 p-4">
              <p className="font-serif text-base text-bronze-deep">Strict pricing rules</p>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-bronze-deep/90">
                <li>Plan prices are managed by the super admin from the billing screen.</li>
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
