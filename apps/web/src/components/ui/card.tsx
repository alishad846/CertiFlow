import { cn } from '@/lib/cn';

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] backdrop-blur',
        className
      )}
      {...props}
    />
  );
}
