'use client';

import { useEffect, useState } from 'react';
import { Crown, Percent, RefreshCw, ShieldCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PRICING_RULES, type CompanyDiscountRecord, type UserRole } from '@certiflow/shared';

type MeResponse = {
  user: {
    id: string;
    companyId: string | null;
    role: UserRole;
    email: string;
    name: string;
  };
};

export default function DiscountsPage() {
  const [user, setUser] = useState<MeResponse['user'] | null>(null);
  const [companies, setCompanies] = useState<CompanyDiscountRecord[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadData = async (targetCompanyId?: string) => {
    const me = await apiFetch<MeResponse>('/auth/me');
    const response = await apiFetch<{ companies: CompanyDiscountRecord[] }>(
      me.user.role === 'super_admin' && targetCompanyId
        ? `/billing/discounts?companyId=${encodeURIComponent(targetCompanyId)}`
        : '/billing/discounts'
    );

    setUser(me.user);
    setCompanies(response.companies);

    if (me.user.role === 'super_admin') {
      const preferred = targetCompanyId && response.companies.some((company) => company.companyId === targetCompanyId)
        ? targetCompanyId
        : response.companies[0]?.companyId ?? '';
      setSelectedCompanyId(preferred);
      const selected = response.companies.find((company) => company.companyId === preferred) ?? response.companies[0];
      setDiscountPercent(String(selected?.discountPercent ?? 0));
      setNote(selected?.note ?? '');
    } else {
      const current = response.companies[0];
      setSelectedCompanyId(current?.companyId ?? '');
      setDiscountPercent(String(current?.discountPercent ?? 0));
      setNote(current?.note ?? '');
    }
  };

  useEffect(() => {
    loadData()
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Failed to load discounts');
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedCompany = companies.find((company) => company.companyId === selectedCompanyId) ?? companies[0];

  const handleCompanySelect = async (companyId: string) => {
    setSelectedCompanyId(companyId);
    const selected = companies.find((company) => company.companyId === companyId);
    setDiscountPercent(String(selected?.discountPercent ?? 0));
    setNote(selected?.note ?? '');
  };

  const handleSave = async () => {
    if (!selectedCompanyId) {
      setMessage('Please select a company first.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      await apiFetch('/billing/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: selectedCompanyId,
          discountPercent: Number(discountPercent),
          note
        })
      });
      setMessage('Discount saved successfully.');
      await loadData(selectedCompanyId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save discount');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Card>Loading discounts...</Card>;
  }

  if (!user) {
    return <Card>Unable to load discount data.</Card>;
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.03),rgba(42,141,240,0.05))]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Discounts</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink md:text-4xl">
              Super admin controls company pricing discounts.
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Apply company-specific discount percentages, keep a note for finance, and the billing flow will automatically use the discounted amount.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">
              <span className="inline-flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Percent discounts
              </span>
            </Badge>
            <Badge tone="green">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Super admin only
              </span>
            </Badge>
          </div>
        </div>
      </Card>

      {message ? <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{message}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <Card className="border-white/80">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">Companies</p>
              <h3 className="mt-1 text-2xl font-bold tracking-tight text-ink">Current discount setup</h3>
            </div>
            <Button type="button" variant="secondary" onClick={() => loadData(selectedCompanyId)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          <div className="mt-6 space-y-3">
            {companies.map((company) => {
              const active = company.companyId === selectedCompanyId;
              return (
                <button
                  key={company.companyId}
                  type="button"
                  onClick={() => void handleCompanySelect(company.companyId)}
                  className={`w-full rounded-[24px] border p-4 text-left transition ${
                    active ? 'border-accent-400 bg-accent-50 shadow-[0_16px_40px_rgba(42,141,240,0.12)]' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{company.companyName}</p>
                      <p className="mt-1 text-sm text-slate-500">{company.creditsRemaining.toLocaleString('en-IN')} credits remaining</p>
                    </div>
                    <Badge tone={company.discountPercent > 0 ? 'blue' : 'slate'}>{company.discountPercent}% off</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{company.note || 'No note set yet.'}</p>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="border-white/80">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(42,141,240,0.14),rgba(42,141,240,0.05))] text-accent-700">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Edit discount</p>
              <h3 className="mt-1 text-2xl font-bold tracking-tight text-ink">Set a company-specific discount</h3>
            </div>
          </div>

          {user.role !== 'super_admin' ? (
            <div className="mt-6 rounded-[24px] bg-slate-50 p-5 text-sm text-slate-600">
              Only super admins can change discounts. You can still view the current discount for your company.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Company</label>
                <select
                  value={selectedCompanyId}
                  onChange={(event) => void handleCompanySelect(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent-400 focus:ring-4 focus:ring-accent-100"
                >
                  {companies.map((company) => (
                    <option key={company.companyId} value={company.companyId}>
                      {company.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Discount percent</label>
                <select
                  value={discountPercent}
                  onChange={(event) => setDiscountPercent(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent-400 focus:ring-4 focus:ring-accent-100"
                >
                  {PRICING_RULES.allowedDiscountPercents.map((value) => (
                    <option key={value} value={value}>
                      {value}%
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-500">
                  Strict rule: only {PRICING_RULES.allowedDiscountPercents.join('%, ')}% steps are allowed.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Finance note</label>
                <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Quarterly support discount" />
              </div>

              <Button type="button" onClick={handleSave} disabled={saving || !selectedCompanyId} className="w-full">
                Save discount
              </Button>
            </div>
          )}

          {selectedCompany ? (
            <div className="mt-6 rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-500">Preview</p>
              <div className="mt-2 text-2xl font-bold text-ink">
                {selectedCompany.discountPercent}% off for {selectedCompany.companyName}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The billing page will apply this discount automatically to any new UPI request created for this company.
              </p>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
