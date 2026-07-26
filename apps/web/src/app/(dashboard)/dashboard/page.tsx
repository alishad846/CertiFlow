'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Building2, FileUp, ScrollText, WalletCards, Palette, BadgePercent } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompanyAnalytics } from '@/components/dashboard/company-analytics';
import { AdminAnalytics } from '@/components/dashboard/admin-analytics';
import type { DashboardStats, CompanySummary, UserRole } from '@certiflow/shared';

type MeResponse = {
  user: {
    id: string;
    companyId: string | null;
    role: UserRole;
    email: string;
    name: string;
  };
};

function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="paper rounded-[22px] p-6">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-ink-faint">{label}</p>
      <p className="mt-3 font-serif text-4xl text-ink">
        {typeof value === 'number' ? value.toLocaleString('en-US') : value}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

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
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="paper rounded-[28px] p-8 font-serif text-lg text-ink">Loading dashboard…</div>;
  }

  if (error || !stats || !user) {
    return (
      <Card>
        <p className="font-serif text-xl text-ink">Unable to load dashboard</p>
        <p className="mt-2 text-sm text-ink-soft">{error || 'No dashboard data available yet.'}</p>
      </Card>
    );
  }

  const isSuperAdmin = user.role === 'super_admin';

  if (isSuperAdmin) {
    const active = companies.filter((c) => c.status === 'active').length;
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Companies" value={companies.length} hint={`${active} active`} />
          <StatTile label="Certificates downloaded" value={stats.totalGeneratedDocuments} hint="Across the platform" />
          <StatTile label="Credits in circulation" value={stats.remainingCredits} hint="All companies combined" />
          <StatTile label="Emails delivered" value={stats.emailsSent} hint={`${stats.failedEmails} retried`} />
        </div>

        <AdminAnalytics />

        <div className="grid gap-4 md:grid-cols-3">
          <QuickLink href="/companies" icon={Building2} label="Companies" hint="Access & credits" />
          <QuickLink href="/billing" icon={WalletCards} label="Billing" hint="Credit purchases and approvals" />
          <QuickLink href="/discounts" icon={BadgePercent} label="Discounts" hint="Rules & limits" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Certificates issued" value={stats.totalGeneratedDocuments} hint="Generated from your uploads" />
        <StatTile label="Credits remaining" value={stats.remainingCredits} hint="1 credit per certificate" />
        <StatTile label="Emails sent" value={stats.emailsSent} hint="Delivered certificates" />
        <StatTile label="Pending" value={stats.pendingEmails} hint="In the send queue" />
      </div>

      <CompanyAnalytics />

      <div className="grid gap-4 md:grid-cols-3">
        <QuickLink href="/uploads" icon={FileUp} label="New batch" hint="Upload & send" />
        <QuickLink href="/certificate-editor" icon={Palette} label="Editor" hint="Design a template" />
        <QuickLink href="/logs" icon={ScrollText} label="Delivery logs" hint="Track every email" />
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  hint
}: {
  href: string;
  icon: typeof Building2;
  label: string;
  hint: string;
}) {
  return (
    <Link href={href} className="paper group flex items-center justify-between rounded-[22px] p-6 transition-transform duration-300 hover:-translate-y-0.5">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-paper-bright">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-serif text-lg text-ink">{label}</p>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-ink-faint">{hint}</p>
        </div>
      </div>
      <ArrowUpRight className="h-5 w-5 text-ink-faint transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-bronze-deep" />
    </Link>
  );
}
