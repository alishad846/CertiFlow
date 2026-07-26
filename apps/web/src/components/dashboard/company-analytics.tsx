'use client';

import { ComposedChart } from '@/components/charts/composed-chart';
import { SeriesBar } from '@/components/charts/series-bar';
import { Grid } from '@/components/charts/grid';
import { XAxis } from '@/components/charts/x-axis';
import { ChartTooltip } from '@/components/charts/tooltip/chart-tooltip';
import { Gauge } from '@/components/charts/gauge';
import { mockCertificateActivity, mockDeliverySuccessRate, mockDeliveryCounts } from '@/lib/mock-dashboard-data';

// TODO: swap mock data for real API series once billing + analytics endpoints exist.
export function CompanyAnalytics() {
  const composedData = mockCertificateActivity();
  const successRate = mockDeliverySuccessRate();
  const { delivered, retried } = mockDeliveryCounts();

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      {/* Composed — grouped bars, no gap */}
      <div className="paper rounded-[28px] p-7">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow">Issued vs credits used</p>
            <h3 className="mt-2 font-serif text-2xl text-ink">Certificate activity</h3>
          </div>
          <span className="rounded-full border border-[color:var(--color-border)] px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.18em] text-ink-faint">
            Sample data
          </span>
        </div>
        <div className="mt-4">
          <ComposedChart data={composedData} xDataKey="date" barGap={0} maxBarSize={22} aspectRatio="2.4 / 1">
            <Grid horizontal />
            <SeriesBar dataKey="issued" fill="var(--chart-1)" radius={5} />
            <SeriesBar dataKey="credits" fill="var(--chart-2)" radius={5} />
            <XAxis numTicks={6} />
            <ChartTooltip showCrosshair={false} />
          </ComposedChart>
        </div>
        <div className="mt-4 flex flex-wrap gap-5 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-soft">
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-bronze" /> Certificates issued</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-royal" /> Credits used</span>
        </div>
      </div>

      {/* Gauge — delivery success rate (pattern foreground, dim solid track) */}
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
          {delivered.toLocaleString('en-US')} delivered · {retried.toLocaleString('en-US')} retried
        </p>
      </div>
    </div>
  );
}
