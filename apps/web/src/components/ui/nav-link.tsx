import Link from 'next/link';
import { cn } from '@/lib/cn';

export function NavLink({
  href,
  active,
  children
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium tracking-wide transition-all duration-200',
        active
          ? 'bg-ink text-paper-bright shadow-[0_16px_40px_-22px_rgba(11,27,58,0.8)]'
          : 'text-ink-soft hover:bg-paper-dim hover:text-ink'
      )}
    >
      {children}
    </Link>
  );
}
