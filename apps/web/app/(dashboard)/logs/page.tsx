'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Inbox,
  Mail,
  MailCheck,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';
import type { EmailLogItem } from '@certiflow/shared';

type StatusFilter = 'all' | 'sent' | 'pending' | 'failed';

function formatDate(dateValue: string | Date) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getInitials(name: string, email: string) {
  const value = name?.trim() || email?.trim() || 'Recipient';

  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === 'sent') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold capitalize text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Sent
      </span>
    );
  }

  if (normalizedStatus === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-bold capitalize text-red-700">
        <XCircle className="h-3.5 w-3.5" />
        Failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold capitalize text-blue-700">
      <Clock3 className="h-3.5 w-3.5" />
      {status || 'Pending'}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3 p-5 sm:p-6">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="grid animate-pulse gap-4 rounded-[20px] border border-slate-100 p-4 md:grid-cols-[1.5fr,0.7fr,1fr,0.8fr]"
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-slate-200" />

            <div className="flex-1">
              <div className="h-4 w-32 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-44 rounded bg-slate-100" />
            </div>
          </div>

          <div className="h-7 w-20 rounded-full bg-slate-100" />
          <div className="h-4 w-36 rounded bg-slate-100" />
          <div className="h-4 w-28 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function LogsPage() {
  const [logs, setLogs] = useState<EmailLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('all');

  const loadLogs = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const data = await apiFetch<{
        logs: EmailLogItem[];
      }>('/logs/email');

      setLogs(data.logs);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load email logs.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const sentCount = logs.filter(
    (log) => log.status.toLowerCase() === 'sent',
  ).length;

  const failedCount = logs.filter(
    (log) => log.status.toLowerCase() === 'failed',
  ).length;

  const pendingCount = logs.filter((log) => {
    const status = log.status.toLowerCase();

    return status !== 'sent' && status !== 'failed';
  }).length;

  const successRate =
    logs.length > 0
      ? Math.round((sentCount / logs.length) * 100)
      : 0;

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return logs.filter((log) => {
      const normalizedStatus = log.status.toLowerCase();

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'pending'
          ? normalizedStatus !== 'sent' &&
            normalizedStatus !== 'failed'
          : normalizedStatus === statusFilter);

      const matchesSearch =
        !normalizedSearch ||
        log.recipientName
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        log.recipientEmail
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        log.errorMessage
          ?.toLowerCase()
          .includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [logs, searchTerm, statusFilter]);

  const statusFilters: Array<{
    value: StatusFilter;
    label: string;
    count: number;
  }> = [
    {
      value: 'all',
      label: 'All',
      count: logs.length,
    },
    {
      value: 'sent',
      label: 'Sent',
      count: sentCount,
    },
    {
      value: 'pending',
      label: 'Pending',
      count: pendingCount,
    },
    {
      value: 'failed',
      label: 'Failed',
      count: failedCount,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0f172a] via-[#122b51] to-[#075985] p-6 text-white shadow-[0_28px_75px_rgba(15,23,42,0.18)] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 left-1/3 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />

        <div className="pointer-events-none absolute right-12 top-8 hidden h-36 w-52 rotate-3 rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur xl:block">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-400/20" />

            <div className="flex-1">
              <div className="h-2 w-20 rounded-full bg-white/20" />
              <div className="mt-2 h-2 w-28 rounded-full bg-white/10" />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-cyan-400/20" />

            <div className="flex-1">
              <div className="h-2 w-24 rounded-full bg-white/20" />
              <div className="mt-2 h-2 w-16 rounded-full bg-white/10" />
            </div>
          </div>
        </div>

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.15em] text-cyan-100 backdrop-blur">
              <Activity className="h-4 w-4 text-cyan-300" />
              Delivery activity
            </div>

            <h1 className="mt-6 max-w-3xl text-3xl font-bold leading-[1.08] tracking-[-0.04em] sm:text-4xl lg:text-5xl">
              Every delivery,
              <span className="text-cyan-300"> clearly tracked.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Follow sent, pending, and failed emails from one clear
              workspace. Quickly find recipients and identify deliveries
              that need attention.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                <MailCheck className="h-3.5 w-3.5 text-emerald-300" />
                Delivery tracking
              </span>

              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                <ShieldCheck className="h-3.5 w-3.5 text-cyan-300" />
                Automatic retry enabled
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadLogs(true)}
            disabled={refreshing}
            className="inline-flex w-full shrink-0 items-center justify-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-950 shadow-[0_15px_35px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            <RefreshCw
              className={`h-4 w-4 text-blue-600 ${
                refreshing ? 'animate-spin' : ''
              }`}
            />

            {refreshing ? 'Refreshing...' : 'Refresh activity'}
          </button>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="flex flex-col gap-4 rounded-[22px] border border-red-100 bg-red-50 p-4 text-red-800 shadow-sm sm:flex-row sm:items-center"
        >
          <div className="flex flex-1 items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <p className="text-sm font-bold">
                We could not load the delivery records
              </p>

              <p className="mt-1 text-sm leading-6 text-red-700">
                {error}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadLogs()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-red-700 shadow-sm transition hover:bg-red-100"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      )}

      {/* Statistics */}
      <section>
        <div className="mb-4 px-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            Delivery overview
          </p>

          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            Performance at a glance
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="group relative overflow-hidden rounded-[26px] border border-white bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1">
            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-200/40 blur-3xl" />

            <div className="relative flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Mail className="h-5 w-5" />
              </span>

              <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Total
              </span>
            </div>

            <p className="relative mt-6 text-sm font-semibold text-slate-500">
              Total deliveries
            </p>

            <p className="relative mt-2 text-4xl font-bold tracking-[-0.05em] text-slate-950">
              {loading ? '—' : logs.length.toLocaleString()}
            </p>

            <p className="relative mt-3 text-xs text-slate-500">
              All recorded email attempts
            </p>
          </article>

          <article className="group relative overflow-hidden rounded-[26px] border border-white bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1">
            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-200/40 blur-3xl" />

            <div className="relative flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Send className="h-5 w-5" />
              </span>

              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                Delivered
              </span>
            </div>

            <p className="relative mt-6 text-sm font-semibold text-slate-500">
              Successfully sent
            </p>

            <p className="relative mt-2 text-4xl font-bold tracking-[-0.05em] text-slate-950">
              {loading ? '—' : sentCount.toLocaleString()}
            </p>

            <p className="relative mt-3 text-xs text-slate-500">
              {successRate}% delivery success rate
            </p>
          </article>

          <article className="group relative overflow-hidden rounded-[26px] border border-white bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1">
            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-200/40 blur-3xl" />

            <div className="relative flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                <Clock3 className="h-5 w-5" />
              </span>

              <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-700">
                Processing
              </span>
            </div>

            <p className="relative mt-6 text-sm font-semibold text-slate-500">
              Pending deliveries
            </p>

            <p className="relative mt-2 text-4xl font-bold tracking-[-0.05em] text-slate-950">
              {loading ? '—' : pendingCount.toLocaleString()}
            </p>

            <p className="relative mt-3 text-xs text-slate-500">
              Waiting or being processed
            </p>
          </article>

          <article className="group relative overflow-hidden rounded-[26px] border border-white bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1">
            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-red-200/40 blur-3xl" />

            <div className="relative flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <XCircle className="h-5 w-5" />
              </span>

              <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-600">
                Attention
              </span>
            </div>

            <p className="relative mt-6 text-sm font-semibold text-slate-500">
              Failed deliveries
            </p>

            <p className="relative mt-2 text-4xl font-bold tracking-[-0.05em] text-slate-950">
              {loading ? '—' : failedCount.toLocaleString()}
            </p>

            <p className="relative mt-3 text-xs text-slate-500">
              {failedCount === 0
                ? 'Everything looks good'
                : 'Review the error details below'}
            </p>
          </article>
        </div>
      </section>

      {/* Logs */}
      <section className="overflow-hidden rounded-[30px] border border-white/90 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                Delivery history
              </p>

              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                Recipient activity
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Search recipients and filter records by delivery status.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 xl:max-w-3xl xl:flex-row xl:items-center xl:justify-end">
              <div className="relative w-full xl:max-w-sm">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(event.target.value)
                  }
                  placeholder="Search name, email, or error..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1">
                {statusFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setStatusFilter(filter.value)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                      statusFilter === filter.value
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {filter.label}

                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        statusFilter === filter.value
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-white/70 text-slate-500'
                      }`}
                    >
                      {filter.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : logs.length === 0 ? (
          /* Empty state */
          <div className="relative overflow-hidden px-6 py-16 text-center">
            <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-100/60 blur-3xl" />

            <div className="relative mx-auto max-w-xl">
              <div className="relative mx-auto h-36 w-48">
                <div className="absolute left-4 top-7 h-24 w-32 -rotate-6 rounded-[22px] border border-blue-100 bg-blue-50" />

                <div className="absolute right-3 top-5 h-24 w-32 rotate-6 rounded-[22px] border border-cyan-100 bg-cyan-50" />

                <div className="absolute left-1/2 top-0 flex h-32 w-36 -translate-x-1/2 items-center justify-center rounded-[26px] border border-slate-100 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.13)]">
                  <Inbox className="h-12 w-12 text-blue-600" />
                </div>
              </div>

              <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                Your history will appear here
              </p>

              <h3 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                No email deliveries yet
              </h3>

              <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-slate-600">
                After you send your first batch, every recipient and
                delivery result will be listed here automatically.
              </p>
            </div>
          </div>
        ) : filteredLogs.length === 0 ? (
          /* No search results */
          <div className="px-6 py-14 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-slate-100 text-slate-500">
              <Search className="h-7 w-7" />
            </div>

            <h3 className="mt-5 text-xl font-bold text-slate-950">
              No matching delivery records
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Try a different recipient, email address, or status.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
              className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Recipient
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Status
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Delivery information
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Date and time
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="group transition hover:bg-blue-50/40"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 text-xs font-bold text-blue-700">
                            {getInitials(
                              log.recipientName,
                              log.recipientEmail,
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="max-w-[260px] truncate text-sm font-bold text-slate-950">
                              {log.recipientName || 'Unnamed recipient'}
                            </p>

                            <p className="mt-1 max-w-[260px] truncate text-xs text-slate-500">
                              {log.recipientEmail}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <StatusBadge status={log.status} />
                      </td>

                      <td className="max-w-sm px-6 py-5">
                        {log.errorMessage ? (
                          <div className="flex items-start gap-2 text-sm leading-6 text-red-600">
                            <AlertCircle className="mt-1 h-4 w-4 shrink-0" />
                            <span>{log.errorMessage}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            No delivery errors
                          </div>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-6 py-5 text-sm text-slate-500">
                        {formatDate(log.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 p-4 md:hidden">
              {filteredLogs.map((log) => (
                <article
                  key={log.id}
                  className="rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 text-xs font-bold text-blue-700">
                      {getInitials(
                        log.recipientName,
                        log.recipientEmail,
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-950">
                        {log.recipientName || 'Unnamed recipient'}
                      </p>

                      <p className="mt-1 truncate text-xs text-slate-500">
                        {log.recipientEmail}
                      </p>
                    </div>

                    <StatusBadge status={log.status} />
                  </div>

                  <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                    {log.errorMessage ? (
                      <div className="flex items-start gap-2 text-xs leading-5 text-red-600">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{log.errorMessage}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        No delivery errors
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatDate(log.createdAt)}
                  </div>
                </article>
              ))}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {filteredLogs.length} of {logs.length} records
              </span>

              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Delivery records are updated automatically
              </span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}