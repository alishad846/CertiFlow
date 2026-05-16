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
        'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200',
        active
          ? 'bg-ink text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)]'
          : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
      )}
    >
      {children}
    </Link>
  );
}
