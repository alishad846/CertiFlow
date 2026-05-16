import { Card } from './card';

export function StatCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(42,141,240,0.12),transparent_45%)]" />
      <div className="relative">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className="mt-3 text-3xl font-semibold tracking-tight text-ink">{value}</div>
        {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
      </div>
    </Card>
  );
}
