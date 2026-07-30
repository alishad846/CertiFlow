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
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-faint">{label}</p>
      <div className="mt-3 font-serif text-3xl text-ink">{value}</div>
      {hint ? <p className="mt-2 text-sm text-ink-soft">{hint}</p> : null}
    </Card>
  );
}
