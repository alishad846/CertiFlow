'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';

const links = [
  { href: '#how', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' }
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        className={cn(
          'pointer-events-auto flex w-full max-w-5xl items-center justify-between rounded-full border px-4 py-2.5 transition-all duration-500 md:px-5',
          scrolled
            ? 'border-[color:var(--color-border)] bg-paper-bright/80 shadow-[0_18px_50px_-30px_rgba(11,27,58,0.6)] backdrop-blur-xl'
            : 'border-transparent bg-transparent'
        )}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-ink text-paper-bright">
            <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-bronze/40" />
            <span className="font-serif text-lg leading-none">C</span>
          </span>
          <span className="font-serif text-xl tracking-tight text-ink">CertiFlow</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm text-ink-soft transition-colors hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="group inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper-bright transition-all duration-300 hover:bg-royal"
          >
            Get started
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        <button
          type="button"
          aria-label="Menu"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open ? (
        <div className="pointer-events-auto fixed inset-0 top-0 z-40 flex flex-col bg-paper/95 px-6 pt-24 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-[color:var(--color-border)] py-4 font-serif text-2xl text-ink"
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-full border border-[color:var(--color-border)] px-5 py-3 text-center text-sm text-ink"
            >
              Login
            </Link>
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className="rounded-full bg-ink px-5 py-3 text-center text-sm font-medium text-paper-bright"
            >
              Get started
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
