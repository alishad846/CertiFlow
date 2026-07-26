import { cn } from '@/lib/cn';

export function Badge({
  className,
  tone = 'slate',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue' }) {
  const tones = {
    slate: 'bg-mist-soft/50 text-ink border border-[color:var(--color-border)]',
    blue: 'bg-royal/10 text-royal border border-royal/20',
    green: 'bg-[#3f6f4a]/12 text-[#3f6f4a] border border-[#3f6f4a]/20',
    amber: 'bg-bronze/15 text-bronze-deep border border-bronze/25',
    red: 'bg-[#a3412e]/12 text-[#a3412e] border border-[#a3412e]/20'
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[0.65rem] font-medium uppercase tracking-[0.18em]',
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
