'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CompanySummary } from '@certiflow/shared';
import { inferSmtpPreset } from '@/lib/smtp-detect';
import { getSmtpHelp } from '@/lib/smtp-help';

type EmailSettingsResponse = {
  company: {
    companyId: string;
    companyName: string;
  };
  settings: {
    companyId: string;
    senderName: string | null;
    senderEmail: string | null;
    smtpHost: string | null;
    smtpPort: number | null;
    smtpSecure: boolean | null;
    smtpAllowInvalidCerts: boolean | null;
    smtpUser: string | null;
    enabled: boolean | null;
    updatedAt: string | null;
  } | null;
};

type MeResponse = {
  user: {
    role: 'super_admin' | 'company_admin';
    companyId: string | null;
  };
};

type CompaniesResponse = {
  companies: CompanySummary[];
};

type SenderStatus = 'ready' | 'incomplete' | 'not-configured';

function normalizeSmtpSecure(
  portValue: string,
  currentSecure: boolean,
) {
  const port = Number(portValue);

  if (port === 465) {
    return true;
  }

  if (port === 587) {
    return false;
  }

  return currentSecure;
}

function hasSavedPassword(lastUpdated: string | null) {
  return Boolean(lastUpdated);
}

function formatDate(dateValue: string | null) {
  if (!dateValue) {
    return 'Never';
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function StatusBadge({ status }: { status: SenderStatus }) {
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Ready to send
      </span>
    );
  }

  if (status === 'incomplete') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Setup incomplete
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
      <span className="h-2 w-2 rounded-full bg-red-500" />
      Not configured
    </span>
  );
}

