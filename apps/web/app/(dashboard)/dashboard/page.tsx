'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Coins,
  FileCheck2,
  FileUp,
  MailCheck,
  Palette,
  RefreshCw,
  ScrollText,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UploadCloud,
  Users,
  WalletCards,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
  CompanySummary,
  DashboardStats,
  UserRole,
} from '@certiflow/shared';

type MeResponse = {
  user: {
    id: string;
    companyId: string | null;
    role: UserRole;
    email: string;
    name: string;
    permissions?: {
      canCreateBatches: boolean;
      canRequestUpi: boolean;
      canViewReports: boolean;
    };
    companyStatus?: 'active' | 'blocked' | null;
  };
};

type StatItem = {
  label: string;
  value: number;
  hint: string;
  icon: React.ElementType;
  iconStyle: string;
  decoration: string;
};

type ActionCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
  icon: React.ElementType;
  iconStyle: string;
  accentStyle: string;
  disabled?: boolean;
  disabledMessage?: string;
};

function ActionCard({
  eyebrow,
  title,
  description,
  href,
  buttonLabel,
  icon: Icon,
  iconStyle,
  accentStyle,
  disabled = false,
  disabledMessage,
}: ActionCardProps) {
  return (
    <article className="group relative flex min-h-[270px] flex-col overflow-hidden rounded-[28px] border border-white/90 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.11)]">
      <div
        className={`pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-3xl transition duration-300 group-hover:scale-125 ${accentStyle}`}
      />

      <div className="relative flex items-start justify-between">
        <div
          className={`flex h-13 w-13 h-[52px] items-center justify-center rounded-2xl shadow-sm transition duration-300 group-hover:scale-105 ${iconStyle}`}
        >
          <Icon className="h-6 w-6" />
        </div>

        <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
          {eyebrow}
        </span>
      </div>

      <div className="relative mt-6 flex-1">
        <h3 className="text-2xl font-bold tracking-[-0.025em] text-slate-950">
          {title}
        </h3>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>

      <div className="relative mt-6">
        {disabled ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-700">
            {disabledMessage || 'This feature is currently unavailable'}
          </div>
        ) : (
          <Link
            href={href}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <span>{buttonLabel}</span>

            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 transition group-hover:bg-blue-600 group-hover:text-white">
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        )}
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const [user, setUser] = useState<MeResponse['user'] | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');

    try {
      const meData = await apiFetch<MeResponse>('/auth/me');
      const statsData =
        await apiFetch<DashboardStats>('/dashboard/stats');

      let companyData: { companies: CompanySummary[] } | null = null;

      if (meData.user.role === 'super_admin') {
        companyData = await apiFetch<{
          companies: CompanySummary[];
        }>('/companies');
      }

      setUser(meData.user);
      setStats(statsData);
      setCompanies(companyData?.companies ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'We could not load your dashboard.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="overflow-hidden rounded-[30px] border border-white bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="animate-pulse">
            <div className="h-5 w-36 rounded-full bg-slate-200" />
            <div className="mt-5 h-9 max-w-2xl rounded-xl bg-slate-200" />
            <div className="mt-3 h-5 max-w-xl rounded-lg bg-slate-100" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-44 animate-pulse rounded-[26px] border border-white bg-white shadow-sm"
            />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-64 animate-pulse rounded-[28px] border border-white bg-white shadow-sm"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats || !user) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[30px] border border-red-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle className="h-8 w-8" />
          </div>

          <h2 className="mt-5 text-2xl font-bold text-slate-950">
            We couldn’t load your dashboard
          </h2>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {error ||
              'Dashboard information is not available at the moment.'}
          </p>

          <Button
            type="button"
            onClick={loadDashboard}
            className="mt-6"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const isSuperAdmin = user.role === 'super_admin';

  const canCreateBatches =
    !isSuperAdmin &&
    user.permissions?.canCreateBatches !== false;

  const canViewReports =
    !isSuperAdmin &&
    user.permissions?.canViewReports !== false;

  const activeCompanies = companies.filter(
    (company) => company.status === 'active',
  ).length;

  const blockedCompanies = companies.filter(
    (company) => company.status === 'blocked',
  ).length;

  const successfulDeliveries = stats.emailsSent;
  const attemptedDeliveries =
    stats.emailsSent + stats.failedEmails;

  const successRate =
    attemptedDeliveries > 0
      ? Math.round(
          (successfulDeliveries / attemptedDeliveries) * 100,
        )
      : 100;

  const statItems: StatItem[] = [
    {
      label: isSuperAdmin
        ? 'Generated across platform'
        : 'Documents generated',
      value: stats.totalGeneratedDocuments,
      hint: isSuperAdmin
        ? 'Documents from all companies'
        : 'Created from your uploaded data',
      icon: FileCheck2,
      iconStyle: 'bg-blue-50 text-blue-700',
      decoration: 'bg-blue-300/30',
    },
    {
      label: isSuperAdmin
        ? 'Credits across companies'
        : 'Credits available',
      value: stats.remainingCredits,
      hint: isSuperAdmin
        ? 'Managed at company level'
        : 'One credit per recipient',
      icon: Coins,
      iconStyle: 'bg-amber-50 text-amber-700',
      decoration: 'bg-amber-300/30',
    },
    {
      label: 'Emails delivered',
      value: stats.emailsSent,
      hint: `${successRate}% successful delivery rate`,
      icon: Send,
      iconStyle: 'bg-emerald-50 text-emerald-700',
      decoration: 'bg-emerald-300/30',
    },
    {
      label: 'Needs attention',
      value: stats.failedEmails,
      hint:
        stats.failedEmails === 0
          ? 'Everything looks good'
          : 'Failed emails are retried first',
      icon:
        stats.failedEmails === 0
          ? CheckCircle2
          : AlertCircle,
      iconStyle:
        stats.failedEmails === 0
          ? 'bg-cyan-50 text-cyan-700'
          : 'bg-red-50 text-red-600',
      decoration:
        stats.failedEmails === 0
          ? 'bg-cyan-300/30'
          : 'bg-red-300/30',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Workspace introduction */}
      <section className="relative overflow-hidden rounded-[30px] border border-white/90 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)] sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 right-1/3 h-60 w-60 rounded-full bg-emerald-100/50 blur-3xl" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
                {isSuperAdmin
                  ? 'Platform control centre'
                  : 'Your operations workspace'}
              </p>

              <Badge tone={isSuperAdmin ? 'blue' : 'green'}>
                {isSuperAdmin ? 'Super Admin' : 'Company Admin'}
              </Badge>
            </div>

            <h2 className="mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-[-0.035em] text-slate-950 md:text-4xl">
              {isSuperAdmin
                ? 'Keep every company, payment, and permission under control.'
                : 'Everything you need to create and deliver documents.'}
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              {isSuperAdmin
                ? 'See important platform activity here, then move into the dedicated areas when you need more detail.'
                : 'Follow a simple workflow: upload recipient data, choose a template, and track every delivery.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700">
              <TrendingUp className="h-3.5 w-3.5" />
              {isSuperAdmin
                ? 'Platform overview'
                : 'Batch size: 50'}
            </span>

            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Automatic retry
            </span>
          </div>
        </div>
      </section>

      {/* Statistics */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-4 px-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              Live overview
            </p>

            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
              Your activity at a glance
            </h2>
          </div>

          <span className="hidden items-center gap-2 text-xs font-medium text-slate-500 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" />
            Updated automatically
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statItems.map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.label}
                className="group relative overflow-hidden rounded-[26px] border border-white/90 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.065)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(15,23,42,0.1)]"
              >
                <div
                  className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl transition duration-300 group-hover:scale-125 ${item.decoration}`}
                />

                <div className="relative flex items-start justify-between gap-4">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.iconStyle}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Live
                  </span>
                </div>

                <div className="relative mt-6">
                  <p className="text-sm font-semibold text-slate-500">
                    {item.label}
                  </p>

                  <p className="mt-2 text-4xl font-bold tracking-[-0.05em] text-slate-950">
                    {item.value.toLocaleString()}
                  </p>

                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {item.hint}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {isSuperAdmin ? (
        <>
          {/* Super-admin platform summary */}
          <section className="grid gap-4 md:grid-cols-3">
            <ActionCard
              eyebrow="Companies"
              title={`${companies.length} companies`}
              description={`${activeCompanies} active companies and ${blockedCompanies} blocked companies currently exist on the platform.`}
              href="/companies"
              buttonLabel="Open company control"
              icon={Building2}
              iconStyle="bg-slate-900 text-white"
              accentStyle="bg-blue-300/35"
            />

            <ActionCard
              eyebrow="Billing"
              title="Top-ups and approvals"
              description="Review company payment requests, approve credit top-ups, and keep balances up to date."
              href="/billing"
              buttonLabel="Review billing queue"
              icon={WalletCards}
              iconStyle="bg-blue-50 text-blue-700"
              accentStyle="bg-cyan-300/35"
            />

            <ActionCard
              eyebrow="Platform"
              title="Offers and access"
              description="Manage discounts and provide companies with clear, controlled access to the platform."
              href="/discounts"
              buttonLabel="Manage discounts"
              icon={ShieldCheck}
              iconStyle="bg-emerald-50 text-emerald-700"
              accentStyle="bg-emerald-300/35"
            />
          </section>

          <section className="overflow-hidden rounded-[30px] bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-[0_24px_65px_rgba(15,23,42,0.16)] sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
                  <Users className="h-4 w-4" />
                  Platform health
                </div>

                <h2 className="mt-3 text-2xl font-bold tracking-tight">
                  {activeCompanies} active companies are using CertiFlow
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Review company access regularly and resolve blocked
                  accounts to keep the platform running smoothly.
                </p>
              </div>

              <Link
                href="/companies"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-50"
              >
                Review companies
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </>
      ) : (
        <>
          {/* Company quick actions */}
          <section>
            <div className="mb-4 px-1">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                Quick actions
              </p>

              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                What would you like to do?
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <ActionCard
                eyebrow="Step one"
                title="Start a new batch"
                description="Upload your recipient spreadsheet and begin generating personalised documents."
                href="/uploads"
                buttonLabel="Upload recipient data"
                icon={UploadCloud}
                iconStyle="bg-blue-50 text-blue-700"
                accentStyle="bg-blue-300/35"
                disabled={!canCreateBatches}
                disabledMessage="Batch creation is disabled for your account"
              />

              <ActionCard
                eyebrow="Track"
                title="Review deliveries"
                description="Check which documents were delivered successfully and quickly identify anything that needs attention."
                href="/logs"
                buttonLabel="Open delivery logs"
                icon={MailCheck}
                iconStyle="bg-cyan-50 text-cyan-700"
                accentStyle="bg-cyan-300/35"
                disabled={!canViewReports}
                disabledMessage="Delivery reports are disabled for your account"
              />

              <ActionCard
                eyebrow="Design"
                title="Manage templates"
                description="Create a polished certificate design or reuse one of your saved templates for the next batch."
                href="/templates"
                buttonLabel="Browse your templates"
                icon={Palette}
                iconStyle="bg-emerald-50 text-emerald-700"
                accentStyle="bg-emerald-300/35"
                disabled={!canCreateBatches}
                disabledMessage="Template access is disabled for your account"
              />
            </div>
          </section>

          {/* Simple workflow */}
          <section className="relative overflow-hidden rounded-[30px] border border-white/90 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)] sm:p-8">
            <div className="pointer-events-none absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-blue-100/60 blur-3xl" />

            <div className="relative">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                    <Sparkles className="h-4 w-4" />
                    Simple workflow
                  </div>

                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                    From spreadsheet to inbox in three steps
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    CertiFlow keeps the process simple, so you always know
                    what to do next.
                  </p>
                </div>

                {canCreateBatches ? (
                  <Link
                    href="/uploads"
                    className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 transition hover:text-blue-800"
                  >
                    Start now
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : null}
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-3">
                <div className="relative rounded-[24px] border border-blue-100 bg-blue-50/70 p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white shadow-md">
                    1
                  </span>

                  <FileUp className="mt-5 h-6 w-6 text-blue-700" />

                  <h3 className="mt-3 text-lg font-bold text-slate-950">
                    Upload recipient data
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Add your Excel file containing names, email addresses,
                    and document details.
                  </p>
                </div>

                <div className="relative rounded-[24px] border border-cyan-100 bg-cyan-50/70 p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 text-sm font-bold text-white shadow-md">
                    2
                  </span>

                  <Palette className="mt-5 h-6 w-6 text-cyan-700" />

                  <h3 className="mt-3 text-lg font-bold text-slate-950">
                    Choose your design
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Select a saved template or create a design that matches
                    your organisation.
                  </p>
                </div>

                <div className="relative rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-md">
                    3
                  </span>

                  <Send className="mt-5 h-6 w-6 text-emerald-700" />

                  <h3 className="mt-3 text-lg font-bold text-slate-950">
                    Generate and deliver
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Generate personalised PDFs and track every email from
                    the delivery logs.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Helpful status panel */}
          <section className="overflow-hidden rounded-[30px] bg-gradient-to-r from-[#0f172a] via-[#122b51] to-[#075985] p-6 text-white shadow-[0_24px_65px_rgba(15,23,42,0.16)] sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-300">
                  {stats.failedEmails === 0 ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <ScrollText className="h-6 w-6" />
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
                    Delivery health
                  </p>

                  <h2 className="mt-2 text-2xl font-bold tracking-tight">
                    {stats.failedEmails === 0
                      ? 'Everything is running smoothly'
                      : `${stats.failedEmails} deliveries need your attention`}
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                    {stats.failedEmails === 0
                      ? 'No failed emails are currently waiting for review.'
                      : 'Open the delivery logs to review failed emails and check the retry status.'}
                  </p>
                </div>
              </div>

              {canViewReports ? (
                <Link
                  href="/logs"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-50"
                >
                  View delivery logs
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}