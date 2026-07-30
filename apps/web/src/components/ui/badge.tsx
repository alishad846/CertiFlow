import { cn } from '@/lib/cn';

export function Badge({
  className,
  tone = 'slate',
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue' }) {
  const textTones = {
    slate: 'text-ink-soft',
    blue: 'text-royal',
    green: 'text-[#3f6f4a]',
    amber: 'text-bronze-deep',
    red: 'text-[#a3412e]'
  } as const;

  const dotTones = {
    slate: 'bg-ink-faint',
    blue: 'bg-royal',
    green: 'bg-[#3f6f4a]',
    amber: 'bg-bronze',
    red: 'bg-[#a3412e]'
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em]',
        textTones[tone],
        className
      )}
      {...props}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotTones[tone])} />
      {children}
    </span>
  );
}
