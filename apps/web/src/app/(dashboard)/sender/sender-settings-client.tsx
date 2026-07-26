'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

function normalizeSmtpSecure(portValue: string, currentSecure: boolean) {
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

export function SenderSettingsClient({ initialCompanyId }: { initialCompanyId: string }) {
  const [role, setRole] = useState<MeResponse['user']['role'] | null>(null);
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpAllowInvalidCerts, setSmtpAllowInvalidCerts] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const selectedCompany = useMemo(
    () => companies.find((company) => company.companyId === companyId) ?? null,
    [companies, companyId]
  );
  const filteredCompanies = useMemo(() => {
    const term = companySearch.trim().toLowerCase();
    if (!term) {
      return companies;
    }

    return companies.filter(
      (company) =>
        company.companyName.toLowerCase().includes(term) || company.companyId.toLowerCase().includes(term)
    );
  }, [companies, companySearch]);
  const preset = inferSmtpPreset(smtpHost);
  const isConfigComplete = Boolean(
    senderEmail.trim() &&
      smtpHost.trim() &&
      smtpUser.trim() &&
      (smtpPass.trim() || hasSavedPassword(lastUpdated))
  );
  const senderStatus = lastUpdated ? (isConfigComplete ? 'ready' : 'disabled') : 'not-configured';
  const smtpHelp = message ? getSmtpHelp(message) : null;
  const hasErrorHelp = Boolean(smtpHelp);

  const loadSettings = async (targetCompanyId = companyId) => {
    const resolvedCompanyId = targetCompanyId.trim();
    if (!resolvedCompanyId) {
      setMessage('Choose a company first.');
      return;
    }

    setCompanyId(resolvedCompanyId);
    setLoading(true);
    setMessage('');
    try {
      const url = `/companies/email-settings?companyId=${encodeURIComponent(resolvedCompanyId)}`;
      const response = await apiFetch<EmailSettingsResponse>(url);
      setCompanyName(response.company.companyName);
      setSenderName(response.settings?.senderName ?? response.company.companyName ?? '');
      setSenderEmail(response.settings?.senderEmail ?? '');
      const nextSmtpPort = String(response.settings?.smtpPort ?? 587);
      setSmtpHost(response.settings?.smtpHost ?? '');
      setSmtpPort(nextSmtpPort);
      setSmtpSecure(normalizeSmtpSecure(nextSmtpPort, Boolean(response.settings?.smtpSecure)));
      setSmtpAllowInvalidCerts(Boolean(response.settings?.smtpAllowInvalidCerts));
      setSmtpUser(response.settings?.smtpUser ?? '');
      setLastUpdated(response.settings?.updatedAt ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load email settings');
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async (preferredCompanyId = initialCompanyId) => {
    setLoading(true);
    setMessage('');
    try {
      const response = await apiFetch<CompaniesResponse>('/companies');
      setCompanies(response.companies);
      const nextCompany =
        response.companies.find((company) => company.companyId === preferredCompanyId.trim()) ??
        response.companies.find((company) => company.companyId === companyId) ??
        response.companies[0] ??
        null;

      if (!nextCompany) {
        setLoading(false);
        setMessage('No companies are available yet.');
        return;
      }

      setCompanyId(nextCompany.companyId);
      await loadSettings(nextCompany.companyId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load companies');
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
          const company = data.user.companyId ?? '';
          setCompanyId(company);
          void loadSettings(company);
          return;
        }
        void loadCompanies(initialCompanyId);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setMessage(error instanceof Error ? error.message : 'Failed to load sender access');
        setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCompanyId]);

  const saveSettings = async () => {
    setSaving(true);
    setMessage('');
    try {
      const resolvedCompanyId = companyId.trim();
      const url = resolvedCompanyId
        ? `/companies/email-settings?companyId=${encodeURIComponent(resolvedCompanyId)}`
        : '/companies/email-settings';
      await apiFetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: senderName.trim() || undefined,
          senderEmail: senderEmail.trim(),
          smtpHost: smtpHost.trim(),
          smtpPort: Number(smtpPort),
          smtpSecure,
          smtpAllowInvalidCerts,
          smtpUser: smtpUser.trim(),
          smtpPass: smtpPass.trim() || undefined,
          enabled: isConfigComplete
        })
      });
      setMessage(isConfigComplete ? 'Email sender settings saved successfully and enabled automatically.' : 'Email sender settings saved successfully, but it is still incomplete.');
      setSmtpPass(''); 
      await loadSettings(resolvedCompanyId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save email sender settings');
    } finally {
      setSaving(false);
    }
  };

  const testSettings = async () => {
    setTesting(true);
    setMessage('');
    try {
      const resolvedCompanyId = companyId.trim();
      const url = resolvedCompanyId
        ? `/companies/email-settings/test?companyId=${encodeURIComponent(resolvedCompanyId)}`
        : '/companies/email-settings/test';
      const response = await apiFetch<{ ok: boolean; message: string }>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      setMessage(response.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to test SMTP settings');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <Card className="p-6">Loading sender settings...</Card>;
  }

  return (
    <div className="space-y-6">
      <Card className="border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.03),rgba(42,141,240,0.05))]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Email sender</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-bold tracking-tight text-ink md:text-5xl">{senderName || companyName || 'Company sender'}</h1>
          <Badge
            tone={senderStatus === 'ready' ? 'green' : senderStatus === 'disabled' ? 'amber' : 'red'}
            className="self-center"
          >
            {senderStatus === 'ready' ? 'Ready to send' : senderStatus === 'disabled' ? 'Sender disabled' : 'Not configured'}
          </Badge>
        </div>
        {companyName ? <p className="mt-2 text-sm font-medium text-slate-500">Company: {companyName}</p> : null}
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Configure sender details for work emails, subscription notices, and batch notifications.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          {senderStatus === 'ready'
            ? 'This company is configured and can send emails.'
            : senderStatus === 'disabled'
              ? 'The sender is saved, but required fields are still missing.'
              : 'No sender is saved yet for this company.'}
        </p>
      </Card>

      <Card className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Quick setup</h2>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
          <p>Use this form to save the email account that CertiFlow will send from for your company.</p>
          <ul className="list-disc space-y-2 pl-5">
            <li><strong>Sender name</strong> is the display name shown to employees and recipients.</li>
            <li><strong>Sender email</strong> should be the company mailbox you want emails to come from.</li>
            <li><strong>SMTP host/port/user/password</strong> are the credentials for that mailbox.</li>
          </ul>
          <p>After saving, create a test batch and send it. The recipient should see <strong>your company email</strong> as the sender, not the platform&rsquo;s default sending address.</p>
        </div>
      </Card>

      {message ? (
        <div
          className={`rounded-3xl px-5 py-4 text-sm font-medium ${
            hasErrorHelp ? 'border border-amber-200 bg-amber-50 text-amber-900' : 'border border-sky-200 bg-sky-50 text-sky-800'
          }`}
        >
          <p>{message}</p>
          {smtpHelp ? (
            <div className="mt-4 rounded-2xl border border-amber-200/80 bg-white/90 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">{smtpHelp.title}</p>
              <p className="mt-1 leading-6">{smtpHelp.description}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-600">
                {smtpHelp.fixes.map((fix) => (
                  <li key={fix}>{fix}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-slate-500" />
          <h2 className="text-2xl font-bold tracking-tight text-ink">Sender details</h2>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Sender name</span>
            <Input value={senderName} onChange={(event) => setSenderName(event.target.value)} placeholder="Google HR" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Sender email</span>
            <Input value={senderEmail} onChange={(event) => setSenderEmail(event.target.value)} placeholder="no-reply@company.com" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">SMTP host</span>
            <Input
              value={smtpHost}
              onChange={(event) => {
                const nextHost = event.target.value;
                setSmtpHost(nextHost);
                const nextPreset = inferSmtpPreset(nextHost);
                if (nextPreset) {
                  setSmtpPort(String(nextPreset.port));
                  setSmtpSecure(nextPreset.secure);
                }
              }}
              placeholder="smtp.gmail.com"
            />
            {preset ? <p className="text-xs text-slate-500">{preset.provider}: {preset.note}</p> : null}
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">SMTP port</span>
            <Input
              type="number"
              min="1"
              value={smtpPort}
              onChange={(event) => {
                const nextPort = event.target.value;
                setSmtpPort(nextPort);
                setSmtpSecure((current) => normalizeSmtpSecure(nextPort, current));
              }}
              placeholder="587"
            />
          </label>
          <label className="space-y-2 flex flex-col">
            <span className="text-sm font-semibold text-slate-700">SMTP secure</span>
            <div className="flex items-center gap-3">
              <input
                id="smtpSecure"
                type="checkbox"
                checked={smtpSecure}
                onChange={(event) => setSmtpSecure(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <label htmlFor="smtpSecure" className="text-sm text-slate-600">
                Use TLS/SSL only for port 465. For port 587, keep this off and use STARTTLS.
              </label>
            </div>
          </label>
          <label className="space-y-2 flex flex-col md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Allow invalid certs</span>
            <div className="flex items-center gap-3">
              <input
                id="smtpAllowInvalidCerts"
                type="checkbox"
                checked={smtpAllowInvalidCerts}
                onChange={(event) => setSmtpAllowInvalidCerts(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <label htmlFor="smtpAllowInvalidCerts" className="text-sm text-slate-600">
                Enable only if your SMTP server uses a self-signed or internally issued certificate.
              </label>
            </div>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">SMTP username</span>
            <Input value={smtpUser} onChange={(event) => setSmtpUser(event.target.value)} placeholder="sender@company.com" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">SMTP password</span>
            <Input
              type="password"
              value={smtpPass}
              onChange={(event) => setSmtpPass(event.target.value)}
              placeholder={lastUpdated ? 'Leave blank to keep saved password' : 'App password or SMTP password'}
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant={isConfigComplete ? 'primary' : 'secondary'} disabled>
            {isConfigComplete ? 'Sender enabled automatically' : 'Sender disabled until complete'}
          </Button>
          <Button onClick={() => void saveSettings()} disabled={saving || (role === 'super_admin' && !companyId.trim())}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Save sender
          </Button>
          <Button variant="secondary" onClick={() => void testSettings()} disabled={testing || (role === 'super_admin' && !companyId.trim())}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            Test SMTP
          </Button>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Current status: {senderStatus === 'ready' ? 'ready to send' : senderStatus === 'disabled' ? 'disabled until required fields are filled' : 'not configured'}
        </p>
      </Card>
    </div>
  );
}
