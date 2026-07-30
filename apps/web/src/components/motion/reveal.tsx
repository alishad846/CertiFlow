'use client';

import { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Stagger the direct children instead of the wrapper itself. */
  group?: boolean;
  /** Entry distance in px. */
  y?: number;
  /** Delay before the animation starts (ms). */
  delay?: number;
  /** Root margin threshold for the observer. */
  once?: boolean;
  as?: keyof React.JSX.IntrinsicElements;
};

export function Reveal({
  children,
  className,
  group = false,
  y = 26,
  delay = 0,
  once = true,
  as = 'div'
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets = group ? Array.from(el.children) : [el];
    if (targets.length === 0) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Hidden initial state (set via JS so no-JS/SSR content stays visible).
    for (const t of targets) {
      (t as HTMLElement).style.opacity = '0';
      (t as HTMLElement).style.willChange = 'transform, opacity';
    }

    if (reduce) {
      for (const t of targets) (t as HTMLElement).style.opacity = '1';
      return;
    }

    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      animate(targets, {
        opacity: [0, 1],
        translateY: [y, 0],
        duration: 900,
        delay: group ? stagger(90, { start: delay }) : delay,
        ease: 'outExpo'
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            run();
            if (once) io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [group, y, delay, once]);

  const Tag = as as React.ElementType;
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
