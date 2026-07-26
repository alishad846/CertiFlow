'use client';

import { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';

export function CertificateArt() {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const sealRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<SVGSVGElement | null>(null);
  const linesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    if (cardRef.current) {
      animate(cardRef.current, {
        opacity: [0, 1],
        translateY: [40, 0],
        rotate: [-3, -1.5],
        duration: 1100,
        ease: 'outExpo'
      });
      // gentle perpetual float
      animate(cardRef.current, {
        translateY: [0, -12],
        duration: 3600,
        loop: true,
        alternate: true,
        ease: 'inOutSine',
        delay: 1100
      });
    }

    if (linesRef.current) {
      animate(Array.from(linesRef.current.children), {
        opacity: [0, 1],
        scaleX: [0.2, 1],
        duration: 800,
        delay: stagger(120, { start: 500 }),
        ease: 'outExpo'
      });
    }

    if (sealRef.current) {
      animate(sealRef.current, {
        opacity: [0, 1],
        scale: [0.4, 1],
        rotate: [-40, 0],
        duration: 1200,
        delay: 900,
        ease: 'outBack'
      });
    }

    if (ringRef.current) {
      animate(ringRef.current, {
        rotate: 360,
        duration: 26000,
        loop: true,
        ease: 'linear'
      });
    }
  }, []);

  return (
    <div className="relative flex items-center justify-center py-6">
      {/* soft halo */}
      <div className="absolute h-72 w-72 rounded-full bg-mist/30 blur-3xl" />
      <div className="absolute right-6 top-2 h-24 w-24 rounded-full bg-bronze/20 blur-2xl" />

      <div
        ref={cardRef}
        className="paper relative w-[20rem] max-w-full rounded-[18px] p-7 opacity-0 md:w-[22rem]"
        style={{ transform: 'rotate(-1.5deg)' }}
      >
        <div className="flex items-center justify-between">
          <span className="eyebrow">Certificate</span>
          <span className="font-mono text-[0.6rem] tracking-[0.2em] text-ink-faint">No. 0042</span>
        </div>

        <p className="mt-6 font-mono text-[0.6rem] uppercase tracking-[0.3em] text-ink-faint">
          This certifies that
        </p>
        <p className="mt-2 font-serif text-3xl leading-tight text-ink">Ada Lovelace</p>
        <div className="mt-3 h-px w-24 rule-bronze" />

        <div ref={linesRef} className="mt-6 space-y-2.5">
          <div className="h-2 w-full origin-left rounded-full bg-paper-deep/70" />
          <div className="h-2 w-5/6 origin-left rounded-full bg-paper-deep/60" />
          <div className="h-2 w-2/3 origin-left rounded-full bg-paper-deep/50" />
        </div>

        <div className="mt-8 flex items-end justify-between">
          <div>
            <div className="h-8 w-24 rounded bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%2796%27%20height=%2732%27%3E%3Cpath%20d=%27M2%2024%20C%2018%205,%2028%2028,%2044%2016%20S%2072%204,%2094%2020%27%20fill=%27none%27%20stroke=%27%230b1b3a%27%20stroke-width=%271.5%27/%3E%3C/svg%3E')] bg-contain bg-no-repeat" />
            <p className="mt-1 font-mono text-[0.55rem] uppercase tracking-[0.24em] text-ink-faint">
              Authorized signature
            </p>
          </div>

          {/* Bronze wax seal */}
          <div ref={sealRef} className="relative h-16 w-16 opacity-0">
            <svg
              ref={ringRef}
              viewBox="0 0 100 100"
              className="absolute inset-0 h-full w-full text-bronze-deep"
              aria-hidden
            >
              <defs>
                <path id="sealpath" d="M50,50 m-34,0 a34,34 0 1,1 68,0 a34,34 0 1,1 -68,0" />
              </defs>
              <text className="fill-current font-mono" style={{ fontSize: '9px', letterSpacing: '2px' }}>
                <textPath href="#sealpath">· CERTIFLOW · VERIFIED · CERTIFLOW ·</textPath>
              </text>
            </svg>
            <div className="absolute inset-2 flex items-center justify-center rounded-full bg-gradient-to-br from-bronze-bright to-bronze-deep text-paper-bright shadow-[0_8px_20px_-8px_rgba(148,112,63,0.9)]">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
