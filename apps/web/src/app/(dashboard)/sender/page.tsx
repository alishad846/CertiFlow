'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

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

export default function SenderSettingsPage() {
  const searchParams = useSearchParams();
  const initialCompanyId = searchParams.get('companyId')?.trim() || '';

  const [role, setRole] = useState<MeResponse['user']['role'] | null>(null);
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [companyName, setCompanyName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadSettings = async (targetCompanyId = companyId) => {
    const resolvedCompanyId = targetCompanyId.trim();
    setLoading(true);
    setMessage('');
    try {
      const url = resolvedCompanyId
        ? `/companies/email-settings?companyId=${encodeURIComponent(resolvedCompanyId)}`
        : '/companies/email-settings';
      const response = await apiFetch<EmailSettingsResponse>(url);
      setCompanyName(response.company.companyName);
      setSenderName(response.settings?.senderName ?? '');
      setSenderEmail(response.settings?.senderEmail ?? '');
      setSmtpHost(response.settings?.smtpHost ?? '');
      setSmtpPort(String(response.settings?.smtpPort ?? 587));
      setSmtpSecure(Boolean(response.settings?.smtpSecure));
      setSmtpUser(response.settings?.smtpUser ?? '');
      setEnabled(response.settings?.enabled ?? true);
      setLastUpdated(response.settings?.updatedAt ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load email settings');
    } finally {
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
        if (initialCompanyId) {
          void loadSettings(initialCompanyId);
          return;
        }
        setLoading(false);
        setMessage('Enter a company ID to load sender settings.');
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
          smtpUser: smtpUser.trim(),
          smtpPass: smtpPass.trim() || undefined,
          enabled
        })
      });
      setMessage('Email sender settings saved successfully.');
      setSmtpPass('');
      await loadSettings(resolvedCompanyId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save email sender settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Card className="p-6">Loading sender settings...</Card>;
  }

  return (
    <div className="space-y-6">
      <Card className="border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.03),rgba(42,141,240,0.05))]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Email sender</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink md:text-5xl">{companyName || 'Company sender'}</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Configure sender details for work emails, subscription notices, and batch notifications.
        </p>
      </Card>

      {message ? <div className="rounded-3xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm font-medium text-sky-800">{message}</div> : null}

      <Card className="p-6">
        {role === 'super_admin' ? (
          <div className="mb-6 rounded-[24px] bg-slate-50 p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Company ID</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input value={companyId} onChange={(event) => setCompanyId(event.target.value)} placeholder="Enter company UUID" />
              <Button type="button" variant="secondary" onClick={() => void loadSettings(companyId)} disabled={!companyId.trim()}>
                Load company
              </Button>
            </div>
          </div>
        ) : null}

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
            <Input value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} placeholder="smtp.gmail.com" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">SMTP port</span>
            <Input type="number" min="1" value={smtpPort} onChange={(event) => setSmtpPort(event.target.value)} placeholder="587" />
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
          <Button variant={enabled ? 'primary' : 'secondary'} onClick={() => setEnabled((current) => !current)}>
            {enabled ? 'Sender enabled' : 'Sender disabled'}
          </Button>
          <Button onClick={() => void saveSettings()} disabled={saving || (role === 'super_admin' && !companyId.trim())}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Save sender
          </Button>
        </div>
      </Card>
    </div>
  );
}
