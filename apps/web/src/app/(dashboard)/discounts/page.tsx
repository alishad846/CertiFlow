'use client';

import { useEffect, useState } from 'react';
import { Crown, RefreshCw } from 'lucide-react';
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
    return <Card>Loading discounts</Card>;
  }

  if (!user) {
    return <Card>Unable to load discount data.</Card>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="max-w-3xl">
          <p className="eyebrow">Discounts</p>
          <h2 className="mt-3 font-serif text-4xl tracking-tight text-ink">
            Super admin controls company pricing discounts.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-soft">
            Apply a discount specific to this company, keep a note for finance, and the billing flow will automatically use the discounted amount.
          </p>
        </div>
      </Card>

      {message ? (
        <p className="rounded-2xl border border-[color:var(--color-border)] bg-paper/50 px-4 py-3 text-sm text-ink-soft">{message}</p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Companies</p>
              <h3 className="mt-2 font-serif text-2xl text-ink">Current discount setup</h3>
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
                    active
                      ? 'border-bronze bg-bronze/5 shadow-[0_16px_40px_-24px_rgba(148,112,63,0.5)]'
                      : 'border-[color:var(--color-border)] bg-paper-bright hover:border-bronze/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-serif text-lg text-ink">{company.companyName}</p>
                      <p className="mt-1 text-sm text-ink-soft">{company.creditsRemaining.toLocaleString('en-IN')} credits remaining</p>
                    </div>
                    <Badge tone={company.discountPercent > 0 ? 'blue' : 'slate'}>{company.discountPercent}% off</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-ink-soft">{company.note || 'No note set yet.'}</p>
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-bronze/25 bg-bronze/10 text-bronze-deep">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <p className="eyebrow">Edit discount</p>
              <h3 className="mt-2 font-serif text-2xl text-ink">Set a discount for this company</h3>
            </div>
          </div>

          {user.role !== 'super_admin' ? (
            <div className="mt-6 rounded-[24px] border border-[color:var(--color-border)] bg-paper/50 p-5 text-sm text-ink-soft">
              Only super admins can change discounts. You can still view the current discount for your company.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-ink-soft">Company</label>
                <select
                  value={selectedCompanyId}
                  onChange={(event) => void handleCompanySelect(event.target.value)}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-paper-bright px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze focus:ring-4 focus:ring-bronze/15"
                >
                  {companies.map((company) => (
                    <option key={company.companyId} value={company.companyId}>
                      {company.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-ink-soft">Discount percent</label>
                <select
                  value={discountPercent}
                  onChange={(event) => setDiscountPercent(event.target.value)}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-paper-bright px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze focus:ring-4 focus:ring-bronze/15"
                >
                  {PRICING_RULES.allowedDiscountPercents.map((value) => (
                    <option key={value} value={value}>
                      {value}%
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-ink-faint">
                  Strict rule: only {PRICING_RULES.allowedDiscountPercents.join('%, ')}% steps are allowed.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-ink-soft">Finance note</label>
                <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Quarterly support discount" />
              </div>

              <Button type="button" onClick={handleSave} disabled={saving || !selectedCompanyId} className="w-full">
                Save discount
              </Button>
            </div>
          )}

          {selectedCompany ? (
            <div className="mt-6 rounded-[24px] border border-[color:var(--color-border)] bg-paper/50 p-5">
              <p className="eyebrow">Preview</p>
              <div className="mt-2 font-serif text-2xl text-ink">
                {selectedCompany.discountPercent}% off for {selectedCompany.companyName}
              </div>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                The billing page will apply this discount automatically to any new UPI request created for this company.
              </p>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