export function SenderSettingsClient({
  initialCompanyId,
}: {
  initialCompanyId: string;
}) {
  const [role, setRole] =
    useState<MeResponse['user']['role'] | null>(null);

  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [companyName, setCompanyName] = useState('');

  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpAllowInvalidCerts, setSmtpAllowInvalidCerts] =
    useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [lastUpdated, setLastUpdated] =
    useState<string | null>(null);

  const selectedCompany = useMemo(
    () =>
      companies.find(
        (company) => company.companyId === companyId,
      ) ?? null,
    [companies, companyId],
  );

  const filteredCompanies = useMemo(() => {
    const term = companySearch.trim().toLowerCase();

    if (!term) {
      return companies;
    }

    return companies.filter(
      (company) =>
        company.companyName.toLowerCase().includes(term) ||
        company.companyId.toLowerCase().includes(term),
    );
  }, [companies, companySearch]);

  const preset = inferSmtpPreset(smtpHost);

  const isConfigComplete = Boolean(
    senderEmail.trim() &&
      smtpHost.trim() &&
      smtpUser.trim() &&
      (smtpPass.trim() || hasSavedPassword(lastUpdated)),
  );

  const senderStatus: SenderStatus = lastUpdated
    ? isConfigComplete
      ? 'ready'
      : 'incomplete'
    : 'not-configured';

  const smtpHelp = message ? getSmtpHelp(message) : null;
  const hasErrorHelp = Boolean(smtpHelp);

  const completedSteps = [
    Boolean(senderName.trim() && senderEmail.trim()),
    Boolean(smtpHost.trim() && smtpPort.trim()),
    Boolean(
      smtpUser.trim() &&
        (smtpPass.trim() || hasSavedPassword(lastUpdated)),
    ),
  ].filter(Boolean).length;

  const loadSettings = async (
    targetCompanyId = companyId,
  ) => {
    const resolvedCompanyId = targetCompanyId.trim();

    if (!resolvedCompanyId) {
      setMessage('Choose a company first.');
      setLoading(false);
      return;
    }

    setCompanyId(resolvedCompanyId);
    setLoading(true);
    setMessage('');

    try {
      const url =
        `/companies/email-settings?companyId=${encodeURIComponent(
          resolvedCompanyId,
        )}`;

      const response =
        await apiFetch<EmailSettingsResponse>(url);

      setCompanyName(response.company.companyName);

      setSenderName(
        response.settings?.senderName ??
          response.company.companyName ??
          '',
      );

      setSenderEmail(response.settings?.senderEmail ?? '');
      setSmtpHost(response.settings?.smtpHost ?? '');

      const nextSmtpPort = String(
        response.settings?.smtpPort ?? 587,
      );

      setSmtpPort(nextSmtpPort);

      setSmtpSecure(
        normalizeSmtpSecure(
          nextSmtpPort,
          Boolean(response.settings?.smtpSecure),
        ),
      );

      setSmtpAllowInvalidCerts(
        Boolean(response.settings?.smtpAllowInvalidCerts),
      );

      setSmtpUser(response.settings?.smtpUser ?? '');
      setSmtpPass('');
      setLastUpdated(response.settings?.updatedAt ?? null);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load email settings.',
      );
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async (
    preferredCompanyId = initialCompanyId,
  ) => {
    setLoading(true);
    setMessage('');

    try {
      const response =
        await apiFetch<CompaniesResponse>('/companies');

      setCompanies(response.companies);

      const nextCompany =
        response.companies.find(
          (company) =>
            company.companyId === preferredCompanyId.trim(),
        ) ??
        response.companies.find(
          (company) => company.companyId === companyId,
        ) ??
        response.companies[0] ??
        null;

      if (!nextCompany) {
        setMessage('No companies are available yet.');
        setLoading(false);
        return;
      }

      setCompanyId(nextCompany.companyId);
      await loadSettings(nextCompany.companyId);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load companies.',
      );

      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    apiFetch<MeResponse>('/auth/me')
      .then((data) => {
        if (!active) {
          return;
        }

        setRole(data.user.role);

        if (data.user.role !== 'super_admin') {
          const userCompanyId = data.user.companyId ?? '';

          setCompanyId(userCompanyId);
          void loadSettings(userCompanyId);
          return;
        }

        void loadCompanies(initialCompanyId);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : 'Failed to load sender access.',
        );

        setLoading(false);
      });

    return () => {
      active = false;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCompanyId]);

  const saveSettings = async () => {
    const resolvedCompanyId = companyId.trim();

    if (role === 'super_admin' && !resolvedCompanyId) {
      setMessage('Select a company before saving.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const url = resolvedCompanyId
        ? `/companies/email-settings?companyId=${encodeURIComponent(
            resolvedCompanyId,
          )}`
        : '/companies/email-settings';

      await apiFetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderName: senderName.trim() || undefined,
          senderEmail: senderEmail.trim(),
          smtpHost: smtpHost.trim(),
          smtpPort: Number(smtpPort),
          smtpSecure,
          smtpAllowInvalidCerts,
          smtpUser: smtpUser.trim(),
          smtpPass: smtpPass.trim() || undefined,
          enabled: isConfigComplete,
        }),
      });

      setMessage(
        isConfigComplete
          ? 'Sender settings saved successfully. Your sender is ready to use.'
          : 'Settings were saved, but some required fields are still missing.',
      );

      setSmtpPass('');
      await loadSettings(resolvedCompanyId);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to save sender settings.',
      );
    } finally {
      setSaving(false);
    }
  };

  const testSettings = async () => {
    const resolvedCompanyId = companyId.trim();

    if (role === 'super_admin' && !resolvedCompanyId) {
      setMessage('Select a company before testing SMTP.');
      return;
    }

    setTesting(true);
    setMessage('');

    try {
      const url = resolvedCompanyId
        ? `/companies/email-settings/test?companyId=${encodeURIComponent(
            resolvedCompanyId,
          )}`
        : '/companies/email-settings/test';

      const response = await apiFetch<{
        ok: boolean;
        message: string;
      }>(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      setMessage(response.message);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to test SMTP settings.',
      );
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-72 animate-pulse rounded-[32px] bg-slate-200/70" />

        <div className="grid gap-6 xl:grid-cols-[0.7fr,1.3fr]">
          <div className="h-96 animate-pulse rounded-[30px] bg-white" />
          <div className="h-96 animate-pulse rounded-[30px] bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0f172a] via-[#122b51] to-[#075985] p-6 text-white shadow-[0_28px_75px_rgba(15,23,42,0.18)] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 left-1/3 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />

        <div className="pointer-events-none absolute right-12 top-8 hidden h-40 w-56 rotate-3 rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur xl:block">
          <Mail className="h-8 w-8 text-cyan-300" />
          <div className="mt-5 h-2 w-24 rounded-full bg-white/20" />
          <div className="mt-3 h-2 w-36 rounded-full bg-white/10" />

          <div className="mt-5 flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="h-2 w-20 rounded-full bg-emerald-300/30" />
          </div>
        </div>

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.15em] text-cyan-100 backdrop-blur">
              <Mail className="h-4 w-4 text-cyan-300" />
              Email sender
            </div>

            <h1 className="mt-6 max-w-3xl text-3xl font-bold leading-[1.08] tracking-[-0.04em] sm:text-4xl lg:text-5xl">
              Send from your company,
              <span className="text-cyan-300">
                {' '}
                with confidence.
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Connect your organisation&apos;s mailbox, verify the SMTP
              connection, and give every message a trusted sender
              identity.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <StatusBadge status={senderStatus} />

              {companyName && (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                  <Building2 className="h-3.5 w-3.5 text-cyan-300" />
                  {companyName}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">
              Setup progress
            </p>

            <div className="mt-3 flex items-center gap-2">
              {[1, 2, 3].map((step) => (
                <span
                  key={step}
                  className={`h-2 w-12 rounded-full ${
                    completedSteps >= step
                      ? 'bg-emerald-400'
                      : 'bg-white/15'
                  }`}
                />
              ))}
            </div>

            <p className="mt-3 text-xs text-slate-300">
              {completedSteps} of 3 sections completed
            </p>
          </div>
        </div>
      </section>

      {/* Message */}
      {message && (
        <div
          className={`flex items-start gap-3 rounded-[24px] border p-4 ${
            hasErrorHelp
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-blue-100 bg-blue-50 text-blue-800'
          }`}
        >
          {hasErrorHelp ? (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          )}

          <div className="flex-1">
            <p className="text-sm font-semibold leading-6">
              {message}
            </p>

            {smtpHelp && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-white/90 p-4 text-sm text-slate-700">
                <p className="font-bold text-slate-950">
                  {smtpHelp.title}
                </p>

                <p className="mt-1 leading-6">
                  {smtpHelp.description}
                </p>

                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-slate-600">
                  {smtpHelp.fixes.map((fix) => (
                    <li key={fix}>{fix}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMessage('')}
            aria-label="Dismiss message"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Super-admin company picker */}
      {role === 'super_admin' && (
        <section className="rounded-[30px] border border-white/90 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                Company sender
              </p>

              <h2 className="mt-1 text-2xl font-bold text-slate-950">
                Choose a company to configure
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Select which company&apos;s sender credentials you want
                to manage.
              </p>
            </div>

            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="search"
                value={companySearch}
                onChange={(event) =>
                  setCompanySearch(event.target.value)
                }
                placeholder="Search company or ID..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="mt-5 grid max-h-64 gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
            {filteredCompanies.map((company) => {
              const selected =
                company.companyId === selectedCompany?.companyId;

              return (
                <button
                  key={company.companyId}
                  type="button"
                  onClick={() =>
                    void loadSettings(company.companyId)
                  }
                  className={`rounded-[20px] border p-4 text-left transition ${
                    selected
                      ? 'border-blue-400 bg-blue-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        selected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Building2 className="h-5 w-5" />
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-950">
                        {company.companyName}
                      </p>

                      <p className="mt-1 truncate text-[11px] text-slate-500">
                        {company.companyId}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[0.7fr,1.3fr] xl:items-start">
        {/* Setup guidance */}
        <aside className="space-y-5">
          <section className="rounded-[30px] border border-white/90 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Sparkles className="h-5 w-5" />
              </span>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
                  Quick setup
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Connect in three steps
                </h2>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                    senderName && senderEmail
                      ? 'bg-emerald-500 text-white'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {senderName && senderEmail ? '✓' : '1'}
                </span>

                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Add sender identity
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Enter the name and email recipients should see.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                    smtpHost && smtpPort
                      ? 'bg-emerald-500 text-white'
                      : 'bg-cyan-100 text-cyan-700'
                  }`}
                >
                  {smtpHost && smtpPort ? '✓' : '2'}
                </span>

                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Configure the server
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Add the SMTP host, port, and security settings.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                    smtpUser &&
                    (smtpPass || hasSavedPassword(lastUpdated))
                      ? 'bg-emerald-500 text-white'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {smtpUser &&
                  (smtpPass || hasSavedPassword(lastUpdated))
                    ? '✓'
                    : '3'}
                </span>

                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Save and test
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Save your credentials, then test the connection.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[30px] bg-gradient-to-br from-slate-950 to-blue-950 p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
            <ShieldCheck className="h-7 w-7 text-emerald-300" />

            <h2 className="mt-4 text-xl font-bold">
              Your credentials stay protected
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              The saved password is never displayed again. Leave the
              password field empty when editing to keep the existing
              password.
            </p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/10 p-3">
              <p className="text-xs text-slate-300">
                Last updated
              </p>

              <p className="mt-1 text-sm font-bold">
                {formatDate(lastUpdated)}
              </p>
            </div>
          </section>
        </aside>

        {/* Settings form */}
        <section className="overflow-hidden rounded-[30px] border border-white/90 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 p-5 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                  Sender configuration
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  {senderName || companyName || 'Company sender'}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Complete the required fields, save, and test your SMTP
                  connection.
                </p>
              </div>

              <StatusBadge status={senderStatus} />
            </div>
          </div>

          <div className="space-y-7 p-5 sm:p-7">
            {/* Sender identity */}
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <User className="h-5 w-5" />
                </span>

                <div>
                  <h3 className="text-lg font-bold text-slate-950">
                    Sender identity
                  </h3>

                  <p className="text-xs text-slate-500">
                    What recipients will see in their inbox
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Sender name
                  </span>

                  <Input
                    value={senderName}
                    onChange={(event) =>
                      setSenderName(event.target.value)
                    }
                    placeholder="CertiFlow HR"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Sender email
                  </span>

                  <Input
                    type="email"
                    value={senderEmail}
                    onChange={(event) =>
                      setSenderEmail(event.target.value)
                    }
                    placeholder="no-reply@company.com"
                  />
                </label>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* SMTP server */}
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <Server className="h-5 w-5" />
                </span>

                <div>
                  <h3 className="text-lg font-bold text-slate-950">
                    SMTP server
                  </h3>

                  <p className="text-xs text-slate-500">
                    Connection details supplied by your email provider
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-[1fr,180px]">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    SMTP host
                  </span>

                  <Input
                    value={smtpHost}
                    onChange={(event) => {
                      const nextHost = event.target.value;

                      setSmtpHost(nextHost);

                      const nextPreset =
                        inferSmtpPreset(nextHost);

                      if (nextPreset) {
                        setSmtpPort(String(nextPreset.port));
                        setSmtpSecure(nextPreset.secure);
                      }
                    }}
                    placeholder="smtp.gmail.com"
                  />

                  {preset && (
                    <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
                      <strong>{preset.provider}:</strong>{' '}
                      {preset.note}
                    </p>
                  )}
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    SMTP port
                  </span>

                  <Input
                    type="number"
                    min="1"
                    value={smtpPort}
                    onChange={(event) => {
                      const nextPort = event.target.value;

                      setSmtpPort(nextPort);

                      setSmtpSecure((current) =>
                        normalizeSmtpSecure(
                          nextPort,
                          current,
                        ),
                      );
                    }}
                    placeholder="587"
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-[20px] border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200">
                  <input
                    type="checkbox"
                    checked={smtpSecure}
                    onChange={(event) =>
                      setSmtpSecure(event.target.checked)
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />

                  <span>
                    <span className="block text-sm font-bold text-slate-900">
                      Use a secure TLS/SSL connection
                    </span>

                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      Enable for port 465. Keep disabled for port 587,
                      which normally uses STARTTLS.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-[20px] border border-slate-200 bg-slate-50 p-4 transition hover:border-amber-200">
                  <input
                    type="checkbox"
                    checked={smtpAllowInvalidCerts}
                    onChange={(event) =>
                      setSmtpAllowInvalidCerts(
                        event.target.checked,
                      )
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />

                  <span>
                    <span className="block text-sm font-bold text-slate-900">
                      Allow invalid certificates
                    </span>

                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      Use only for a self-signed or internally issued
                      SMTP certificate.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Credentials */}
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <KeyRound className="h-5 w-5" />
                </span>

                <div>
                  <h3 className="text-lg font-bold text-slate-950">
                    SMTP credentials
                  </h3>

                  <p className="text-xs text-slate-500">
                    Username and app password for this mailbox
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    SMTP username
                  </span>

                  <Input
                    value={smtpUser}
                    onChange={(event) =>
                      setSmtpUser(event.target.value)
                    }
                    placeholder="sender@company.com"
                  />
                </label>

                <label className="space-y-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    SMTP password
                    {lastUpdated && (
                      <Badge tone="green">Saved</Badge>
                    )}
                  </span>

                  <Input
                    type="password"
                    value={smtpPass}
                    onChange={(event) =>
                      setSmtpPass(event.target.value)
                    }
                    placeholder={
                      lastUpdated
                        ? 'Leave blank to keep saved password'
                        : 'App password or SMTP password'
                    }
                  />
                </label>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                For Gmail or Microsoft accounts, you may need an app
                password instead of your normal account password.
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-slate-100 bg-slate-50/70 p-5 sm:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-2 text-sm text-slate-600">
                {isConfigComplete ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                )}

                <span>
                  {isConfigComplete
                    ? 'All required fields are complete. Save and test your connection.'
                    : 'Complete the required sender, server, and credential fields.'}
                </span>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="secondary"
                  onClick={() => void testSettings()}
                  disabled={
                    testing ||
                    (role === 'super_admin' &&
                      !companyId.trim())
                  }
                >
                  {testing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}

                  {testing ? 'Testing...' : 'Test SMTP'}
                </Button>

                <Button
                  onClick={() => void saveSettings()}
                  disabled={
                    saving ||
                    (role === 'super_admin' &&
                      !companyId.trim())
                  }
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}

                  {saving ? 'Saving...' : 'Save sender'}
                </Button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadSettings(companyId)}
              className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-blue-700 transition hover:text-blue-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload saved settings
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}