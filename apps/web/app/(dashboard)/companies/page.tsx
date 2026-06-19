'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, CheckCircle2, Loader2, ShieldAlert, Trash2, Unlock, UserCog } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { CompanySummary } from '@certiflow/shared';

type MeResponse = {
  user: {
    role: 'super_admin' | 'company_admin';
  };
};

type CompaniesResponse = {
  companies: CompanySummary[];
};

type CompanyPermissionsDraft = {
  canCreateBatches: boolean;
  canRequestUpi: boolean;
  canViewReports: boolean;
};

const permissionLabels: Array<{ key: keyof CompanyPermissionsDraft; title: string; description: string }> = [
  { key: 'canCreateBatches', title: 'Batch uploads', description: 'Allow the company admin to create generation batches.' },
  { key: 'canRequestUpi', title: 'Billing requests', description: 'Allow UPI top-up requests from the billing screen.' },
  { key: 'canViewReports', title: 'Reports access', description: 'Allow access to dashboard stats and logs.' }
];

function statusTone(status: CompanySummary['status']) {
  return status === 'active' ? 'green' : 'red';
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [draft, setDraft] = useState<CompanyPermissionsDraft>({
    canCreateBatches: true,
    canRequestUpi: true,
    canViewReports: true
  });
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const selectedCompany = useMemo(
    () => companies.find((company) => company.companyId === selectedCompanyId) ?? companies[0] ?? null,
    [companies, selectedCompanyId]
  );

  const syncDraft = (company: CompanySummary | null) => {
    if (!company) {
      setDraft({ canCreateBatches: true, canRequestUpi: true, canViewReports: true });
      setReason('');
      return;
    }

    setDraft({
      canCreateBatches: company.canCreateBatches,
      canRequestUpi: company.canRequestUpi,
      canViewReports: company.canViewReports
    });
    setReason(company.blockedReason ?? '');
  };

  const loadCompanies = async () => {
    setLoading(true);
    setMessage('');
    try {
      const me = await apiFetch<MeResponse>('/auth/me');
      if (me.user.role !== 'super_admin') {
        throw new Error('This page is only available to super admins.');
      }

      const response = await apiFetch<CompaniesResponse>('/companies');
      setCompanies(response.companies);
      const nextSelected = response.companies.find((company) => company.companyId === selectedCompanyId) ?? response.companies[0] ?? null;
      if (nextSelected) {
        setSelectedCompanyId(nextSelected.companyId);
        syncDraft(nextSelected);
      }
    } catch (error) {
      const fallbackMessage = error instanceof Error ? error.message : 'Failed to load companies';
      setMessage(fallbackMessage === 'Forbidden' ? 'This page is only available to super admins.' : fallbackMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    syncDraft(selectedCompany);
  }, [selectedCompany]);

  const updateSelectedCompany = async (companyId: string) => {
    setSelectedCompanyId(companyId);
    const company = companies.find((entry) => entry.companyId === companyId) ?? null;
    syncDraft(company);
  };

  const savePermissions = async () => {
    if (!selectedCompany) {
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      await apiFetch(`/companies/${selectedCompany.companyId}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      });
      setMessage('Permissions updated successfully.');
      await loadCompanies();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const blockCompany = async () => {
    if (!selectedCompany) {
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      await apiFetch(`/companies/${selectedCompany.companyId}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined })
      });
      setMessage('Company access blocked.');
      await loadCompanies();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to block company');
    } finally {
      setSaving(false);
    }
  };

  const unblockCompany = async () => {
    if (!selectedCompany) {
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      await apiFetch(`/companies/${selectedCompany.companyId}/unblock`, {
        method: 'POST'
      });
      setMessage('Company access restored.');
      await loadCompanies();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to unblock company');
    } finally {
      setSaving(false);
    }
  };

  const deleteCompany = async () => {
    if (!selectedCompany) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedCompany.companyName}? This removes the company and all of its data permanently.`
    );
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      await apiFetch(`/companies/${selectedCompany.companyId}`, { method: 'DELETE' });
      setMessage('Company deleted.');
      setSelectedCompanyId('');
      await loadCompanies();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete company');
    } finally {
      setSaving(false);
    }
  };

  const totalCredits = companies.reduce((sum, company) => sum + company.creditsRemaining, 0);
  const blockedCount = companies.filter((company) => company.status === 'blocked').length;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200/70 bg-slate-950 p-0 text-white">
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.3),transparent_32%),radial-gradient(circle_at_left,rgba(255,255,255,0.12),transparent_24%)] px-7 py-8 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <Badge tone="blue" className="bg-white/10 text-white">
                Super admin control
              </Badge>
              <h1 className="mt-4 text-4xl font-bold tracking-tight">Companies, permissions, and access in one place.</h1>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Block a company, fine-tune permissions, or delete it permanently. This screen keeps the control flow simple
                for fast admin operations.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Companies</p>
                <p className="mt-2 text-2xl font-bold">{companies.length}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Blocked</p>
                <p className="mt-2 text-2xl font-bold">{blockedCount}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Credits</p>
                <p className="mt-2 text-2xl font-bold">{totalCredits.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {message ? (
        <div className="rounded-3xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm font-medium text-sky-800">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">Company list</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">Pick a company to manage</h2>
            </div>
            <Button variant="secondary" onClick={() => void loadCompanies()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                Loading companies...
              </div>
            ) : companies.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                No companies found.
              </div>
            ) : (
              companies.map((company) => {
                const active = company.companyId === selectedCompanyId;
                return (
                  <button
                    key={company.companyId}
                    onClick={() => void updateSelectedCompany(company.companyId)}
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      active
                        ? 'border-slate-950 bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.2)]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Building2 className={`h-4 w-4 ${active ? 'text-sky-200' : 'text-slate-500'}`} />
                          <p className="font-semibold">{company.companyName}</p>
                        </div>
                        <p className={`mt-1 text-sm ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                          {company.creditsRemaining.toLocaleString('en-IN')} credits · {company.userCount} admins · {company.batchCount} batches
                        </p>
                      </div>
                      <Badge tone={statusTone(company.status)}>{company.status}</Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge tone={company.canCreateBatches ? 'green' : 'slate'}>Uploads {company.canCreateBatches ? 'on' : 'off'}</Badge>
                      <Badge tone={company.canRequestUpi ? 'blue' : 'slate'}>Billing {company.canRequestUpi ? 'on' : 'off'}</Badge>
                      <Badge tone={company.canViewReports ? 'amber' : 'slate'}>Reports {company.canViewReports ? 'on' : 'off'}</Badge>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <Card className="p-6">
          {selectedCompany ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <UserCog className="h-5 w-5 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-500">Selected company</p>
                  </div>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink">{selectedCompany.companyName}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    UUID: <span className="font-mono text-slate-700">{selectedCompany.companyId}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={statusTone(selectedCompany.status)}>{selectedCompany.status}</Badge>
                  <Badge tone="blue">{selectedCompany.creditsRemaining.toLocaleString('en-IN')} credits</Badge>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admins</p>
                  <p className="mt-2 text-2xl font-bold text-ink">{selectedCompany.userCount}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Batches</p>
                  <p className="mt-2 text-2xl font-bold text-ink">{selectedCompany.batchCount}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Payments</p>
                  <p className="mt-2 text-2xl font-bold text-ink">{selectedCompany.paymentCount}</p>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-slate-500" />
                  <p className="text-sm font-semibold text-slate-700">Access controls</p>
                </div>

                <div className="mt-4 space-y-3">
                  {permissionLabels.map((item) => {
                    const enabled = draft[item.key];
                    return (
                      <div key={item.key} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3">
                        <div>
                          <p className="font-semibold text-ink">{item.title}</p>
                          <p className="text-sm text-slate-500">{item.description}</p>
                        </div>
                        <Button
                          variant={enabled ? 'primary' : 'secondary'}
                          onClick={() => setDraft((current) => ({ ...current, [item.key]: !current[item.key] }))}
                        >
                          {enabled ? 'Enabled' : 'Disabled'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-700">Block reason</p>
                <div className="mt-3">
                  <Input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Optional reason for blocking access"
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Blocking a company immediately revokes its sessions. Delete permanently removes the company and its data.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => void savePermissions()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Save permissions
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/sender?companyId=${encodeURIComponent(selectedCompany.companyId)}`}>
                    Manage sender
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                {selectedCompany.status === 'active' ? (
                  <Button variant="secondary" onClick={() => void blockCompany()} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
                    Block company
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => void unblockCompany()} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlock className="mr-2 h-4 w-4" />}
                    Unblock company
                  </Button>
                )}
                <Button variant="ghost" onClick={() => void deleteCompany()} disabled={saving} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete company
                </Button>
              </div>
            </>
          ) : (
            <div className="flex min-h-[32rem] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 text-slate-500">
              Select a company to manage permissions and access.
            </div>
          )}
        </Card>
      </div>

      <Card className="bg-slate-950 p-6 text-white">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-200">Easy mode</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight">Everything important is on one screen.</h3>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Super admin can block, restore, change permissions, or delete companies without hunting through multiple menus.
            </p>
          </div>
          <Button asChild>
            <Link href="/discounts">
              Manage discounts
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
