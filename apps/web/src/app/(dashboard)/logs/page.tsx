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
      <Card className="overflow-hidden border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.03),rgba(42,141,240,0.05))]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Email logs</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Sent, pending, and failed delivery records.
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Review each recipient and quickly spot failures so you can retry or fix the template before the next batch.
        </p>
      </Card>

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <Card className="overflow-hidden border-white/80 p-0">
        <div className="border-b border-slate-100 px-6 py-4">
          <p className="text-sm font-semibold text-slate-500">Delivery status table</p>
        </div>

        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">Recipient</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Error</th>
                <th className="px-6 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-6 py-8 text-slate-500" colSpan={4}>
                    Loading logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-slate-500" colSpan={4}>
                    No email logs yet. Send a batch to see delivery history here.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-ink">{log.recipientName}</div>
                      <div className="text-slate-500">{log.recipientEmail}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={log.status === 'sent' ? 'green' : log.status === 'failed' ? 'red' : 'blue'}>
                        {log.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{log.errorMessage || '-'}</td>
                    <td className="px-6 py-4 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
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
