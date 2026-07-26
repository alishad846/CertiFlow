'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BadgeCheck, ShieldAlert, Clock, XCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type Verification = {
  found: boolean;
  publicId?: string;
  recipientName?: string;
  title?: string | null;
  companyName?: string;
  status?: string;
  issuedAt?: string;
  expiresAt?: string | null;
  revokedReason?: string | null;
  currentVersion?: number;
};

const STATUS_META: Record<string, { label: string; icon: typeof BadgeCheck; className: string }> = {
  issued: { label: 'Valid', icon: BadgeCheck, className: 'text-[#3f6f4a] border-[#3f6f4a]/25 bg-[#3f6f4a]/8' },
  claimed: { label: 'Valid', icon: BadgeCheck, className: 'text-[#3f6f4a] border-[#3f6f4a]/25 bg-[#3f6f4a]/8' },
  revoked: { label: 'Revoked', icon: XCircle, className: 'text-[#a3412e] border-[#a3412e]/25 bg-[#a3412e]/8' },
  expired: { label: 'Expired', icon: Clock, className: 'text-bronze-deep border-bronze/30 bg-bronze/10' },
  superseded: { label: 'Superseded', icon: ShieldAlert, className: 'text-ink-soft border-[color:var(--color-border)] bg-paper-dim' }
};

function fmt(date?: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function VerifyPage() {
  const params = useParams<{ publicId?: string }>() ?? {};
  const publicId = String(params.publicId ?? '');
  const [data, setData] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Verification>(`/verify/${publicId}`)
      .then(setData)
      .catch(() => setData({ found: false }))
      .finally(() => setLoading(false));
  }, [publicId]);

  const meta = data?.status ? STATUS_META[data.status] ?? STATUS_META.issued : null;
  const StatusIcon = meta?.icon ?? BadgeCheck;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5 py-16">
      <div className="paper rounded-[32px] p-8 md:p-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-serif text-lg text-paper-bright">C</span>
            <span className="font-serif text-xl text-ink">CertiFlow</span>
          </div>
          <span className="eyebrow">Verification</span>
        </div>

        {loading ? (
          <p className="mt-10 flex items-center gap-2 text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" /> Checking the record…</p>
        ) : !data?.found ? (
          <div className="mt-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#a3412e]/25 bg-[#a3412e]/8 px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[#a3412e]">
              <XCircle className="h-3.5 w-3.5" /> Not found
            </div>
            <h1 className="mt-5 font-serif text-3xl text-ink">No certificate matches this ID</h1>
            <p className="mt-3 text-ink-soft">
              We couldn&rsquo;t find a certificate for <span className="font-mono text-ink">{publicId}</span>. Check the ID and try again.
            </p>
          </div>
        ) : (
          <div className="mt-10">
            {meta ? (
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] ${meta.className}`}>
                <StatusIcon className="h-3.5 w-3.5" /> {meta.label}
              </div>
            ) : null}

            <h1 className="mt-5 font-serif text-4xl leading-tight text-ink">{data.title || 'Certificate'}</h1>
            <p className="mt-2 text-lg text-ink-soft">
              Issued to <span className="font-medium text-ink">{data.recipientName}</span>
            </p>

            {data.status === 'revoked' && data.revokedReason ? (
              <p className="mt-4 rounded-2xl border border-[#a3412e]/20 bg-[#a3412e]/8 px-4 py-3 text-sm text-[#8f3325]">
                Reason: {data.revokedReason}
              </p>
            ) : null}

            <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-border)] sm:grid-cols-2">
              <Field label="Issuing organisation" value={data.companyName ?? '—'} />
              <Field label="Credential ID" value={data.publicId ?? '—'} mono />
              <Field label="Issued" value={fmt(data.issuedAt)} />
              <Field label="Expires" value={data.expiresAt ? fmt(data.expiresAt) : 'No expiry'} />
            </div>

            <p className="mt-6 text-xs leading-6 text-ink-faint">
              This page is the authoritative record for this certificate. Details shown here are served directly from
              CertiFlow and cannot be altered by editing a downloaded copy.
            </p>
          </div>
        )}
      </div>

      <p className="mt-6 text-center font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-faint">
        Secured &amp; verified by CertiFlow
      </p>
    </main>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-paper-bright px-5 py-4">
      <p className="font-mono text-[0.58rem] uppercase tracking-[0.2em] text-ink-faint">{label}</p>
      <p className={`mt-1.5 text-ink ${mono ? 'font-mono text-sm' : 'font-serif text-lg'}`}>{value}</p>
    </div>
  );
}
