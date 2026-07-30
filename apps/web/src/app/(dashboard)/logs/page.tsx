'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EmailLogItem } from '@certiflow/shared';

export default function LogsPage() {
  const [logs, setLogs] = useState<EmailLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ logs: EmailLogItem[] }>('/logs/email')
      .then((data) => {
        setLogs(data.logs);
        setError('');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load logs');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <p className="eyebrow">Email logs</p>
        <h2 className="mt-3 font-serif text-4xl tracking-tight text-ink">
          Sent, pending, and failed delivery records.
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink-soft">
          Review each recipient and quickly spot failures so you can retry or fix the template before the next batch.
        </p>
      </Card>

      {error ? (
        <p className="rounded-2xl border border-[#a3412e]/20 bg-[#a3412e]/8 px-4 py-3 text-sm text-[#8f3325]">{error}</p>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--color-border)] px-6 py-4">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-faint">Delivery status table</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--color-border)] text-sm">
            <thead className="bg-paper/50 text-left font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-faint">
              <tr>
                <th className="px-6 py-3 font-medium">Recipient</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Error</th>
                <th className="px-6 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {loading ? (
                <tr>
                  <td className="px-6 py-8 text-ink-soft" colSpan={4}>
                    Loading logs
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-ink-soft" colSpan={4}>
                    No email logs yet. Send a batch to see delivery history here.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4">
                      <div className="font-serif text-base text-ink">{log.recipientName}</div>
                      <div className="text-ink-soft">{log.recipientEmail}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={log.status === 'sent' ? 'green' : log.status === 'failed' ? 'red' : 'blue'}>
                        {log.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-ink-soft">{log.errorMessage || '—'}</td>
                    <td className="px-6 py-4 text-ink-soft">{new Date(log.createdAt).toLocaleString()}</td>
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
