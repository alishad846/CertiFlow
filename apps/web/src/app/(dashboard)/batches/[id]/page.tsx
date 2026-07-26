'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type BatchDetailResponse = {
  batch: {
    id: string;
    name: string;
    status: string;
    totalRows: number;
    processedRows: number;
    sentCount: number;
    failedCount: number;
    createdAt: string;
  };
  documents: Array<{
    id: string;
    recipientName: string;
    recipientEmail: string;
    status: string;
    emailStatus: string;
    generatedPdfPath: string | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
};

export default function BatchDetailPage() {
  const params = useParams<{ id?: string }>() ?? {};
  const [error, setError] = useState('');
  const [data, setData] = useState<BatchDetailResponse | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    const timer = setInterval(() => {
      apiFetch<BatchDetailResponse>(`/batches/${params.id}`)
        .then((payload) => {
          setData(payload);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load batch');
        });
    }, 3000);
    apiFetch<BatchDetailResponse>(`/batches/${params.id}`)
      .then((payload) => {
        setData(payload);
        setError('');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load batch');
      });
    return () => clearInterval(timer);
  }, [params?.id]);

  if (error && !data) {
    return (
      <Card>
        <p className="font-serif text-xl text-ink">Unable to load batch</p>
        <p className="mt-2 text-sm text-ink-soft">{error}</p>
      </Card>
    );
  }

  if (!data) {
    return <Card>Loading batch details</Card>;
  }

  const percent = data.batch.totalRows ? Math.round((data.batch.processedRows / data.batch.totalRows) * 100) : 0;
  const tone = data.batch.status.includes('failed')
    ? 'red'
    : data.batch.status === 'completed'
      ? 'green'
      : data.batch.status === 'sending'
        ? 'blue'
        : 'amber';

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">Batch details</p>
            <h2 className="mt-2 font-serif text-3xl text-ink">{data.batch.name}</h2>
          </div>
          <Badge tone={tone as 'red' | 'green' | 'blue' | 'amber'}>{data.batch.status}</Badge>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-sm text-ink-soft">
            <span>Generation progress</span>
            <span>
              {data.batch.processedRows}/{data.batch.totalRows}
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-paper-dim">
            <div className="h-full rounded-full bg-bronze" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-paper/50 p-4">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-faint">Sent</p>
            <p className="mt-1 font-serif text-2xl text-ink">{data.batch.sentCount}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-paper/50 p-4">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-faint">Failed</p>
            <p className="mt-1 font-serif text-2xl text-ink">{data.batch.failedCount}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-paper/50 p-4">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-faint">Created</p>
            <p className="mt-1 font-serif text-2xl text-ink">{new Date(data.batch.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-serif text-2xl text-ink">Documents</h3>
        <div className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--color-border)]">
          <table className="min-w-full divide-y divide-[color:var(--color-border)] text-sm">
            <thead className="bg-paper/50 text-left font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Recipient</th>
                <th className="px-4 py-3 font-medium">Delivery</th>
                <th className="px-4 py-3 font-medium">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {data.documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-4 py-4">
                    <div className="font-serif text-base text-ink">{doc.recipientName}</div>
                    <div className="text-ink-soft">{doc.recipientEmail}</div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={doc.emailStatus === 'sent' ? 'green' : doc.emailStatus === 'failed' ? 'red' : 'amber'}>
                      {doc.emailStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-ink-soft">{doc.errorMessage || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
