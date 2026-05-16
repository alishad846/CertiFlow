'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import type { DashboardStats, PricingPlan, UpiPaymentRecord, UserRole } from '@certiflow/shared';

type MeResponse = {
  user: {
    id: string;
    companyId: string | null;
    role: UserRole;
    email: string;
    name: string;
  };
};

type PaymentResponse = {
  payments: UpiPaymentRecord[];
};

type CreatePaymentResponse = {
  payment: UpiPaymentRecord & {
    upiLink: string;
    payeeVpa: string;
    payeeName: string;
    currency: string;
  };
};

export default function BillingPage() {
  const [user, setUser] = useState<MeResponse['user'] | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [draftPlans, setDraftPlans] = useState<PricingPlan[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [payments, setPayments] = useState<UpiPaymentRecord[]>([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [activePayment, setActivePayment] = useState<CreatePaymentResponse['payment'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [pricingMessage, setPricingMessage] = useState('');

  const reload = async () => {
    const [me, plansData, statsData] = await Promise.all([
      apiFetch<MeResponse>('/auth/me'),
      apiFetch<{ plans: PricingPlan[] }>('/billing/plans'),
      apiFetch<DashboardStats>('/dashboard/stats')
    ]);

    const paymentQuery = me.user.role === 'super_admin' && companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    const paymentData = await apiFetch<PaymentResponse>(`/billing/upi${paymentQuery}`);

    setUser(me.user);
    setPlans(plansData.plans);
    setDraftPlans(plansData.plans.map((plan) => ({ ...plan, features: [...plan.features] })));
    setStats(statsData);
    setPayments(paymentData.payments);
    setSelectedPlan((current) => current || plansData.plans[1]?.key || plansData.plans[0]?.key || '');
    setCustomerName((current) => current || me.user.name);
    setCustomerEmail((current) => current || me.user.email);
    if (me.user.role !== 'super_admin') {
      setCompanyId(me.user.companyId ?? '');
    }
  };

  useEffect(() => {
    reload()
      .catch((err) => {
        setMessage(err instanceof Error ? err.message : 'Failed to load billing');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreatePayment = async () => {
    if (!currentPlan) {
      setMessage('Please select a pricing plan first.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const result = await apiFetch<CreatePaymentResponse>('/billing/upi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planKey: selectedPlan,
          companyId,
          customerName,
          customerEmail
        })
      });
      setActivePayment(result.payment);
      setTransactionReference('');
      setMessage('UPI payment request created. Pay using the link below, then submit your reference.');
      await reload();
      const paymentData = await apiFetch<CreatePaymentResponse>(`/billing/upi/${result.payment.id}`);
      setActivePayment(paymentData.payment);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create payment request');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitReference = async (paymentId: string) => {
    if (!transactionReference.trim()) {
      setMessage('Please enter a transaction reference first.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await apiFetch(`/billing/upi/${paymentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionReference })
      });
      setTransactionReference('');
      setMessage('Reference submitted. A super admin can now approve the top-up.');
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to submit reference');
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async (paymentId: string) => {
    setBusy(true);
    setMessage('');
    try {
      await apiFetch(`/billing/upi/${paymentId}/approve`, {
        method: 'POST'
      });
      setMessage('Payment approved and credits added to the company.');
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to approve payment');
    } finally {
      setBusy(false);
    }
  };

  const copyToClipboard = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setMessage('Copied to clipboard.');
  };

  const updateDraftPlan = (planKey: string, patch: Partial<PricingPlan>) => {
    setDraftPlans((current) =>
      current.map((plan) =>
        plan.key === planKey
          ? {
              ...plan,
              ...patch
            }
          : plan
      )
    );
  };

  const handleSavePricing = async () => {
    if (user?.role !== 'super_admin') {
      return;
    }
    setPricingSaving(true);
    setPricingMessage('');
    try {
      const response = await apiFetch<{ plans: PricingPlan[] }>('/billing/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plans: draftPlans.map((plan) => ({
            ...plan,
            credits: Number(plan.credits),
            amountInr: Number(plan.amountInr),
            features: plan.features
              .join('\n')
              .split('\n')
              .map((feature) => feature.trim())
              .filter(Boolean)
          }))
        })
      });

      setPlans(response.plans);
      setDraftPlans(response.plans.map((plan) => ({ ...plan, features: [...plan.features] })));
      setPricingMessage('Pricing updated successfully.');
    } catch (error) {
      setPricingMessage(error instanceof Error ? error.message : 'Failed to save pricing');
    } finally {
      setPricingSaving(false);
    }
  };

  if (loading) {
    return <Card>Loading billing...</Card>;
  }

  if (!user || !stats) {
    return <Card>Unable to load billing data.</Card>;
  }

  const currentPlan = plans.find((plan) => plan.key === selectedPlan) ?? plans[0];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.03),rgba(42,141,240,0.05))]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Billing</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink md:text-4xl">
              Buy credits with UPI and track payment requests.
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Pick a plan, create a UPI payment link, submit your reference, and let the super admin approve the credits.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">
              <span className="inline-flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Direct UPI
              </span>
            </Badge>
            <Badge tone="green">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Manual approval
              </span>
            </Badge>
            {user.role === 'super_admin' ? (
              <Button asChild variant="secondary">
                <Link href="/discounts">Manage discounts</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Remaining credits" value={stats.remainingCredits} hint="Credits available right now" />
        <StatCard label="Total batches" value={stats.totalBatches} hint="Created from uploaded data" />
        <StatCard label="Emails sent" value={stats.emailsSent} hint="Successful deliveries" />
        <StatCard label="Pending emails" value={stats.pendingEmails} hint="Still processing or sending" />
      </div>

      {message ? <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{message}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr,0.9fr] xl:items-start">
        <Card className="border-white/80">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">Pricing plans</p>
              <h3 className="mt-1 text-2xl font-bold tracking-tight text-ink">Select a credit pack</h3>
            </div>
            <Button variant="secondary" onClick={reload} type="button">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <button
                key={plan.key}
                type="button"
                onClick={() => setSelectedPlan(plan.key)}
                className={`rounded-[24px] border p-5 text-left transition ${
                  selectedPlan === plan.key ? 'border-accent-400 bg-accent-50 shadow-[0_16px_40px_rgba(42,141,240,0.12)]' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">{plan.name}</p>
                    <div className="mt-2 text-2xl font-bold tracking-tight">Rs. {plan.amountInr.toLocaleString('en-IN')}</div>
                  </div>
                  {plan.recommended ? <Badge tone="blue">Best value</Badge> : null}
                </div>
                <p className="mt-2 text-sm font-semibold text-accent-700">{plan.credits.toLocaleString('en-IN')} credits</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{plan.description}</p>
              </button>
            ))}
          </div>

          {user.role === 'super_admin' ? (
            <div className="mt-8 rounded-[28px] border border-amber-200 bg-amber-50/70 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-900/70">Pricing admin</p>
                  <h4 className="mt-1 text-2xl font-bold tracking-tight text-ink">Change credit pack pricing</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Edit the live plan amounts, credits, and features used on the public pricing page and in UPI checkout.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => setDraftPlans(plans.map((plan) => ({ ...plan, features: [...plan.features] })))}>
                    Reset changes
                  </Button>
                  <Button type="button" onClick={() => void handleSavePricing()} disabled={pricingSaving}>
                    {pricingSaving ? 'Saving pricing...' : 'Save pricing'}
                  </Button>
                </div>
              </div>

              {pricingMessage ? <p className="mt-4 rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm text-slate-700">{pricingMessage}</p> : null}

              <div className="mt-5 grid gap-4 xl:grid-cols-3">
                {draftPlans.map((plan) => (
                  <div key={plan.key} className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{plan.key}</p>
                        <label className="mt-2 block text-sm font-medium text-slate-700">Plan name</label>
                        <Input value={plan.name} onChange={(event) => updateDraftPlan(plan.key, { name: event.target.value })} className="mt-2" />
                      </div>
                      <label className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                        <input
                          type="checkbox"
                          checked={Boolean(plan.recommended)}
                          onChange={(event) => updateDraftPlan(plan.key, { recommended: event.target.checked })}
                        />
                        Recommended
                      </label>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Amount INR</label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={plan.amountInr}
                          onChange={(event) => updateDraftPlan(plan.key, { amountInr: Number(event.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Credits</label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={plan.credits}
                          onChange={(event) => updateDraftPlan(plan.key, { credits: Number(event.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
                        <textarea
                          value={plan.description}
                          onChange={(event) => updateDraftPlan(plan.key, { description: event.target.value })}
                          rows={3}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-accent-400 focus:ring-4 focus:ring-accent-100"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Features, one per line</label>
                        <textarea
                          value={plan.features.join('\n')}
                          onChange={(event) =>
                            updateDraftPlan(plan.key, {
                              features: event.target.value
                                .split('\n')
                                .map((feature) => feature.trim())
                                .filter(Boolean)
                            })
                          }
                          rows={4}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-accent-400 focus:ring-4 focus:ring-accent-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Your name</label>
              <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Shad Ali" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Your email</label>
              <Input value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="you@company.com" />
            </div>
          </div>

          {user.role === 'super_admin' ? (
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">Company ID</label>
              <Input value={companyId} onChange={(event) => setCompanyId(event.target.value)} placeholder="Target company UUID" />
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button type="button" onClick={handleCreatePayment} disabled={busy || !currentPlan}>
              Create UPI request
            </Button>
            <Button asChild variant="secondary">
              <a href="/pricing">View public pricing</a>
            </Button>
          </div>

          {activePayment ? (
            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Active payment request</p>
                    <h4 className="mt-1 text-xl font-bold text-ink">{activePayment.planName}</h4>
                    <p className="mt-2 text-sm text-slate-600">
                      Pay <span className="font-semibold">Rs. {Number(activePayment.amountInr).toLocaleString('en-IN')}</span> for{' '}
                      <span className="font-semibold">{activePayment.credits.toLocaleString('en-IN')} credits</span>.
                    </p>
                    {activePayment.discountPercent > 0 ? (
                      <p className="mt-2 text-sm text-accent-700">
                        Includes {activePayment.discountPercent}% discount on a base amount of Rs.{' '}
                        {Number(activePayment.baseAmountInr).toLocaleString('en-IN')}.
                      </p>
                    ) : null}
                  </div>
                  <Badge tone="amber">{activePayment.status}</Badge>
                </div>

              <div className="mt-4 rounded-[20px] bg-white p-4">
                <p className="text-sm font-semibold text-slate-500">UPI link</p>
                <p className="mt-2 break-all rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-700">{activePayment.upiLink}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => copyToClipboard(activePayment.upiLink)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy link
                  </Button>
                  <Button asChild>
                    <a href={activePayment.upiLink}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open in UPI app
                    </a>
                  </Button>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">Transaction reference / UTR</label>
                <div className="flex flex-col gap-3 md:flex-row">
                  <Input
                    value={transactionReference}
                    onChange={(event) => setTransactionReference(event.target.value)}
                    placeholder="Enter UTR after payment"
                  />
                  <Button type="button" onClick={() => handleSubmitReference(activePayment.id)} disabled={busy}>
                    Submit reference
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                <CheckCircle2 className="h-4 w-4 text-accent-700" />
                Once submitted, a super admin can approve and the credits will be added to the company account.
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="self-start border-white/80">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">Payment requests</p>
              <h3 className="mt-1 text-2xl font-bold tracking-tight text-ink">Track approvals</h3>
            </div>
            <Badge tone="blue">{payments.length} records</Badge>
          </div>

          <div className="mt-6 space-y-3">
            {payments.length === 0 ? (
              <div className="rounded-[24px] bg-slate-50 p-5 text-sm text-slate-600">
                No UPI requests yet. Create one to see it here.
              </div>
            ) : (
              payments.map((payment) => (
                <div key={payment.id} className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{payment.planName}</p>
                      <p className="mt-1 text-sm text-slate-500">{payment.companyName}</p>
                      <p className="mt-2 text-sm text-slate-600">
                        Rs. {Number(payment.amountInr).toLocaleString('en-IN')} for {payment.credits.toLocaleString('en-IN')} credits
                      </p>
                    </div>
                    <Badge tone={payment.status === 'approved' ? 'green' : payment.status === 'submitted' ? 'amber' : 'blue'}>
                      {payment.status}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-slate-500">
                    <div className="flex items-center justify-between gap-3">
                      <span>Base amount</span>
                      <span className="font-medium text-ink">Rs. {Number(payment.baseAmountInr).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Discount</span>
                      <span className="font-medium text-ink">
                        {payment.discountPercent}% off
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Reference</span>
                      <span className="font-medium text-ink">{payment.transactionReference || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Created</span>
                      <span className="font-medium text-ink">{new Date(payment.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {user.role === 'super_admin' && payment.status !== 'approved' ? (
                    <div className="mt-4">
                      <Button type="button" className="w-full" onClick={() => handleApprove(payment.id)} disabled={busy}>
                        Approve and add credits
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
