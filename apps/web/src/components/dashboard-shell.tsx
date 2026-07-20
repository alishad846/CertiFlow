'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  Crown,
  FileCheck2,
  FileUp,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Palette,
  ScrollText,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { NavLink } from './ui/nav-link';

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

type NavigationItem = {
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  visible: boolean;
  active: boolean;
};

export function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentPath = pathname ?? '';

  const [user, setUser] = useState<MeResponse['user'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  const canCreateBatches =
    !isSuperAdmin && user?.permissions?.canCreateBatches !== false;

  const canViewReports =
    !isSuperAdmin && user?.permissions?.canViewReports !== false;

  const canManageBilling =
    isSuperAdmin || user?.permissions?.canRequestUpi !== false;

  useEffect(() => {
    let active = true;

    apiFetch<MeResponse>('/auth/me')
      .then((data) => {
        if (active) {
          setUser(data.user);
        }
      })
      .catch(() => {
        window.location.replace('/login');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [currentPath]);

  const navigationItems: NavigationItem[] = [
    {
      label: 'Dashboard',
      description: 'Workspace overview',
      href: '/dashboard',
      icon: LayoutDashboard,
      visible: true,
      active: currentPath === '/dashboard',
    },
    {
      label: 'Upload Batch',
      description: 'Generate documents',
      href: '/uploads',
      icon: FileUp,
      visible: canCreateBatches,
      active: currentPath.startsWith('/uploads'),
    },
    {
      label: 'Certificate Editor',
      description: 'Create a design',
      href: '/certificate-editor',
      icon: Palette,
      visible: canCreateBatches,
      active: currentPath.startsWith('/certificate-editor'),
    },
    {
      label: 'My Templates',
      description: 'Saved designs',
      href: '/templates',
      icon: Sparkles,
      visible: canCreateBatches,
      active: currentPath.startsWith('/templates'),
    },
    {
      label: 'Email Logs',
      description: 'Track deliveries',
      href: '/logs',
      icon: ScrollText,
      visible: canViewReports,
      active: currentPath.startsWith('/logs'),
    },
    {
      label: 'Billing',
      description: 'Credits and payments',
      href: '/billing',
      icon: WalletCards,
      visible: canManageBilling,
      active: currentPath.startsWith('/billing'),
    },
    {
      label: 'Email Sender',
      description: 'Delivery settings',
      href: '/sender',
      icon: Mail,
      visible: canManageBilling,
      active: currentPath.startsWith('/sender'),
    },
    {
      label: 'Companies',
      description: 'Manage organisations',
      href: '/companies',
      icon: Building2,
      visible: Boolean(isSuperAdmin),
      active: currentPath.startsWith('/companies'),
    },
    {
      label: 'Discounts',
      description: 'Manage promotions',
      href: '/discounts',
      icon: Sparkles,
      visible: Boolean(isSuperAdmin),
      active: currentPath.startsWith('/discounts'),
    },
  ];

  const visibleNavigationItems = navigationItems.filter(
    (item) => item.visible,
  );

  const handleLogout = async () => {
    await apiFetch('/auth/logout', {
      method: 'POST',
    });

    window.location.replace('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f8ff] p-4 lg:p-6">
        <div className="mx-auto flex max-w-[1600px] gap-6">
          <aside className="hidden h-[calc(100vh-3rem)] w-[290px] animate-pulse rounded-[32px] bg-white lg:block" />

          <main className="min-w-0 flex-1 space-y-6">
            <div className="h-72 animate-pulse rounded-[32px] bg-white" />

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-40 animate-pulse rounded-[28px] bg-white"
                />
              ))}
            </div>

            <div className="h-80 animate-pulse rounded-[32px] bg-white" />
          </main>
        </div>
      </div>
    );
  }

  const SidebarContent = ({
    mobile = false,
  }: {
    mobile?: boolean;
  }) => {
    const expanded = mobile || sidebarExpanded;

    return (
      <div className="flex min-h-full flex-col">
        <div
          className={`flex items-center ${
            expanded ? 'gap-3' : 'justify-center'
          }`}
        >
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-[0_12px_30px_rgba(37,99,235,0.28)]">
            <ShieldCheck className="h-6 w-6" />

            <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-emerald-400" />
          </div>

          {expanded ? (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold tracking-tight text-slate-950">
                  CertiFlow
                </p>

                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">
                  SaaS
                </span>
              </div>

              <p className="truncate text-xs font-medium text-slate-500">
                Document delivery made simple
              </p>
            </div>
          ) : null}

          {mobile ? (
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close navigation"
              className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        {expanded ? (
          <div className="mt-7 flex items-center justify-between px-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Main menu
            </p>

            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
              Online
            </span>
          </div>
        ) : (
          <div className="mx-auto mt-7 h-px w-8 bg-slate-200" />
        )}

        <nav className="mt-3 space-y-1.5">
          {visibleNavigationItems.map((item) => {
            const Icon = item.icon;

            if (!expanded) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  className={`group mx-auto flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 ${
                    item.active
                      ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-[0_10px_24px_rgba(15,23,42,0.2)]'
                      : 'text-slate-500 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  <Icon className="h-5 w-5 transition-transform group-hover:scale-110" />
                </a>
              );
            }

            return (
              <NavLink
                key={item.href}
                href={item.href}
                active={item.active}
              >
                <span className="flex w-full items-center gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                      item.active
                        ? 'bg-white/15 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {item.label}
                    </span>

                    <span
                      className={`block truncate text-[11px] ${
                        item.active ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {item.description}
                    </span>
                  </span>

                  {item.active ? (
                    <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_0_4px_rgba(103,232,249,0.12)]" />
                  ) : null}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          {expanded ? (
            <>
              <div className="relative overflow-hidden rounded-[24px] border border-blue-100 bg-gradient-to-br from-blue-50 via-cyan-50/70 to-emerald-50/60 p-4">
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-200/30 blur-2xl" />

                <div className="relative">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                      {isSuperAdmin ? (
                        <Crown className="h-4 w-4" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </span>

                    {isSuperAdmin
                      ? 'Admin control centre'
                      : 'Your workflow'}
                  </div>

                  <p className="mt-3 text-xs leading-5 text-slate-600">
                    {isSuperAdmin
                      ? 'Manage companies, permissions, payments, and platform activity.'
                      : 'Upload your data, choose a design, and send personalised documents.'}
                  </p>

                  {!isSuperAdmin ? (
                    <div className="mt-4 flex items-center gap-1.5">
                      <span className="h-2 flex-1 rounded-full bg-blue-500" />
                      <span className="h-2 flex-1 rounded-full bg-cyan-400" />
                      <span className="h-2 flex-1 rounded-full bg-emerald-400" />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 rounded-[24px] border border-slate-100 bg-slate-50/90 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-blue-800 text-sm font-bold uppercase text-white shadow-sm">
                    {user?.name?.charAt(0) || 'U'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {user?.name}
                    </p>

                    <p className="truncate text-[11px] text-slate-500">
                      {user?.email}
                    </p>
                  </div>

                  <Badge tone={isSuperAdmin ? 'blue' : 'green'}>
                    {isSuperAdmin ? 'Admin' : 'Member'}
                  </Badge>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={handleLogout}
                className="mt-3 w-full justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Log out
                </span>

                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eaf4ff_0%,#f7faff_38%,#f1f7ff_100%)] text-slate-900">
      {/* Mobile background overlay */}
      {mobileSidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-3 left-3 z-50 w-[290px] overflow-y-auto rounded-[30px] border border-white bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.2)] transition-transform duration-300 lg:hidden ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-[120%]'
        }`}
      >
        <SidebarContent mobile />
      </aside>

      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-5 p-3 sm:p-4 lg:gap-6 lg:p-6">
        {/* Desktop sidebar and collapse button */}
        <div className="relative hidden shrink-0 lg:block">
          <aside
            className={`sticky top-6 h-[calc(100vh-3rem)] overflow-y-auto overflow-x-hidden rounded-[30px] border border-white/90 bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,0.09)] backdrop-blur-xl transition-[width,padding] duration-300 ${
              sidebarExpanded ? 'w-[290px] p-5' : 'w-[78px] p-4'
            }`}
          >
            <SidebarContent />
          </aside>

          <button
            type="button"
            aria-label={
              sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'
            }
            title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            onClick={() => setSidebarExpanded((current) => !current)}
            className="absolute -right-[18px] top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-blue-100 bg-white text-slate-600 shadow-[0_8px_24px_rgba(15,23,42,0.14)] transition hover:scale-105 hover:bg-blue-50 hover:text-blue-700"
          >
            {sidebarExpanded ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>

        <main className="min-w-0 flex-1">
          {/* Mobile header */}
          <header className="mb-4 flex items-center justify-between rounded-[22px] border border-white bg-white/95 p-3 shadow-[0_10px_30px_rgba(15,23,42,0.07)] backdrop-blur lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-md">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm font-bold text-slate-950">CertiFlow</p>
                <p className="text-[11px] text-slate-500">
                  Document delivery
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
            >
              <Menu className="h-5 w-5" />
            </button>
          </header>

          <div className="space-y-5 lg:space-y-6">
            {currentPath === '/dashboard' ? (
              <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0f172a] via-[#122b51] to-[#075985] p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:p-8 lg:p-10">
                {/* Decorative background */}
                <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-blue-500/25 blur-3xl" />

                <div className="pointer-events-none absolute right-8 top-8 hidden h-36 w-36 rotate-12 rounded-[36px] border border-white/10 bg-white/5 xl:block" />
                <div className="pointer-events-none absolute right-28 top-20 hidden h-28 w-28 -rotate-12 rounded-[30px] border border-cyan-300/10 bg-cyan-300/5 xl:block" />

                <div className="relative">
                  <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-cyan-100 backdrop-blur">
                        <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                        Welcome back, {user?.name?.split(' ')[0] || 'there'}
                      </div>

                      <h2 className="mt-6 max-w-3xl text-3xl font-bold leading-[1.08] tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
                        Create, personalise and deliver with confidence.
                      </h2>

                      <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                        Everything you need to turn recipient data into
                        beautifully designed documents—and send them without
                        complicated steps.
                      </p>

                      <div className="mt-7 flex flex-wrap gap-3">
                        {canCreateBatches ? (
                          <a
                            href="/uploads"
                            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,0.15)] transition hover:-translate-y-0.5 hover:bg-cyan-50"
                          >
                            <FileUp className="h-4 w-4 text-blue-600" />
                            Start a new batch
                            <ArrowRight className="h-4 w-4" />
                          </a>
                        ) : null}

                        <a
                          href={canViewReports ? '/logs' : '/dashboard'}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15"
                        >
                          <ScrollText className="h-4 w-4 text-cyan-300" />
                          View delivery status
                        </a>
                      </div>
                    </div>

                    <div className="grid min-w-full gap-3 sm:grid-cols-3 xl:min-w-[390px]">
                      <div className="rounded-[20px] border border-white/10 bg-white/10 p-4 backdrop-blur-md">
                        <FileCheck2 className="h-5 w-5 text-cyan-300" />

                        <p className="mt-3 text-xl font-bold">PDF</p>
                        <p className="mt-1 text-xs text-slate-300">
                          Ready to generate
                        </p>
                      </div>

                      <div className="rounded-[20px] border border-white/10 bg-white/10 p-4 backdrop-blur-md">
                        <Mail className="h-5 w-5 text-blue-300" />

                        <p className="mt-3 text-xl font-bold">50</p>
                        <p className="mt-1 text-xs text-slate-300">
                          Per delivery batch
                        </p>
                      </div>

                      <div className="rounded-[20px] border border-emerald-300/15 bg-emerald-400/10 p-4 backdrop-blur-md">
                        <ShieldCheck className="h-5 w-5 text-emerald-300" />

                        <p className="mt-3 text-xl font-bold">Secure</p>
                        <p className="mt-1 text-xs text-slate-300">
                          Controlled workflow
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 border-t border-white/10 pt-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#18365d] bg-blue-500 text-[10px] font-bold">
                            1
                          </span>
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#18365d] bg-cyan-500 text-[10px] font-bold">
                            2
                          </span>
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#18365d] bg-emerald-500 text-[10px] font-bold">
                            3
                          </span>
                        </div>

                        <p className="text-xs font-medium text-slate-300">
                          Upload data → Choose design → Deliver
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-blue-300/15 bg-blue-300/10 px-3 py-1.5 text-[11px] font-semibold text-blue-100">
                          Credits-powered
                        </span>

                        <span className="rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100">
                          Automatic retry
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}