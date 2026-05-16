'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileClock,
  FileUp,
  MailCheck,
  ShieldCheck,
  Sparkles,
  Users2,
  WalletCards,
  Crown,
  Lock
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DashboardStats, BatchSummary, CompanySummary, UserRole } from '@certiflow/shared';

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

export default function DashboardPage() {
  const [user, setUser] = useState<MeResponse['user'] | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const meData = await apiFetch<MeResponse>('/auth/me');
      const [statsData, batchData] = await Promise.all([
        apiFetch<DashboardStats>('/dashboard/stats'),
        apiFetch<{ batches: BatchSummary[] }>('/batches')
      ]);

      let companyData: { companies: CompanySummary[] } | null = null;
      if (meData.user.role === 'super_admin') {
        companyData = await apiFetch<{ companies: CompanySummary[] }>('/companies');
      }

      setUser(meData.user);
      setStats(statsData);
      setBatches(batchData.batches);
      setCompanies(companyData?.companies ?? []);
      setError('');
    };

    load()
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="rounded-[30px] border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">Loading dashboard...</div>;
  }

  if (error || !stats || !user) {
    return (
      <Card>
        <p className="text-lg font-semibold">Unable to load dashboard</p>
        <p className="mt-2 text-sm text-slate-500">{error || 'No dashboard data available yet.'}</p>
      </Card>
    );
  }

  const isSuperAdmin = user.role === 'super_admin';
  const blockedCompanies = companies.filter((company) => company.status === 'blocked').length;
  const activeCompanies = companies.filter((company) => company.status === 'active').length;

  const recentBatches = batches.slice(0, 5);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.03),rgba(42,141,240,0.05))]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {isSuperAdmin ? 'Control tower' : 'Operations workspace'}
              </p>
              <Badge tone={isSuperAdmin ? 'blue' : 'green'}>{isSuperAdmin ? 'Super admin' : 'Company admin'}</Badge>
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink md:text-4xl">
              {isSuperAdmin
                ? 'Manage companies, discounts, billing, and access from one clean place.'
                : 'Upload documents fast, track delivery clearly, and keep the flow simple.'}
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              {isSuperAdmin
                ? 'A super admin dashboard should act like a command center: control access, control money, and keep the platform healthy.'
                : 'A company admin dashboard should act like a workbench: only the tools needed to create batches, send emails, and review status.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={isSuperAdmin ? 'amber' : 'blue'}>{isSuperAdmin ? 'Full platform control' : 'Batch size 50'}</Badge>
            <Badge tone="green">Retry enabled</Badge>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={isSuperAdmin ? 'Generated documents across platform' : 'Total generated documents'}
          value={stats.totalGeneratedDocuments}
          hint={isSuperAdmin ? 'All companies combined' : 'Documents created from uploads'}
        />
        <StatCard
          label={isSuperAdmin ? 'Remaining credits across companies' : 'Remaining credits'}
          value={stats.remainingCredits}
          hint={isSuperAdmin ? 'Managed at company level' : '1 credit per recipient'}
        />
        <StatCard label="Emails sent" value={stats.emailsSent} hint="Successfully delivered PDFs" />
        <StatCard label="Failed emails" value={stats.failedEmails} hint="Automatically retried first" />
      </div>

      {isSuperAdmin ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-white/80">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">Companies</p>
                <h3 className="text-2xl font-bold tracking-tight text-ink">{companies.length}</h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {activeCompanies} active, {blockedCompanies} blocked. Use the Companies screen to block, delete, or change permissions.
            </p>
            <Button asChild variant="secondary" className="mt-5 w-full">
              <Link href="/companies">
                Open company control
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </Card>

          <Card className="border-white/80">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(42,141,240,0.14),rgba(42,141,240,0.05))] text-accent-700">
                <WalletCards className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">Billing</p>
                <h3 className="text-2xl font-bold tracking-tight text-ink">Top-ups & approvals</h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Approve UPI requests, keep pricing strict, and control company credits without leaving the dashboard.
            </p>
            <Button asChild variant="secondary" className="mt-5 w-full">
              <Link href="/billing">
                Review billing queue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </Card>

          <Card className="border-white/80">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(16,185,129,0.14),rgba(16,185,129,0.05))] text-emerald-700">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">Security</p>
                <h3 className="text-2xl font-bold tracking-tight text-ink">Access and audit</h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Block companies, revoke sessions, and keep platform access under control from one place.
            </p>
            <Button asChild variant="secondary" className="mt-5 w-full">
              <Link href="/discounts">
                Manage discounts
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-white/80">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(42,141,240,0.14),rgba(42,141,240,0.05))] text-accent-700">
                <FileUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">Step 1</p>
                <h3 className="text-2xl font-bold tracking-tight text-ink">Upload files</h3>
              </div>
            </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
              Upload one Excel sheet and use the active certificate template. Keep the original layout untouched.
            </p>
            <Button asChild variant="secondary" className="mt-5 w-full">
              <Link href="/uploads">
                Start a batch
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </Card>

          <Card className="border-white/80">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(14,165,233,0.14),rgba(14,165,233,0.05))] text-sky-700">
                <FileClock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">Step 2</p>
                <h3 className="text-2xl font-bold tracking-tight text-ink">Queue processing</h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Documents generate in the background, convert to PDF, then move to email sending batches.
            </p>
            <Button asChild variant="secondary" className="mt-5 w-full">
              <Link href="/dashboard">
                Review batches
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </Card>

          <Card className="border-white/80">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(16,185,129,0.14),rgba(16,185,129,0.05))] text-emerald-700">
                <MailCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">Step 3</p>
                <h3 className="text-2xl font-bold tracking-tight text-ink">Review delivery</h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Check sent, pending, and failed emails so you can retry or fix templates fast.
            </p>
            <Button asChild variant="secondary" className="mt-5 w-full">
              <Link href="/logs">
                Open logs
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </Card>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.45fr,0.95fr]">
        <Card className="border-white/80">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">Recent batches</p>
              <h3 className="mt-1 text-2xl font-bold tracking-tight text-ink">
                {isSuperAdmin ? 'Platform activity' : 'Track generation progress'}
              </h3>
            </div>
            <Button asChild variant="secondary">
              <Link href="/uploads">
                <FileUp className="mr-2 h-4 w-4" />
                New batch
              </Link>
            </Button>
          </div>

          <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Batch</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Progress</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentBatches.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={4}>
                      No batches yet. Upload Excel and a certificate template to create your first run.
                    </td>
                  </tr>
                ) : (
                  recentBatches.map((batch) => {
                    const percent = batch.totalRows ? Math.round((batch.processedRows / batch.totalRows) * 100) : 0;
                    const tone = batch.status.includes('failed')
                      ? 'red'
                      : batch.status === 'completed'
                        ? 'green'
                        : batch.status === 'sending'
                          ? 'blue'
                          : 'amber';

                    return (
                      <tr key={batch.id}>
                        <td className="px-4 py-4 font-medium text-ink">{batch.name}</td>
                        <td className="px-4 py-4">
                          <Badge tone={tone as any}>{batch.status}</Badge>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-ink" style={{ width: `${percent}%` }} />
                            </div>
                            <span className="text-slate-500">
                              {batch.processedRows}/{batch.totalRows}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link className="inline-flex items-center gap-2 font-semibold text-accent-700" href={`/batches/${batch.id}`}>
                            View
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="border-white/80">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(42,141,240,0.14),rgba(42,141,240,0.05))] text-accent-700">
              {isSuperAdmin ? <Crown className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">{isSuperAdmin ? 'Admin playbook' : 'Quick actions'}</p>
              <h3 className="mt-1 text-2xl font-bold tracking-tight text-ink">
                {isSuperAdmin ? 'Control the platform fast' : 'Keep the workflow simple'}
              </h3>
            </div>
          </div>

          {isSuperAdmin ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <Building2 className="h-4 w-4 text-accent-700" />
                  1. Manage companies
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-500">Block, unblock, delete, and change permissions from the Companies page.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <WalletCards className="h-4 w-4 text-accent-700" />
                  2. Approve billing
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-500">Approve UPI top-ups and keep pricing rules strict.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <Lock className="h-4 w-4 text-accent-700" />
                  3. Protect access
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-500">Turn off permissions or revoke access instantly when needed.</p>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <FileUp className="h-4 w-4 text-accent-700" />
                  1. Upload files
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-500">Add Excel data and the saved certificate template in one form.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <FileClock className="h-4 w-4 text-accent-700" />
                  2. Queue processing
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-500">BullMQ handles generation, PDF conversion, and email sends.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <MailCheck className="h-4 w-4 text-accent-700" />
                  3. Review logs
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-500">Check sent, pending, and failed statuses from the dashboard.</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
