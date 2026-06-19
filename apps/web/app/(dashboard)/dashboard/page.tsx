'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, FileUp, MailCheck, ShieldCheck, WalletCards } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DashboardStats, CompanySummary, UserRole } from '@certiflow/shared';

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
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const meData = await apiFetch<MeResponse>('/auth/me');
      const statsData = await apiFetch<DashboardStats>('/dashboard/stats');

      let companyData: { companies: CompanySummary[] } | null = null;
      if (meData.user.role === 'super_admin') {
        companyData = await apiFetch<{ companies: CompanySummary[] }>('/companies');
      }

      setUser(meData.user);
      setStats(statsData);
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
                ? 'Manage companies, billing, and access from one clean place.'
                : 'Upload documents fast and keep delivery clear.'}
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              {isSuperAdmin
                ? 'Use the dashboard for the platform signals you need most. Detailed company work stays on dedicated pages.'
                : 'Use the dashboard for quick actions and status at a glance. Uploads, templates, and logs live on their own pages.'}
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
              {activeCompanies} active, {blockedCompanies} blocked.
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
                <p className="text-sm font-semibold text-slate-500">Uploads</p>
                <h3 className="text-2xl font-bold tracking-tight text-ink">Start a batch</h3>
              </div>
            </div>
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
                <MailCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">Logs</p>
                <h3 className="text-2xl font-bold tracking-tight text-ink">Review status</h3>
              </div>
            </div>
            <Button asChild variant="secondary" className="mt-5 w-full">
              <Link href="/logs">
                Open logs
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
                <p className="text-sm font-semibold text-slate-500">Templates</p>
                <h3 className="text-2xl font-bold tracking-tight text-ink">Edit designs</h3>
              </div>
            </div>
            <Button asChild variant="secondary" className="mt-5 w-full">
              <Link href="/templates">
                Open templates
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
