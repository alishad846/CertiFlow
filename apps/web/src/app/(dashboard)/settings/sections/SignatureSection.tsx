'use client';

import { useEffect, useRef, useState } from 'react';
import { PenTool, ShieldCheck, Trash2, Loader2, UploadCloud } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SettingsUser } from '../page';

type DscMeta = { subjectCn: string | null; validTo: string | null; autoSign: boolean; enabled: boolean };
type Props = { user: SettingsUser | null; onSaved: () => void };

export function SignatureSection({ onSaved }: Props) {
  const [dsc, setDsc] = useState<DscMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [autoSign, setAutoSign] = useState(true);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = () =>
    apiFetch<{ dsc: DscMeta | null }>('/company-signing')
      .then((d) => setDsc(d.dsc))
      .catch(() => setDsc(null))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setMsg({ ok: false, text: 'Choose a .pfx or .p12 file first.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('passphrase', passphrase);
      form.append('autoSign', String(autoSign));
      const res = await apiFetch<{ dsc: DscMeta }>('/company-signing', { method: 'PUT', body: form });
      setDsc(res.dsc);
      setFile(null);
      setPassphrase('');
      if (fileRef.current) fileRef.current.value = '';
      setMsg({ ok: true, text: 'Digital signature certificate saved.' });
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not save the certificate.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch('/company-signing', { method: 'DELETE' });
      setDsc(null);
      setMsg({ ok: true, text: 'Certificate removed. New offer letters will be left for manual signing.' });
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not remove the certificate.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <PenTool className="h-5 w-5 text-bronze-deep" />
          <h3 className="font-serif text-2xl text-ink">Digital Signature (DSC)</h3>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          Upload your Digital Signature Certificate to auto-sign every offer letter — or leave it and sign each one
          yourself in Adobe. Either way, recipients get an Adobe-ready signature field to counter-sign after they verify.
        </p>
      </Card>

      {msg ? (
        <p className={`rounded-2xl border px-4 py-3 text-sm ${msg.ok ? 'border-[#3f6f4a]/20 bg-[#3f6f4a]/8 text-[#3f6f4a]' : 'border-[#a3412e]/20 bg-[#a3412e]/8 text-[#8f3325]'}`}>
          {msg.text}
        </p>
      ) : null}

      {loading ? (
        <Card className="p-6 text-ink-soft"><Loader2 className="inline h-4 w-4 animate-spin" /> Loading…</Card>
      ) : dsc ? (
        <Card className="p-6">
          <div className="flex items-center gap-2 text-[#3f6f4a]">
            <ShieldCheck className="h-5 w-5" />
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em]">Certificate active</span>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Signed by</dt>
              <dd className="mt-1 font-serif text-lg text-ink">{dsc.subjectCn ?? 'Unknown'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Valid until</dt>
              <dd className="mt-1 font-serif text-lg text-ink">
                {dsc.validTo ? new Date(dsc.validTo).toLocaleDateString() : '—'}
              </dd>
            </div>
          </dl>
          <label className="mt-5 flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-paper/50 px-4 py-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={dsc.autoSign}
              disabled
              readOnly
            />
            Auto-sign issued offer letters with this certificate {dsc.autoSign ? '(on)' : '(off — re-upload to change)'}
          </label>
          <Button variant="secondary" className="mt-5" onClick={remove} disabled={busy}>
            <Trash2 className="mr-2 h-4 w-4" /> Remove certificate
          </Button>
        </Card>
      ) : (
        <Card className="p-6">
          <form onSubmit={upload} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-ink-soft">Certificate file (.pfx / .p12)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".pfx,.p12,application/x-pkcs12"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-paper-bright hover:file:bg-ink/90"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink-soft">Passphrase</label>
              <Input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Certificate passphrase"
                autoComplete="off"
              />
            </div>
            <label className="flex items-center gap-3 text-sm text-ink-soft">
              <input type="checkbox" checked={autoSign} onChange={(e) => setAutoSign(e.target.checked)} />
              Auto-sign issued offer letters with this certificate
            </label>
            <Button type="submit" disabled={busy || !file || !passphrase}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              Save certificate
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
