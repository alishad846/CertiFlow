'use client';

import { AreaChart } from '@/components/charts/area-chart';
import { Area } from '@/components/charts/area';
import { Grid } from '@/components/charts/grid';
import { XAxis } from '@/components/charts/x-axis';
import { ChartTooltip } from '@/components/charts/tooltip/chart-tooltip';
import { RingChart } from '@/components/charts/ring-chart';
import { Ring } from '@/components/charts/ring';
import { RingCenter } from '@/components/charts/ring-center';
import { Gauge } from '@/components/charts/gauge';
import {
  mockRevenueSeries,
  mockActiveCompanyRate,
  mockTopCompaniesByCredits,
  mockCompaniesTable,
  MOCK_RING_COLORS
} from '@/lib/mock-dashboard-data';

// TODO: swap mock data for real API series once billing + analytics endpoints exist.
export function AdminAnalytics() {
  const revData = mockRevenueSeries();
  const revNow = revData[revData.length - 1]?.revenue ?? 0;
  const revPrev = revData[revData.length - 2]?.revenue ?? 0;
  const revGrowth = revPrev > 0 ? Math.round(((revNow - revPrev) / revPrev) * 100) : 0;

  const { rate: activeRate, active, total } = mockActiveCompanyRate();

  const topByCredits = mockTopCompaniesByCredits();
  const maxCredits = Math.max(1, ...topByCredits.map((c) => c.credits));
  const ringData = topByCredits.map((c, i) => ({
    label: c.companyName,
    value: c.credits,
    maxValue: maxCredits,
    color: MOCK_RING_COLORS[i % MOCK_RING_COLORS.length]
  }));

  const companiesTable = mockCompaniesTable();

  return (
    <div className="space-y-6">
      {/* Top row: revenue area (interactive) + platform gauge */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="paper rounded-[28px] p-7">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Monthly revenue</p>
              <h3 className="mt-2 font-serif text-2xl text-ink">
                ₹{revNow.toLocaleString('en-IN')}
                <span className={`ml-3 font-mono text-sm ${revGrowth >= 0 ? 'text-[#3f6f4a]' : 'text-[#a3412e]'}`}>
                  {revGrowth >= 0 ? '▲' : '▼'} {Math.abs(revGrowth)}%
                </span>
              </h3>
            </div>
            <span className="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-ink-faint">Sample data</span>
          </div>
          <div className="mt-4">
            <AreaChart data={revData} xDataKey="date" aspectRatio="2.6 / 1">
              <Grid horizontal />
              <Area dataKey="revenue" fill="var(--chart-1)" stroke="var(--chart-1)" fillOpacity={0.22} />
              <XAxis numTicks={6} />
              <ChartTooltip />
            </AreaChart>
          </div>
        </div>

        {/* Gauge — tight arc, filleted corners */}
        <div className="paper flex flex-col rounded-[28px] p-7">
          <p className="eyebrow">Active companies</p>
          <h3 className="mt-2 font-serif text-2xl text-ink">Platform health</h3>
          <div className="flex flex-1 items-center justify-center">
            <Gauge
              value={activeRate}
              centerValue={active}
              defaultLabel="active"
              totalNotches={36}
              spacing={22}
              notchCornerRadius={6}
              uniformWidth
              startAngle={-104}
              endAngle={104}
              useGradient
              activeGradient={['#1e3a8a', '#0b1b3a']}
              inactiveFill="var(--color-paper-deep)"
              inactiveFillOpacity={0.55}
              width={230}
              height={180}
            />
          </div>
          <p className="text-center text-sm text-ink-soft">
            {active} of {total} companies active
          </p>
        </div>
      </div>

      {/* Bottom row: credits ring (legend) + companies table */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        {/* Ring chart — legend */}
        <div className="paper rounded-[28px] p-7">
          <p className="eyebrow">Credits by company</p>
          <h3 className="mt-2 font-serif text-2xl text-ink">Where credits sit</h3>
          <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
            <RingChart data={ringData} size={272} strokeWidth={17} ringGap={7}>
              {ringData.map((item, index) => (
                <Ring key={item.label} index={index} />
              ))}
              <RingCenter defaultLabel="Total credits" />
            </RingChart>
            <ul className="flex-1 space-y-2.5">
              {ringData.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-ink-soft">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="font-mono text-ink">{item.value.toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Companies + plans + renewal */}
        <div className="paper rounded-[28px] p-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Active companies</p>
              <h3 className="mt-2 font-serif text-2xl text-ink">Plans &amp; renewals</h3>
            </div>
            <span className="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-ink-faint">Sample data</span>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] font-mono text-[0.6rem] uppercase tracking-[0.16em] text-ink-faint">
                  <th className="pb-3 font-medium">Company</th>
                  <th className="pb-3 font-medium">Plan</th>
                  <th className="pb-3 font-medium">Renews</th>
                  <th className="pb-3 text-right font-medium">Credits</th>
                </tr>
              </thead>
              <tbody>
                {companiesTable.map((c) => (
                  <tr key={c.companyId} className="border-b border-[color:var(--color-border)]/60 last:border-0">
                    <td className="py-3">
                      <span className="font-serif text-base text-ink">{c.companyName}</span>
                    </td>
                    <td className="py-3 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-bronze-deep">
                      {c.plan}
                    </td>
                    <td className="py-3 font-mono text-sm text-ink-soft">{c.renews}</td>
                    <td className="py-3 text-right font-mono text-sm text-ink">
                      {c.credits.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
