'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, Copy, KeyRound } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Me = { user: { twoFactorEnabled?: boolean; role: string } };
type SetupResponse = { qrDataUrl: string; secret: string; otpauthUrl: string };

export default function SecurityPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadStatus = () => {
    apiFetch<Me>('/auth/me').then((data) => setEnabled(Boolean(data.user.twoFactorEnabled)));
  };
  useEffect(loadStatus, []);

  const startSetup = async () => {
    setBusy(true);
    setError('');
    try {
      setSetup(await apiFetch<SetupResponse>('/auth/2fa/setup', { method: 'POST' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start setup');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch<{ backupCodes: string[] }>('/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: code.trim() })
      });
      setBackupCodes(res.backupCodes);
      setSetup(null);
      setCode('');
      setEnabled(true);
      setMessage('Two-factor authentication is now on.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable 2FA');
    } finally {
      setBusy(false);
    }
  };

  const disable = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch('/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      setEnabled(false);
      setPassword('');
      setBackupCodes(null);
      setMessage('Two-factor authentication has been turned off.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable 2FA');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <p className="eyebrow">Security</p>
        <h2 className="mt-3 font-serif text-4xl tracking-tight text-ink">Two-factor authentication</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink-soft">
          Add a second step at sign-in using an authenticator app (Google Authenticator, Authy, 1Password). It protects
          your account even if your password is compromised.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.16em]">
          {enabled === null ? (
            <span className="text-ink-faint"><Loader2 className="inline h-3.5 w-3.5 animate-spin" /> Checking…</span>
          ) : enabled ? (
            <span className="flex items-center gap-1.5 text-[#3f6f4a]"><ShieldCheck className="h-4 w-4" /> Enabled</span>
          ) : (
            <span className="flex items-center gap-1.5 text-bronze-deep"><ShieldAlert className="h-4 w-4" /> Not enabled</span>
          )}
        </div>
      </Card>

      {message ? (
        <p className="rounded-2xl border border-[#3f6f4a]/20 bg-[#3f6f4a]/8 px-4 py-3 text-sm text-[#3f6f4a]">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-[#a3412e]/20 bg-[#a3412e]/8 px-4 py-3 text-sm text-[#8f3325]">{error}</p>
      ) : null}

      {backupCodes ? (
        <Card>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-bronze-deep" />
            <h3 className="font-serif text-2xl text-ink">Save your backup codes</h3>
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            Store these somewhere safe. Each code works once if you lose access to your authenticator. They won&rsquo;t be shown again.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {backupCodes.map((c) => (
              <code key={c} className="rounded-lg border border-[color:var(--color-border)] bg-paper/50 px-3 py-2 text-center font-mono text-sm text-ink">{c}</code>
            ))}
          </div>
          <Button variant="secondary" className="mt-4" onClick={() => navigator.clipboard.writeText(backupCodes.join('\n'))}>
            <Copy className="mr-2 h-4 w-4" /> Copy all
          </Button>
        </Card>
      ) : null}

      {enabled === false && !backupCodes ? (
        <Card>
          {!setup ? (
            <Button onClick={startSetup} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Enable two-factor authentication
            </Button>
          ) : (
            <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-start">
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-paper-bright p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={setup.qrDataUrl} alt="Authenticator QR code" width={180} height={180} />
              </div>
              <div>
                <h3 className="font-serif text-2xl text-ink">Scan, then confirm</h3>
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  Scan the QR with your authenticator app, or enter this key manually:
                </p>
                <code className="mt-2 inline-block break-all rounded-lg border border-[color:var(--color-border)] bg-paper/50 px-3 py-2 font-mono text-sm text-ink">
                  {setup.secret}
                </code>
                <form onSubmit={confirmEnable} className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    placeholder="6 digit code"
                    className="sm:max-w-[200px]"
                  />
                  <Button type="submit" disabled={busy}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Confirm & enable
                  </Button>
                </form>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {enabled === true ? (
        <Card>
          <h3 className="font-serif text-2xl text-ink">Turn off two-factor</h3>
          <p className="mt-2 text-sm text-ink-soft">Enter your password to disable 2FA. We recommend keeping it on.</p>
          <form onSubmit={disable} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="sm:max-w-[280px]"
            />
            <Button type="submit" variant="secondary" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Disable 2FA
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
