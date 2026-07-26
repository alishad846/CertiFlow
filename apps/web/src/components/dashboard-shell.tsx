'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname();
  const currentPath = pathname ?? '';

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');

    const syncSidebarState = () => {
      setSidebarExpanded(mediaQuery.matches);
    };

    syncSidebarState();
    mediaQuery.addEventListener('change', syncSidebarState);

    return () => {
      mediaQuery.removeEventListener('change', syncSidebarState);
    };
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch<MeResponse>('/auth/me')
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        window.location.replace('/login');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-4 lg:px-6">
        <div className="mx-auto flex max-w-[1500px] gap-6">
          <div className="hidden w-14 shrink-0 rounded-[30px] bg-paper-dim lg:block" />
          <div className="flex-1 space-y-6 animate-pulse">
            <div className="h-32 rounded-[30px] bg-paper-dim" />
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="h-[58vh] rounded-[30px] bg-paper-dim" />
              <div className="h-[58vh] rounded-[30px] bg-paper-dim" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1500px] gap-6 px-4 py-4 lg:px-6">
        <aside
          className={`scroll-slim group sticky top-4 h-[calc(100vh-2rem)] shrink-0 overflow-y-auto overflow-x-hidden rounded-[30px] border border-[color:var(--color-border)] bg-paper-bright/85 shadow-[0_24px_80px_-42px_rgba(11,27,58,0.5)] backdrop-blur transition-all duration-300 ${
            sidebarExpanded ? 'w-[280px] p-5' : 'w-14 p-2'
          }`}
        >
          <button
            type="button"
            aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            onClick={() => setSidebarExpanded((current) => !current)}
            className="absolute right-2 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-paper-bright text-ink-soft shadow-[0_12px_30px_-14px_rgba(11,27,58,0.5)] transition hover:text-bronze-deep"
          >
            {sidebarExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          <div className={`transition-all duration-300 ${sidebarExpanded ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
            <div className="flex items-center gap-3 rounded-[24px] border border-[color:var(--color-border)] bg-paper/60 p-4">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-paper-bright shadow-[0_16px_40px_-20px_rgba(11,27,58,0.7)]">
                <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-bronze/40" />
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-bronze-deep">CertiFlow</p>
                <h1 className="font-serif text-xl tracking-tight text-ink">Bulk Delivery</h1>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <NavLink href="/dashboard" active={currentPath === '/dashboard'}>
                <span className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </span>
              </NavLink>
              {user?.role !== 'super_admin' && user?.permissions?.canCreateBatches !== false ? (
                <NavLink href="/uploads" active={currentPath === '/uploads'}>
                  <span className="flex items-center gap-2">
                    <FileUp className="h-4 w-4" /> Upload Batch
                  </span>
                </NavLink>
              ) : null}
              {user?.role !== 'super_admin' && user?.permissions?.canCreateBatches !== false ? (
                <NavLink href="/certificate-editor" active={currentPath.startsWith('/certificate-editor')}>
                  <span className="flex items-center gap-2">
                    <Palette className="h-4 w-4" /> Certificate Editor
                  </span>
                </NavLink>
              ) : null}
              {user?.role !== 'super_admin' && user?.permissions?.canCreateBatches !== false ? (
                <NavLink href="/templates" active={currentPath.startsWith('/templates')}>
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> My Templates
                  </span>
                </NavLink>
              ) : null}
              {user?.role !== 'super_admin' && user?.permissions?.canViewReports !== false ? (
                <NavLink href="/logs" active={currentPath === '/logs'}>
                  <span className="flex items-center gap-2">
                    <ScrollText className="h-4 w-4" /> Email Logs
                  </span>
                </NavLink>
              ) : null}
              {(user?.role === 'super_admin' || user?.permissions?.canRequestUpi !== false) ? (
                <NavLink href="/billing" active={currentPath.startsWith('/billing')}>
                  <span className="flex items-center gap-2">
                    <WalletCards className="h-4 w-4" /> Billing
                  </span>
                </NavLink>
              ) : null}
              {(user?.role === 'super_admin' || user?.permissions?.canRequestUpi !== false) ? (
                <NavLink href="/sender" active={currentPath.startsWith('/sender')}>
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Email Sender
                  </span>
                </NavLink>
              ) : null}
              {user?.role === 'super_admin' ? (
                <NavLink href="/companies" active={currentPath.startsWith('/companies')}>
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Companies
                  </span>
                </NavLink>
              ) : null}
              {user?.role === 'super_admin' ? (
                <NavLink href="/discounts" active={currentPath.startsWith('/discounts')}>
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Discounts
                  </span>
                </NavLink>
              ) : null}
            </div>

            <Card className="mt-8 p-4">
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.24em] text-ink-faint">Signed in as</p>
              <p className="mt-2 font-serif text-lg text-ink">{user?.name}</p>
            </Card>

            <div className="mt-6 space-y-3">
              <div className="rounded-[24px] border border-bronze/20 bg-[linear-gradient(135deg,rgba(180,138,90,0.12),rgba(161,178,214,0.08))] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-bronze-deep">
                  {user?.role === 'super_admin' ? <Crown className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  {user?.role === 'super_admin' ? 'Super admin control center' : 'A workflow built around batches'}
                </div>
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  {user?.role === 'super_admin'
                    ? 'Manage companies, permissions, billing, approvals, and discounts from one place.'
                    : 'Upload Excel once, use a saved certificate template, and send documents in controlled batches.'}
                </p>
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
          <div className="paper rounded-[30px] p-8">
            <p className="eyebrow">Welcome back</p>
            <h2 className="mt-3 font-serif text-4xl tracking-tight text-ink md:text-5xl">
              Generate and send, in one quiet flow.
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink-soft">
              Generation, PDF conversion, and delivery status — kept in one calm place.
            </p>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
