'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { User, Mail, ShieldCheck, PenTool } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { AccountSection } from './sections/AccountSection';
import { EmailSection } from './sections/EmailSection';
import { SecuritySection } from './sections/SecuritySection';
import { SignatureSection } from './sections/SignatureSection';

export type SettingsUser = {
  id: string;
  role: 'super_admin' | 'company_admin';
  companyId: string | null;
  email: string;
  name: string;
  username?: string | null;
  twoFactorEnabled?: boolean;
  smtpConfigured?: boolean;
};

type MeResponse = { user: SettingsUser };

const TABS = [
  { key: 'account', label: 'Account', icon: User },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'security', label: 'Security', icon: ShieldCheck },
  { key: 'signature', label: 'Digital Signature', icon: PenTool }
] as const;

type TabKey = (typeof TABS)[number]['key'];

function SettingsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = (params.get('tab') as TabKey) || 'account';
  const active: TabKey = TABS.some((t) => t.key === requested) ? requested : 'account';

  const [user, setUser] = useState<SettingsUser | null>(null);

  const refresh = () => apiFetch<MeResponse>('/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null));
  useEffect(() => {
    refresh();
  }, []);

  const setTab = (key: TabKey) => {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set('tab', key);
    router.replace(`/settings?${next.toString()}`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <p className="eyebrow">Settings</p>
        <h2 className="mt-3 font-serif text-4xl tracking-tight text-ink md:text-5xl">Your account & sending setup.</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink-soft">
          Manage your profile, email delivery, two-factor security, and digital signing — all in one place.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex flex-row gap-2 overflow-x-auto lg:flex-col">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === active;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTab(tab.key)}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition',
                  isActive
                    ? 'border-bronze/40 bg-bronze/10 text-bronze-deep shadow-[0_12px_30px_-18px_rgba(11,27,58,0.5)]'
                    : 'border-[color:var(--color-border)] bg-paper-bright/70 text-ink-soft hover:border-bronze/30 hover:text-ink'
                )}
              >
                <Icon className="h-4 w-4" /> {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {active === 'account' && <AccountSection user={user} onSaved={refresh} />}
          {active === 'email' && <EmailSection user={user} onSaved={refresh} />}
          {active === 'security' && <SecuritySection user={user} onSaved={refresh} />}
          {active === 'signature' && <SignatureSection user={user} onSaved={refresh} />}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="paper rounded-[30px] p-8 text-ink-soft">Loading settings…</div>}>
      <SettingsInner />
    </Suspense>
  );
}
