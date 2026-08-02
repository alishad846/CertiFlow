'use client';

import { ComposedChart } from '@/components/charts/composed-chart';
import { SeriesBar } from '@/components/charts/series-bar';
import { Grid } from '@/components/charts/grid';
import { XAxis } from '@/components/charts/x-axis';
import { ChartTooltip } from '@/components/charts/tooltip/chart-tooltip';
import { Gauge } from '@/components/charts/gauge';
import type { DashboardStats } from '@certiflow/shared';

// Real dashboard analytics: issued-vs-claimed certificate trend + email delivery success, driven by
// /dashboard/stats (see routes/dashboard.ts). Replaces the folded-away Email Logs & Certificates pages.
export function CompanyAnalytics({ stats }: { stats: DashboardStats }) {
  const series = (stats.certificates ?? []).map((point) => ({
    date: point.date,
    issued: point.issued,
    claimed: point.claimed
  }));
  const delivery = stats.delivery ?? { sent: stats.emailsSent, failed: stats.failedEmails, pending: stats.pendingEmails };
  const totalDelivery = delivery.sent + delivery.failed + delivery.pending;
  const successRate = totalDelivery > 0 ? Math.round((delivery.sent / totalDelivery) * 100) : 0;
  const hasActivity = series.some((p) => p.issued > 0 || p.claimed > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      {/* Certificate activity — issued vs claimed over the last 14 days */}
      <div className="paper rounded-[28px] p-7">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow">Issued vs claimed</p>
            <h3 className="mt-2 font-serif text-2xl text-ink">Certificate activity</h3>
          </div>
          <span className="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-ink-faint">Last 14 days</span>
        </div>
        <div className="mt-4">
          {hasActivity ? (
            <ComposedChart data={series} xDataKey="date" barGap={0} maxBarSize={22} aspectRatio="2.4 / 1">
              <Grid horizontal />
              <SeriesBar dataKey="issued" fill="var(--chart-1)" radius={5} />
              <SeriesBar dataKey="claimed" fill="var(--chart-2)" radius={5} />
              <XAxis numTicks={6} />
              <ChartTooltip showCrosshair={false} />
            </ComposedChart>
          ) : (
            <div className="flex h-[180px] items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border)] text-sm text-ink-soft">
              No certificates issued yet — send a batch to see activity here.
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-5 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-soft">
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-bronze" /> Issued</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-royal" /> Claimed</span>
        </div>
      </div>

      {/* Delivery success — real sent/failed/pending */}
      <div className="paper flex flex-col items-center rounded-[28px] p-7">
        <div className="w-full">
          <p className="eyebrow">Delivery success</p>
          <h3 className="mt-2 font-serif text-2xl text-ink">Emails delivered</h3>
        </div>
        <div className="mt-2 flex flex-1 items-center">
          <Gauge
            value={successRate}
            centerValue={successRate}
            suffix="%"
            totalNotches={44}
            spacing={26}
            notchCornerRadius={3}
            startAngle={-135}
            endAngle={135}
            useGradient
            activeGradient={['#c9a277', '#94703f']}
            inactiveFill="var(--color-paper-deep)"
            inactiveFillOpacity={0.6}
            width={240}
            height={190}
          />
        </div>
        <p className="mt-2 text-center text-sm text-ink-soft">
          {delivery.sent.toLocaleString('en-US')} sent · {delivery.failed.toLocaleString('en-US')} failed ·{' '}
          {delivery.pending.toLocaleString('en-US')} pending
        </p>
      </div>
    </div>
  );
}
