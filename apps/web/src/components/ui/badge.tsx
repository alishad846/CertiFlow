import { cn } from '@/lib/cn';

export function Badge({
  className,
  tone = 'slate',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-rose-100 text-rose-700',
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-sky-100 text-sky-700'
  } as const;

  return <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-semibold', tones[tone], className)} {...props} />;
}
