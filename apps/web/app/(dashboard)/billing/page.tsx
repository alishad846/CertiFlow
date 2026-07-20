'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WalletCards,
  X,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  DashboardStats,
  PricingPlan,
  UpiPaymentRecord,
  UserRole,
} from '@certiflow/shared';

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

type MessageState = {
  type: 'success' | 'error' | 'info';
  text: string;
} | null;

function formatDate(dateValue: string | Date) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function PaymentStatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold capitalize text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Approved
      </span>
    );
  }

  if (normalizedStatus === 'submitted') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-bold capitalize text-amber-700">
        <Clock3 className="h-3.5 w-3.5" />
        Submitted
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold capitalize text-blue-700">
      <Smartphone className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}

export default function BillingPage() {
  const [user, setUser] =
    useState<MeResponse['user'] | null>(null);

  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [draftPlans, setDraftPlans] = useState<PricingPlan[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [payments, setPayments] = useState<UpiPaymentRecord[]>([]);

  const [selectedPlan, setSelectedPlan] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [transactionReference, setTransactionReference] =
    useState('');

  const [activePayment, setActivePayment] =
    useState<CreatePaymentResponse['payment'] | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);

  const [message, setMessage] = useState<MessageState>(null);
  const [pricingMessage, setPricingMessage] =
    useState<MessageState>(null);

  const reload = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    }

    try {
      const [me, plansData, statsData] = await Promise.all([
        apiFetch<MeResponse>('/auth/me'),
        apiFetch<{ plans: PricingPlan[] }>('/billing/plans'),
        apiFetch<DashboardStats>('/dashboard/stats'),
      ]);

      const paymentQuery =
        me.user.role === 'super_admin' && companyId
          ? `?companyId=${encodeURIComponent(companyId)}`
          : '';

      const paymentData = await apiFetch<PaymentResponse>(
        `/billing/upi${paymentQuery}`,
      );

      setUser(me.user);
      setPlans(plansData.plans);

      setDraftPlans(
        plansData.plans.map((plan) => ({
          ...plan,
          features: [...plan.features],
        })),
      );

      setStats(statsData);
      setPayments(paymentData.payments);

      setSelectedPlan(
        (current) =>
          current ||
          plansData.plans[1]?.key ||
          plansData.plans[0]?.key ||
          '',
      );

      setCustomerName((current) => current || me.user.name);
      setCustomerEmail((current) => current || me.user.email);

      if (me.user.role !== 'super_admin') {
        setCompanyId(me.user.companyId ?? '');
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    reload()
      .catch((error) => {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load billing information.',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const currentPlan =
    plans.find((plan) => plan.key === selectedPlan) ?? plans[0];

  const approvedPayments = payments.filter(
    (payment) => payment.status === 'approved',
  ).length;

  const pendingPayments = payments.filter(
    (payment) => payment.status !== 'approved',
  ).length;

  const handleCreatePayment = async () => {
    if (!currentPlan) {
      setMessage({
        type: 'error',
        text: 'Please select a pricing plan first.',
      });
      return;
    }

    if (!customerName.trim() || !customerEmail.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter your name and email address.',
      });
      return;
    }

    if (user?.role === 'super_admin' && !companyId.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter the company ID receiving the credits.',
      });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const result = await apiFetch<CreatePaymentResponse>(
        '/billing/upi',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            planKey: selectedPlan,
            companyId,
            customerName,
            customerEmail,
          }),
        },
      );

      setActivePayment(result.payment);
      setTransactionReference('');

      setMessage({
        type: 'success',
        text: 'UPI request created. Complete the payment and submit your transaction reference.',
      });

      await reload();

      const paymentData =
        await apiFetch<CreatePaymentResponse>(
          `/billing/upi/${result.payment.id}`,
        );

      setActivePayment(paymentData.payment);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to create payment request.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitReference = async (paymentId: string) => {
    if (!transactionReference.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter the transaction reference or UTR.',
      });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await apiFetch(`/billing/upi/${paymentId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionReference: transactionReference.trim(),
        }),
      });

      setTransactionReference('');

      setMessage({
        type: 'success',
        text: 'Reference submitted successfully. It is now waiting for approval.',
      });

      await reload();
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to submit transaction reference.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async (paymentId: string) => {
    setBusy(true);
    setMessage(null);

    try {
      await apiFetch(`/billing/upi/${paymentId}/approve`, {
        method: 'POST',
      });

      setMessage({
        type: 'success',
        text: 'Payment approved and credits added successfully.',
      });

      await reload();
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to approve the payment.',
      });
    } finally {
      setBusy(false);
    }
  };

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);

      setMessage({
        type: 'success',
        text: 'UPI link copied to your clipboard.',
      });
    } catch {
      setMessage({
        type: 'error',
        text: 'Unable to copy the link. Please copy it manually.',
      });
    }
  };

  const updateDraftPlan = (
    planKey: string,
    patch: Partial<PricingPlan>,
  ) => {
    setDraftPlans((current) =>
      current.map((plan) =>
        plan.key === planKey
          ? {
              ...plan,
              ...patch,
            }
          : plan,
      ),
    );
  };

  const resetPricing = () => {
    setDraftPlans(
      plans.map((plan) => ({
        ...plan,
        features: [...plan.features],
      })),
    );

    setPricingMessage({
      type: 'info',
      text: 'Unsaved pricing changes were reset.',
    });
  };

  const handleSavePricing = async () => {
    if (user?.role !== 'super_admin') {
      return;
    }

    setPricingSaving(true);
    setPricingMessage(null);

    try {
      const response = await apiFetch<{
        plans: PricingPlan[];
      }>('/billing/plans', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plans: draftPlans.map((plan) => ({
            ...plan,
            credits: Number(plan.credits),
            amountInr: Number(plan.amountInr),
            features: plan.features
              .join('\n')
              .split('\n')
              .map((feature) => feature.trim())
              .filter(Boolean),
          })),
        }),
      });

      setPlans(response.plans);

      setDraftPlans(
        response.plans.map((plan) => ({
          ...plan,
          features: [...plan.features],
        })),
      );

      setPricingMessage({
        type: 'success',
        text: 'Pricing plans updated successfully.',
      });
    } catch (error) {
      setPricingMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to save pricing.',
      });
    } finally {
      setPricingSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-72 animate-pulse rounded-[32px] bg-slate-200/70" />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-40 animate-pulse rounded-[26px] bg-white"
            />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr,0.75fr]">
          <div className="h-96 animate-pulse rounded-[30px] bg-white" />
          <div className="h-96 animate-pulse rounded-[30px] bg-white" />
        </div>
      </div>
    );
  }

  if (!user || !stats) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[30px] border border-red-100 bg-white p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle className="h-8 w-8" />
          </div>

          <h2 className="mt-5 text-2xl font-bold text-slate-950">
            Billing information is unavailable
          </h2>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Refresh the page or try again in a few moments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0f172a] via-[#122b51] to-[#075985] p-6 text-white shadow-[0_28px_75px_rgba(15,23,42,0.18)] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 left-1/3 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />

        <div className="pointer-events-none absolute right-12 top-8 hidden h-40 w-56 rotate-3 rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur xl:block">
          <WalletCards className="h-8 w-8 text-cyan-300" />
          <div className="mt-5 h-2 w-24 rounded-full bg-white/20" />
          <div className="mt-3 h-2 w-36 rounded-full bg-white/10" />
          <div className="mt-5 h-8 rounded-xl bg-emerald-400/15" />
        </div>

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.15em] text-cyan-100 backdrop-blur">
              <WalletCards className="h-4 w-4 text-cyan-300" />
              Billing and credits
            </div>

            <h1 className="mt-6 max-w-3xl text-3xl font-bold leading-[1.08] tracking-[-0.04em] sm:text-4xl lg:text-5xl">
              Simple credit top-ups,
              <span className="text-cyan-300">
                {' '}
                clearly tracked.
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Choose the right credit pack, pay securely through UPI,
              and follow every approval from one friendly workspace.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                <Smartphone className="h-3.5 w-3.5 text-cyan-300" />
                Direct UPI
              </span>

              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                Secure manual approval
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {user.role === 'super_admin' && (
              <Link
                href="/discounts"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-5 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
              >
                Manage discounts
              </Link>
            )}

            <button
              type="button"
              onClick={() => reload(true)}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-bold text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-50 disabled:opacity-70"
            >
              <RefreshCw
                className={`h-4 w-4 text-blue-600 ${
                  refreshing ? 'animate-spin' : ''
                }`}
              />

              {refreshing ? 'Refreshing...' : 'Refresh billing'}
            </button>
          </div>
        </div>
      </section>

      {/* Statistics */}
      <section>
        <div className="mb-4 px-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            Account overview
          </p>

          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            Your billing activity at a glance
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="relative overflow-hidden rounded-[26px] border border-white bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.07)]">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-200/40 blur-3xl" />

            <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <WalletCards className="h-5 w-5" />
            </span>

            <p className="relative mt-5 text-sm font-semibold text-slate-500">
              Available credits
            </p>

            <p className="relative mt-2 text-4xl font-bold tracking-[-0.05em] text-slate-950">
              {stats.remainingCredits.toLocaleString('en-IN')}
            </p>

            <p className="relative mt-2 text-xs text-slate-500">
              Ready for document delivery
            </p>
          </article>

          <article className="relative overflow-hidden rounded-[26px] border border-white bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.07)]">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-200/40 blur-3xl" />

            <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
              <Sparkles className="h-5 w-5" />
            </span>

            <p className="relative mt-5 text-sm font-semibold text-slate-500">
              Total batches
            </p>

            <p className="relative mt-2 text-4xl font-bold tracking-[-0.05em] text-slate-950">
              {stats.totalBatches.toLocaleString('en-IN')}
            </p>

            <p className="relative mt-2 text-xs text-slate-500">
              Created from uploaded data
            </p>
          </article>

          <article className="relative overflow-hidden rounded-[26px] border border-white bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.07)]">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-200/40 blur-3xl" />

            <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Send className="h-5 w-5" />
            </span>

            <p className="relative mt-5 text-sm font-semibold text-slate-500">
              Emails delivered
            </p>

            <p className="relative mt-2 text-4xl font-bold tracking-[-0.05em] text-slate-950">
              {stats.emailsSent.toLocaleString('en-IN')}
            </p>

            <p className="relative mt-2 text-xs text-slate-500">
              Successful document deliveries
            </p>
          </article>

          <article className="relative overflow-hidden rounded-[26px] border border-white bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.07)]">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-200/40 blur-3xl" />

            <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <Clock3 className="h-5 w-5" />
            </span>

            <p className="relative mt-5 text-sm font-semibold text-slate-500">
              Pending emails
            </p>

            <p className="relative mt-2 text-4xl font-bold tracking-[-0.05em] text-slate-950">
              {stats.pendingEmails.toLocaleString('en-IN')}
            </p>

            <p className="relative mt-2 text-xs text-slate-500">
              Processing or waiting to send
            </p>
          </article>
        </div>
      </section>

      {/* Message */}
      {message && (
        <div
          className={`flex items-start gap-3 rounded-[22px] border px-4 py-4 shadow-sm ${
            message.type === 'error'
              ? 'border-red-100 bg-red-50 text-red-800'
              : message.type === 'success'
                ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                : 'border-blue-100 bg-blue-50 text-blue-800'
          }`}
        >
          {message.type === 'error' ? (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          )}

          <p className="flex-1 text-sm font-medium leading-6">
            {message.text}
          </p>

          <button
            type="button"
            onClick={() => setMessage(null)}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/5"
            aria-label="Dismiss message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.25fr,0.75fr] xl:items-start">
        {/* Plans and checkout */}
        <section className="overflow-hidden rounded-[30px] border border-white/90 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              Credit packs
            </p>

            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
              Choose a plan that fits your needs
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Each document recipient uses one credit.
            </p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => {
              const selected = selectedPlan === plan.key;

              return (
                <button
                  key={plan.key}
                  type="button"
                  onClick={() => setSelectedPlan(plan.key)}
                  className={`relative overflow-hidden rounded-[26px] border p-5 text-left transition duration-300 hover:-translate-y-1 ${
                    selected
                      ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-[0_18px_45px_rgba(37,99,235,0.14)]'
                      : 'border-slate-200 bg-white hover:border-blue-200'
                  }`}
                >
                  {plan.recommended && (
                    <span className="absolute right-3 top-3 rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                      Best value
                    </span>
                  )}

                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                      selected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <WalletCards className="h-5 w-5" />
                  </span>

                  <p className="mt-5 text-sm font-bold text-slate-600">
                    {plan.name}
                  </p>

                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                    Rs. {plan.amountInr.toLocaleString('en-IN')}
                  </p>

                  <p className="mt-2 text-sm font-bold text-blue-700">
                    {plan.credits.toLocaleString('en-IN')} credits
                  </p>

                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {plan.description}
                  </p>

                  <div
                    className={`mt-5 flex items-center gap-2 text-xs font-bold ${
                      selected ? 'text-blue-700' : 'text-slate-400'
                    }`}
                  >
                    <span
                      className={`h-3 w-3 rounded-full border ${
                        selected
                          ? 'border-blue-600 bg-blue-600 ring-4 ring-blue-100'
                          : 'border-slate-300'
                      }`}
                    />

                    {selected ? 'Selected plan' : 'Select this plan'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Customer details */}
          <div className="mt-8 rounded-[26px] border border-slate-100 bg-slate-50/80 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
                <Mail className="h-5 w-5" />
              </span>

              <div>
                <p className="text-sm font-bold text-slate-950">
                  Payment details
                </p>

                <p className="text-xs text-slate-500">
                  Confirm who is making this payment
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Your name
                </label>

                <Input
                  value={customerName}
                  onChange={(event) =>
                    setCustomerName(event.target.value)
                  }
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Email address
                </label>

                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(event) =>
                    setCustomerEmail(event.target.value)
                  }
                  placeholder="you@company.com"
                />
              </div>
            </div>

            {user.role === 'super_admin' && (
              <div className="mt-4">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Company ID receiving credits
                </label>

                <Input
                  value={companyId}
                  onChange={(event) =>
                    setCompanyId(event.target.value)
                  }
                  placeholder="Target company UUID"
                />
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={handleCreatePayment}
              disabled={busy || !currentPlan}
              className="sm:min-w-[200px]"
            >
              {busy ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Smartphone className="mr-2 h-4 w-4" />
              )}

              {busy ? 'Please wait...' : 'Create UPI request'}
            </Button>

            <Button asChild variant="secondary">
              <Link href="/pricing">View public pricing</Link>
            </Button>
          </div>

          {/* Active UPI request */}
          {activePayment && (
            <div className="mt-7 overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-emerald-50">
              <div className="border-b border-blue-100/70 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                      Active payment request
                    </p>

                    <h3 className="mt-2 text-2xl font-bold text-slate-950">
                      {activePayment.planName}
                    </h3>

                    <p className="mt-2 text-sm text-slate-600">
                      Pay{' '}
                      <strong>
                        Rs.{' '}
                        {Number(
                          activePayment.amountInr,
                        ).toLocaleString('en-IN')}
                      </strong>{' '}
                      for{' '}
                      <strong>
                        {activePayment.credits.toLocaleString('en-IN')}{' '}
                        credits
                      </strong>
                      .
                    </p>

                    {activePayment.discountPercent > 0 && (
                      <p className="mt-2 text-sm font-semibold text-emerald-700">
                        {activePayment.discountPercent}% discount applied
                      </p>
                    )}
                  </div>

                  <PaymentStatusBadge
                    status={activePayment.status}
                  />
                </div>
              </div>

              <div className="p-5">
                <div className="rounded-[20px] border border-white bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Secure UPI payment link
                  </p>

                  <p className="mt-3 break-all rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    {activePayment.upiLink}
                  </p>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        copyToClipboard(activePayment.upiLink)
                      }
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy link
                    </Button>

                    <Button asChild>
                      <a href={activePayment.upiLink}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open UPI app
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="mt-5">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Transaction reference / UTR
                  </label>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      value={transactionReference}
                      onChange={(event) =>
                        setTransactionReference(event.target.value)
                      }
                      placeholder="Enter UTR after completing payment"
                    />

                    <Button
                      type="button"
                      onClick={() =>
                        handleSubmitReference(activePayment.id)
                      }
                      disabled={busy}
                      className="shrink-0"
                    >
                      Submit reference
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-2 rounded-2xl bg-white/80 p-3 text-xs leading-5 text-slate-600">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  Once submitted, an administrator will verify the payment
                  and add the credits to the company account.
                </div>
              </div>
            </div>
          )}

          {/* Super-admin pricing editor */}
          {user.role === 'super_admin' && (
            <div className="mt-8 rounded-[28px] border border-amber-200 bg-amber-50/60 p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
                    Pricing administration
                  </p>

                  <h3 className="mt-2 text-2xl font-bold text-slate-950">
                    Edit live credit packages
                  </h3>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Changes made here affect the public pricing page and
                    future UPI requests.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetPricing}
                  >
                    Reset
                  </Button>

                  <Button
                    type="button"
                    onClick={handleSavePricing}
                    disabled={pricingSaving}
                  >
                    {pricingSaving
                      ? 'Saving...'
                      : 'Save pricing'}
                  </Button>
                </div>
              </div>

              {pricingMessage && (
                <div
                  className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                    pricingMessage.type === 'error'
                      ? 'border-red-100 bg-red-50 text-red-700'
                      : 'border-emerald-100 bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {pricingMessage.text}
                </div>
              )}

              <div className="mt-6 grid gap-4 xl:grid-cols-3">
                {draftPlans.map((plan) => (
                  <div
                    key={plan.key}
                    className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {plan.key}
                      </span>

                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <input
                          type="checkbox"
                          checked={Boolean(plan.recommended)}
                          onChange={(event) =>
                            updateDraftPlan(plan.key, {
                              recommended: event.target.checked,
                            })
                          }
                        />
                        Recommended
                      </label>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                          Plan name
                        </label>

                        <Input
                          value={plan.name}
                          onChange={(event) =>
                            updateDraftPlan(plan.key, {
                              name: event.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-700">
                            Amount
                          </label>

                          <Input
                            type="number"
                            min="0"
                            value={plan.amountInr}
                            onChange={(event) =>
                              updateDraftPlan(plan.key, {
                                amountInr: Number(event.target.value),
                              })
                            }
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-700">
                            Credits
                          </label>

                          <Input
                            type="number"
                            min="1"
                            value={plan.credits}
                            onChange={(event) =>
                              updateDraftPlan(plan.key, {
                                credits: Number(event.target.value),
                              })
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                          Description
                        </label>

                        <textarea
                          rows={3}
                          value={plan.description}
                          onChange={(event) =>
                            updateDraftPlan(plan.key, {
                              description: event.target.value,
                            })
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                          Features, one per line
                        </label>

                        <textarea
                          rows={4}
                          value={plan.features.join('\n')}
                          onChange={(event) =>
                            updateDraftPlan(plan.key, {
                              features: event.target.value.split('\n'),
                            })
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Payment history */}
        <aside className="overflow-hidden rounded-[30px] border border-white/90 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                  Payment history
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  Track approvals
                </h2>
              </div>

              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                {payments.length} records
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3">
                <p className="text-xs font-semibold text-emerald-700">
                  Approved
                </p>

                <p className="mt-1 text-xl font-bold text-slate-950">
                  {approvedPayments}
                </p>
              </div>

              <div className="rounded-2xl bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-700">
                  Waiting
                </p>

                <p className="mt-1 text-xl font-bold text-slate-950">
                  {pendingPayments}
                </p>
              </div>
            </div>
          </div>

          <div className="max-h-[720px] space-y-3 overflow-y-auto p-4 sm:p-5">
            {payments.length === 0 ? (
              <div className="py-12 text-center">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-blue-50 text-blue-700">
                  <WalletCards className="h-7 w-7" />
                </span>

                <h3 className="mt-5 text-lg font-bold text-slate-950">
                  No payment requests yet
                </h3>

                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  Choose a credit plan and create a UPI request to see
                  your payment history here.
                </p>
              </div>
            ) : (
              payments.map((payment) => (
                <article
                  key={payment.id}
                  className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm transition hover:border-blue-100 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-950">
                        {payment.planName}
                      </p>

                      <p className="mt-1 truncate text-xs text-slate-500">
                        {payment.companyName}
                      </p>
                    </div>

                    <PaymentStatusBadge status={payment.status} />
                  </div>

                  <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                    <p className="text-lg font-bold text-slate-950">
                      Rs.{' '}
                      {Number(payment.amountInr).toLocaleString(
                        'en-IN',
                      )}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-blue-700">
                      {payment.credits.toLocaleString('en-IN')} credits
                    </p>
                  </div>

                  <div className="mt-4 space-y-2.5 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">
                        Base amount
                      </span>

                      <span className="font-semibold text-slate-800">
                        Rs.{' '}
                        {Number(
                          payment.baseAmountInr,
                        ).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Discount</span>

                      <span className="font-semibold text-emerald-700">
                        {payment.discountPercent}% off
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Reference</span>

                      <span className="max-w-[180px] truncate font-semibold text-slate-800">
                        {payment.transactionReference || 'Not submitted'}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Created</span>

                      <span className="text-right font-semibold text-slate-800">
                        {formatDate(payment.createdAt)}
                      </span>
                    </div>
                  </div>

                  {user.role === 'super_admin' &&
                    payment.status !== 'approved' && (
                      <Button
                        type="button"
                        className="mt-4 w-full"
                        onClick={() => handleApprove(payment.id)}
                        disabled={busy}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Approve and add credits
                      </Button>
                    )}
                </article>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}