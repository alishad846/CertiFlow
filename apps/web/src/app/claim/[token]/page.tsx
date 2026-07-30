'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, Linkedin, Share2, ShieldCheck, Loader2, BadgeCheck } from 'lucide-react';
import { apiFetch, apiUrl } from '@/lib/api';

type ClaimContext = {
  status: 'claimable' | 'expired' | 'revoked';
  maskedEmail: string;
  recipientName: string;
  companyName: string;
  title: string | null;
  publicId: string;
};

type Step = 'loading' | 'email' | 'otp' | 'success' | 'blocked';

export default function ClaimPage() {
  const params = useParams<{ token?: string }>() ?? {};
  const token = String(params.token ?? '');

  const [step, setStep] = useState<Step>('loading');
  const [ctx, setCtx] = useState<ClaimContext | null>(null);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [claimSession, setClaimSession] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    apiFetch<ClaimContext>(`/claim/${token}`)
      .then((data) => {
        setCtx(data);
        setStep(data.status === 'claimable' ? 'email' : 'blocked');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'This claim link is not valid.');
        setStep('blocked');
      });
  }, [token]);

  const requestOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await apiFetch(`/claim/${token}/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the verification code.');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiFetch<{ claimSession: string }>(`/claim/${token}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      setClaimSession(res.claimSession);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect code.');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/claim/${token}/download`, {
        headers: { Authorization: `Bearer ${claimSession}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? 'Download failed.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ctx?.recipientName ?? 'certificate'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloading(false);
    }
  };

  const verifyUrl = ctx ? `${typeof window !== 'undefined' ? window.location.origin : ''}/verify/${ctx.publicId}` : '';
  const linkedInUrl = ctx
    ? `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
        ctx.title ?? 'Certificate'
      )}&organizationName=${encodeURIComponent(ctx.companyName)}&certUrl=${encodeURIComponent(
        verifyUrl
      )}&certId=${encodeURIComponent(ctx.publicId)}`
    : '';

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5 py-16">
      <div className="paper rounded-[32px] p-8 md:p-10">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-serif text-lg text-paper-bright">C</span>
          <span className="font-serif text-xl text-ink">CertiFlow</span>
        </div>

        {step === 'loading' ? (
          <p className="mt-8 flex items-center gap-2 text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" /> Loading your certificate…</p>
        ) : null}

        {step === 'blocked' ? (
          <div className="mt-8">
            <h1 className="font-serif text-3xl text-ink">
              {ctx?.status === 'expired' ? 'This claim link has expired' : ctx?.status === 'revoked' ? 'This certificate was revoked' : 'Link not valid'}
            </h1>
            <p className="mt-3 text-ink-soft">{error || 'Please contact the issuing organisation for help.'}</p>
          </div>
        ) : null}

        {ctx && step !== 'loading' && step !== 'blocked' ? (
          <>
            <p className="eyebrow mt-8">Certificate from {ctx.companyName}</p>
            <h1 className="mt-3 font-serif text-4xl leading-tight text-ink">
              {ctx.title || 'Your certificate'}
            </h1>
            <p className="mt-2 text-ink-soft">Issued to <span className="font-medium text-ink">{ctx.recipientName}</span></p>
            <div className="mt-6 h-px w-full rule-bronze" />
          </>
        ) : null}

        {step === 'email' ? (
          <form onSubmit={requestOtp} className="mt-6 space-y-4">
            <p className="text-sm leading-6 text-ink-soft">
              To keep your certificate secure, confirm the email address it was issued to
              (<span className="font-mono text-ink">{ctx?.maskedEmail}</span>). We&rsquo;ll send you a one-time code.
            </p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full rounded-xl border border-[color:var(--color-border)] bg-paper-bright px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-bronze focus:ring-4 focus:ring-bronze/15"
            />
            {error ? <p className="text-sm text-[#8f3325]">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper-bright transition hover:bg-royal disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Send verification code
            </button>
          </form>
        ) : null}

        {step === 'otp' ? (
          <form onSubmit={verifyOtp} className="mt-6 space-y-4">
            <p className="text-sm leading-6 text-ink-soft">
              We sent a 6 digit code to <span className="font-mono text-ink">{ctx?.maskedEmail}</span>. Enter it below to claim.
            </p>
            <input
              inputMode="numeric"
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full rounded-xl border border-[color:var(--color-border)] bg-paper-bright px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-ink outline-none transition focus:border-bronze focus:ring-4 focus:ring-bronze/15"
            />
            {error ? <p className="text-sm text-[#8f3325]">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper-bright transition hover:bg-royal disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
              Verify and claim
            </button>
            <button type="button" onClick={() => setStep('email')} className="w-full text-center text-sm text-ink-faint hover:text-ink">
              Use a different email
            </button>
          </form>
        ) : null}

        {step === 'success' ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 rounded-2xl border border-[#3f6f4a]/20 bg-[#3f6f4a]/8 px-4 py-3 text-sm text-[#3f6f4a]">
              <BadgeCheck className="h-4 w-4" /> Verified. Your certificate is ready.
            </div>
            <button
              onClick={download}
              disabled={downloading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper-bright transition hover:bg-royal disabled:opacity-60"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download certificate (PDF)
            </button>
            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href={linkedInUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--color-border)] bg-paper-bright px-5 py-3 text-sm text-ink transition hover:border-bronze hover:text-bronze-deep"
              >
                <Linkedin className="h-4 w-4" /> Add to LinkedIn
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(verifyUrl);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--color-border)] bg-paper-bright px-5 py-3 text-sm text-ink transition hover:border-bronze hover:text-bronze-deep"
              >
                <Share2 className="h-4 w-4" /> Copy verify link
              </button>
            </div>
            <a href={`/verify/${ctx?.publicId}`} className="block text-center text-sm text-bronze-deep hover:underline">
              View public verification page →
            </a>
            {error ? <p className="text-center text-sm text-[#8f3325]">{error}</p> : null}
          </div>
        ) : null}
      </div>

      <p className="mt-6 text-center font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-faint">
        Secured &amp; verified by CertiFlow
      </p>
    </main>
  );
}
