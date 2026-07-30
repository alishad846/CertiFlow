'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Minus, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  SUBSCRIPTION_TIERS,
  SUBSCRIPTION_FEATURE_LABELS,
  type SubscriptionFeatures
} from '@certiflow/shared';

type Entitlements = {
  planKey: string;
  used: number;
  includedCertificates: number;
  overage: number;
  overageInr: number;
  periodEnd: string;
};
type MeResponse = { user: { role: 'super_admin' | 'company_admin'; companyId: string | null } };

const FEATURE_KEYS = Object.keys(SUBSCRIPTION_FEATURE_LABELS) as (keyof SubscriptionFeatures)[];

export default function PlansPage() {
  const [role, setRole] = useState<MeResponse['user']['role']>('company_admin');
  const [companyId, setCompanyId] = useState('');
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    apiFetch<MeResponse>('/auth/me').then((data) => {
      setRole(data.user.role);
      if (data.user.role !== 'super_admin' && data.user.companyId) setCompanyId(data.user.companyId);
    });
  }, []);

  const load = useCallback(async () => {
    if (role === 'super_admin' && !companyId.trim()) {
      setEnt(null);
      return;
    }
    try {
      const query = role === 'super_admin' ? `?companyId=${encodeURIComponent(companyId.trim())}` : '';
      const data = await apiFetch<{ entitlements: Entitlements }>(`/subscription${query}`);
      setEnt(data.entitlements);
      setMessage('');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load plan');
    }
  }, [role, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const assign = async (planKey: string) => {
    if (!companyId.trim()) {
      setMessage('Enter a company ID first.');
      return;
    }
    setBusy(planKey);
    try {
      await apiFetch('/subscription/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: companyId.trim(), planKey })
      });
      setMessage(`Plan changed to ${planKey}.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to assign plan');
    } finally {
      setBusy('');
    }
  };

  const usedPct = ent ? Math.min(100, Math.round((ent.used / Math.max(1, ent.includedCertificates)) * 100)) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <p className="eyebrow">Plans &amp; usage</p>
        <h2 className="mt-3 font-serif text-4xl tracking-tight text-ink">Pick the plan that fits your volume.</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink-soft">
          Every plan includes a monthly certificate allowance; beyond it you pay a small per-certificate rate. Higher
          tiers unlock tamper-proof signing, branded verification, analytics and API access.
        </p>
      </Card>

      {role === 'super_admin' ? (
        <Card>
          <label className="mb-2 block text-sm font-medium text-ink-soft">Company ID</label>
          <Input value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="Enter a company ID to view / change its plan" />
        </Card>
      ) : null}

      {message ? (
        <p className="rounded-2xl border border-[color:var(--color-border)] bg-paper/50 px-4 py-3 text-sm text-ink-soft">{message}</p>
      ) : null}

      {ent ? (
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">This billing period</p>
              <p className="mt-2 font-serif text-3xl text-ink">
                {ent.used.toLocaleString('en-IN')}{' '}
                <span className="text-ink-faint">/ {ent.includedCertificates.toLocaleString('en-IN')} certificates</span>
              </p>
              {ent.overage > 0 ? (
                <p className="mt-1 text-sm text-bronze-deep">
                  {ent.overage.toLocaleString('en-IN')} over allowance · ₹{(ent.overage * ent.overageInr).toLocaleString('en-IN')} in overage
                </p>
              ) : null}
            </div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-ink-faint">
              Renews {new Date(ent.periodEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
            </p>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-paper-dim">
            <div className="h-full rounded-full bg-bronze" style={{ width: `${usedPct}%` }} />
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {SUBSCRIPTION_TIERS.map((tier) => {
          const current = ent?.planKey === tier.key;
          return (
            <div key={tier.key} className={tier.recommended ? 'paper-ink rounded-[28px] p-7' : 'paper rounded-[28px] p-7'}>
              <div className="flex items-center justify-between">
                <p className={`font-mono text-[0.62rem] uppercase tracking-[0.2em] ${tier.recommended ? 'text-bronze-bright' : 'text-ink-faint'}`}>
                  {tier.name}
                </p>
                {current ? (
                  <span className="rounded-full bg-bronze px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.18em] text-paper-bright">Current</span>
                ) : tier.recommended ? (
                  <span className="font-serif text-sm italic text-bronze-bright">Popular</span>
                ) : null}
              </div>
              <p className={`mt-4 font-serif text-4xl ${tier.recommended ? 'text-paper-bright' : 'text-ink'}`}>
                ₹{tier.priceInr.toLocaleString('en-IN')}
                <span className={`ml-1 text-sm ${tier.recommended ? 'text-mist' : 'text-ink-soft'}`}>/mo</span>
              </p>
              <p className={`mt-1 text-sm ${tier.recommended ? 'text-mist' : 'text-ink-soft'}`}>
                {tier.includedCertificates.toLocaleString('en-IN')} certificates/mo · then ₹{tier.overageInr}/cert
              </p>
              <p className={`mt-1 text-sm ${tier.recommended ? 'text-mist' : 'text-ink-soft'}`}>
                {tier.seats === 0 ? 'Unlimited seats' : `${tier.seats} seat${tier.seats > 1 ? 's' : ''}`}
              </p>

              <ul className="mt-5 space-y-2.5">
                {FEATURE_KEYS.map((key) => {
                  const on = tier.features[key];
                  return (
                    <li key={key} className={`flex items-center gap-2 text-sm ${tier.recommended ? 'text-mist' : 'text-ink-soft'}`}>
                      {on ? (
                        <Check className={`h-4 w-4 shrink-0 ${tier.recommended ? 'text-bronze-bright' : 'text-[#3f6f4a]'}`} />
                      ) : (
                        <Minus className="h-4 w-4 shrink-0 text-ink-faint/60" />
                      )}
                      <span className={on ? '' : 'opacity-60'}>{SUBSCRIPTION_FEATURE_LABELS[key]}</span>
                    </li>
                  );
                })}
              </ul>

              {role === 'super_admin' ? (
                <Button
                  variant={tier.recommended ? 'bronze' : current ? 'secondary' : 'primary'}
                  className="mt-6 w-full"
                  disabled={busy === tier.key || current || !companyId.trim()}
                  onClick={() => void assign(tier.key)}
                >
                  {busy === tier.key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {current ? 'Current plan' : `Assign ${tier.name}`}
                </Button>
              ) : (
                <div className={`mt-6 text-center text-xs ${tier.recommended ? 'text-mist' : 'text-ink-faint'}`}>
                  {current ? 'Your current plan' : 'Contact your account manager to change plans'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
