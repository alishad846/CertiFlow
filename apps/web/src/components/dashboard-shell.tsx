'use client';

import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  FileUp,
  LogOut,
  ScrollText,
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
  Mail,
  WalletCards,
  Crown,
  Building2,
  Palette,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from './ui/button';
import { NavLink } from './ui/nav-link';
import { Badge } from './ui/badge';
import { Card } from './ui/card';

type MeResponse = {
  user: {
    id: string;
    companyId: string | null;
    role: 'super_admin' | 'company_admin';
    email: string;
    name: string;
    permissions?: {
      canCreateBatches: boolean;
      canRequestUpi: boolean;
      canViewReports: boolean;
    };
  };
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeResponse['user'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [pathname, setPathname] = useState('');

  useEffect(() => {
    setPathname(window.location.pathname);

    const handlePopState = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);

    let active = true;
    apiFetch<MeResponse>('/auth/me')
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        if (active) {
          window.location.replace('/login');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f5f9ff_0%,#ffffff_35%,#eef6ff_100%)] px-4 py-4 lg:px-6">
        <div className="mx-auto flex max-w-[1500px] gap-6">
          <div className="hidden w-14 shrink-0 rounded-[30px] bg-slate-200/80 lg:block" />
          <div className="space-y-6 animate-pulse">
            <div className="h-32 rounded-[30px] bg-slate-200/80" />
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="h-[58vh] rounded-[30px] bg-slate-200/80" />
              <div className="h-[58vh] rounded-[30px] bg-slate-200/80" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f4f8ff_0%,#ffffff_36%,#eef5ff_100%)] text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1500px] gap-6 px-4 py-4 lg:px-6">
        <aside
          className={`group sticky top-4 h-[calc(100vh-2rem)] shrink-0 overflow-hidden rounded-[30px] border border-white/70 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.07)] backdrop-blur transition-all duration-300 ${
            sidebarExpanded ? 'w-[280px] p-5' : 'w-14 p-2'
          }`}
        >
          <button
            type="button"
            aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            onClick={() => setSidebarExpanded((current) => !current)}
            className="absolute right-2 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.12)] transition hover:bg-slate-50"
          >
            {sidebarExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          <div className={`transition-all duration-300 ${sidebarExpanded ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
            <div className="flex items-center gap-3 rounded-[24px] bg-[linear-gradient(180deg,rgba(15,23,42,0.04),rgba(15,23,42,0.015))] p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">CertiFlow</p>
                <h1 className="text-xl font-bold tracking-tight">Bulk Delivery SaaS</h1>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <NavLink href="/dashboard" active={pathname === '/dashboard'}>
                <span className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </span>
              </NavLink>
              {user?.role !== 'super_admin' && user?.permissions?.canCreateBatches !== false ? (
                <NavLink href="/uploads" active={pathname === '/uploads'}>
                  <span className="flex items-center gap-2">
                    <FileUp className="h-4 w-4" /> Upload Batch
                  </span>
                </NavLink>
              ) : null}
              {user?.role !== 'super_admin' && user?.permissions?.canCreateBatches !== false ? (
                <NavLink href="/certificate-editor" active={pathname.startsWith('/certificate-editor')}>
                  <span className="flex items-center gap-2">
                    <Palette className="h-4 w-4" /> Certificate Editor
                  </span>
                </NavLink>
              ) : null}
              {user?.role !== 'super_admin' && user?.permissions?.canCreateBatches !== false ? (
                <NavLink href="/templates" active={pathname.startsWith('/templates')}>
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> My Templates
                  </span>
                </NavLink>
              ) : null}
              {user?.role !== 'super_admin' && user?.permissions?.canViewReports !== false ? (
                <NavLink href="/logs" active={pathname === '/logs'}>
                  <span className="flex items-center gap-2">
                    <ScrollText className="h-4 w-4" /> Email Logs
                  </span>
                </NavLink>
              ) : null}
              {(user?.role === 'super_admin' || user?.permissions?.canRequestUpi !== false) ? (
                <NavLink href="/billing" active={pathname.startsWith('/billing')}>
                  <span className="flex items-center gap-2">
                    <WalletCards className="h-4 w-4" /> Billing
                  </span>
                </NavLink>
              ) : null}
              {(user?.role === 'super_admin' || user?.permissions?.canRequestUpi !== false) ? (
                <NavLink href="/sender" active={pathname.startsWith('/sender')}>
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Email Sender
                  </span>
                </NavLink>
              ) : null}
              {user?.role === 'super_admin' ? (
                <NavLink href="/companies" active={pathname.startsWith('/companies')}>
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Companies
                  </span>
                </NavLink>
              ) : null}
              {user?.role === 'super_admin' ? (
                <NavLink href="/discounts" active={pathname.startsWith('/discounts')}>
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Discounts
                  </span>
                </NavLink>
              ) : null}
            </div>

            <Card className="mt-8 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Signed in as</p>
                  <p className="mt-2 text-lg font-semibold">{user?.name}</p>
                  <p className="text-sm text-slate-500">{user?.email}</p>
                </div>
                <Badge tone={user?.role === 'super_admin' ? 'blue' : 'green'}>
                  {user?.role === 'super_admin' ? 'Super Admin' : 'Company Admin'}
                </Badge>
              </div>
            </Card>

            <div className="mt-6 space-y-3">
              <div className="rounded-[24px] bg-[linear-gradient(135deg,rgba(42,141,240,0.10),rgba(84,171,255,0.03))] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-accent-700">
                  {user?.role === 'super_admin' ? <Crown className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  {user?.role === 'super_admin' ? 'Super admin control center' : 'Batch-first workflow'}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {user?.role === 'super_admin'
                    ? 'Manage companies, permissions, billing, approvals, and discounts from one place.'
                    : 'Upload Excel once, use a saved certificate template, and send documents in controlled batches.'}
                </p>
                {user?.role !== 'super_admin' && user?.permissions ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {user.permissions.canCreateBatches ? <Badge tone="green">Uploads on</Badge> : <Badge tone="red">Uploads off</Badge>}
                    {user.permissions.canRequestUpi ? <Badge tone="blue">Billing on</Badge> : <Badge tone="red">Billing off</Badge>}
                    {user.permissions.canViewReports ? <Badge tone="amber">Reports on</Badge> : <Badge tone="red">Reports off</Badge>}
                  </div>
                ) : null}
              </div>
              <Button
                className="w-full justify-between"
                variant="secondary"
                onClick={async () => {
                  await apiFetch('/auth/logout', { method: 'POST' });
                  window.location.replace('/login');
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Logout
                </span>
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] backdrop-blur">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Welcome back</p>
                <h2 className="mt-2 text-4xl font-bold tracking-tight text-ink md:text-5xl">
                  Generate and send documents in one clean flow.
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  The dashboard keeps generation, PDF conversion, and delivery status in one simple place for beginners.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="blue">Credits-powered delivery</Badge>
                <Badge tone="green">Batch size 50</Badge>
              </div>
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
