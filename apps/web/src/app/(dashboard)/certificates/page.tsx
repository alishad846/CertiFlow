'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Ban, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

type CertificateItem = {
  id: string;
  publicId: string;
  recipientName: string;
  recipientEmail: string;
  title: string | null;
  status: string;
  claimStatus: string | null;
  issuedAt: string;
  claimedAt: string | null;
};

type MeResponse = { user: { role: 'super_admin' | 'company_admin'; companyId: string | null } };

function statusTone(status: string): 'green' | 'amber' | 'red' | 'slate' | 'blue' {
  if (status === 'revoked') return 'red';
  if (status === 'claimed') return 'green';
  if (status === 'expired') return 'amber';
  return 'blue';
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CertificatesPage() {
  const [role, setRole] = useState<MeResponse['user']['role']>('company_admin');
  const [companyId, setCompanyId] = useState('');
  const [items, setItems] = useState<CertificateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    apiFetch<MeResponse>('/auth/me')
      .then((data) => {
        setRole(data.user.role);
        if (data.user.role !== 'super_admin' && data.user.companyId) {
          setCompanyId(data.user.companyId);
        }
      })
      .catch(() => setRole('company_admin'));
  }, []);

  const load = useCallback(async () => {
    if (role === 'super_admin' && !companyId.trim()) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const query = role === 'super_admin' ? `?companyId=${encodeURIComponent(companyId.trim())}` : '';
      const data = await apiFetch<{ certificates: CertificateItem[] }>(`/certificates/mine${query}`);
      setItems(data.certificates);
      setMessage('');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load certificates');
    } finally {
      setLoading(false);
    }
  }, [role, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (item: CertificateItem) => {
    const reason = window.prompt(`Revoke the certificate for ${item.recipientName}? Optionally add a reason:`, '');
    if (reason === null) return;
    setBusyId(item.id);
    try {
      await apiFetch(`/certificates/${item.id}/revoke${role === 'super_admin' ? `?companyId=${encodeURIComponent(companyId.trim())}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      setItems((current) => current.map((c) => (c.id === item.id ? { ...c, status: 'revoked' } : c)));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to revoke');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Issued certificates</p>
            <h2 className="mt-3 font-serif text-4xl tracking-tight text-ink">Every certificate you have issued.</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink-soft">
              Track claim status, open the public verification page, or revoke a certificate if it was issued in error.
            </p>
          </div>
          <Button variant="secondary" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </Card>

      {role === 'super_admin' ? (
        <Card>
          <label className="mb-2 block text-sm font-medium text-ink-soft">Company ID</label>
          <Input value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="Enter company ID to view its certificates" />
        </Card>
      ) : null}

      {message ? (
        <p className="rounded-2xl border border-[color:var(--color-border)] bg-paper/50 px-4 py-3 text-sm text-ink-soft">{message}</p>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--color-border)] text-sm">
            <thead className="bg-paper/50 text-left font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-faint">
              <tr>
                <th className="px-6 py-3 font-medium">Recipient</th>
                <th className="px-6 py-3 font-medium">Certificate</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Issued</th>
                <th className="px-6 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {loading ? (
                <tr><td className="px-6 py-8 text-ink-soft" colSpan={5}>Loading certificates…</td></tr>
              ) : items.length === 0 ? (
                <tr><td className="px-6 py-8 text-ink-soft" colSpan={5}>No certificates issued yet. Send a certificate batch to see them here.</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4">
                      <div className="font-serif text-base text-ink">{item.recipientName}</div>
                      <div className="text-ink-soft">{item.recipientEmail}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-ink">{item.title || '—'}</div>
                      <div className="font-mono text-xs text-ink-faint">{item.publicId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-ink-soft">{fmt(item.issuedAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/verify/${item.publicId}`}
                          target="_blank"
                          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] px-3 py-1.5 text-xs text-ink transition hover:border-bronze hover:text-bronze-deep"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Verify
                        </Link>
                        {item.status !== 'revoked' ? (
                          <button
                            type="button"
                            onClick={() => void revoke(item)}
                            disabled={busyId === item.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#a3412e]/25 px-3 py-1.5 text-xs text-[#a3412e] transition hover:bg-[#a3412e]/8 disabled:opacity-50"
                          >
                            <Ban className="h-3.5 w-3.5" /> Revoke
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
