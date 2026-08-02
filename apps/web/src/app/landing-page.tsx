'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'motion/react';
import {
  ArrowRight, Upload, Layout, FileText, Send,
  BarChart2, Shield, Zap, Users, CreditCard, Menu, X, Check
} from 'lucide-react';
import { PRICING_PLANS } from '@certiflow/shared';

/* Gentle easing used across reveals. */
const EASE = [0.22, 1, 0.36, 1] as const;

type FadeUpProps = { children: React.ReactNode; delay?: number; className?: string };

function GrainOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[200]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23g)'/%3E%3C/svg%3E")`,
        opacity: 0.055,
        mixBlendMode: 'overlay'
      }}
    />
  );
}

/* Scroll reveal — one-time, slow and gentle. */
function FadeUp({ children, delay = 0, className = '' }: FadeUpProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.08 });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.95, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function CertificateMockup({ className }: { className?: string }) {
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a = ((i * 22.5) * Math.PI) / 180;
    return { x1: 218 + 18 * Math.cos(a), y1: 268 + 18 * Math.sin(a), x2: 218 + 25 * Math.cos(a), y2: 268 + 25 * Math.sin(a) };
  });
  return (
    <svg viewBox="0 0 450 318" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="certPaper" x1="0" y1="0" x2="0" y2="318" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDFAF2" />
          <stop offset="100%" stopColor="#F6F0E4" />
        </linearGradient>
        <linearGradient id="certGold" x1="0" y1="0" x2="450" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#B8922E" />
          <stop offset="40%" stopColor="#E2B84A" />
          <stop offset="100%" stopColor="#B8922E" />
        </linearGradient>
        <filter id="certShadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="6" stdDeviation="12" floodColor="#0B1628" floodOpacity="0.18" />
        </filter>
      </defs>
      <rect width="450" height="318" rx="8" fill="url(#certPaper)" filter="url(#certShadow)" />
      <rect x="11" y="11" width="428" height="296" rx="5" fill="none" stroke="url(#certGold)" strokeWidth="1.6" />
      <rect x="20" y="20" width="410" height="278" rx="3" fill="none" stroke="#B8922E" strokeWidth="0.55" strokeDasharray="5 3" opacity="0.45" />
      <path d="M11 36 Q11 11 36 11" stroke="#B8922E" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="24" r="3" fill="#B8922E" /><circle cx="24" cy="24" r="1.5" fill="#F6F0E4" />
      <path d="M439 36 Q439 11 414 11" stroke="#B8922E" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <circle cx="426" cy="24" r="3" fill="#B8922E" /><circle cx="426" cy="24" r="1.5" fill="#F6F0E4" />
      <path d="M11 282 Q11 307 36 307" stroke="#B8922E" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="294" r="3" fill="#B8922E" /><circle cx="24" cy="294" r="1.5" fill="#F6F0E4" />
      <path d="M439 282 Q439 307 414 307" stroke="#B8922E" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <circle cx="426" cy="294" r="3" fill="#B8922E" /><circle cx="426" cy="294" r="1.5" fill="#F6F0E4" />
      <text x="40" y="52" fontFamily="serif" fontSize="8" letterSpacing="3" fill="#9A8E7A">CERTIFICATE</text>
      <text x="40" y="78" fontFamily="serif" fontSize="8" letterSpacing="2" fill="#9A8E7A">THIS CERTIFIES THAT</text>
      <text x="40" y="112" fontFamily="serif" fontSize="26" fill="#0B1628">Ada Lovelace</text>
      <rect x="40" y="132" width="300" height="4" rx="2" fill="#B8922E" opacity="0.28" />
      <rect x="40" y="150" width="360" height="4" rx="2" fill="#7A6E5E" opacity="0.14" />
      <rect x="40" y="164" width="330" height="4" rx="2" fill="#7A6E5E" opacity="0.14" />
      <rect x="40" y="178" width="280" height="4" rx="2" fill="#7A6E5E" opacity="0.14" />
      <path d="M40 232 Q70 214 100 228 Q124 239 150 222" stroke="#0B1628" strokeWidth="1.6" fill="none" opacity="0.55" strokeLinecap="round" />
      <line x1="40" y1="248" x2="180" y2="248" stroke="#0B1628" strokeWidth="0.5" opacity="0.25" />
      <text x="40" y="262" fontFamily="serif" fontSize="7" letterSpacing="2" fill="#9A8E7A">AUTHORIZED SIGNATURE</text>
      <circle cx="218" cy="268" r="30" fill="#B8922E" opacity="0.08" />
      <circle cx="218" cy="268" r="24" fill="none" stroke="#B8922E" strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />
      {rays.map((r, i) => (
        <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke="#B8922E" strokeWidth="0.9" opacity="0.45" />
      ))}
      <path d="M218 255 L220.6 263.2 L229.4 263.2 L222.4 268.4 L225 276.6 L218 271.4 L211 276.6 L213.6 268.4 L206.6 263.2 L215.4 263.2 Z" fill="#B8922E" opacity="0.82" />
      <text x="420" y="37" textAnchor="end" fontFamily="sans-serif" fontSize="7" fill="#9A8E7A" opacity="0.65">No. 2024-0142</text>
    </svg>
  );
}

function OfferLetterMockup({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 380 508" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="offerGold" x1="0" y1="0" x2="376" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#B8922E" /><stop offset="50%" stopColor="#E2B84A" /><stop offset="100%" stopColor="#B8922E" />
        </linearGradient>
        <linearGradient id="offerPaper" x1="0" y1="0" x2="0" y2="508" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDFAF2" /><stop offset="100%" stopColor="#F4EFE3" />
        </linearGradient>
        <filter id="offerShadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="8" stdDeviation="14" floodColor="#0B1628" floodOpacity="0.22" />
        </filter>
      </defs>
      <rect x="2" y="2" width="376" height="504" rx="7" fill="url(#offerPaper)" filter="url(#offerShadow)" />
      <rect x="2" y="2" width="376" height="8" rx="4" fill="url(#offerGold)" />
      <rect x="2" y="496" width="376" height="8" rx="4" fill="#0B1628" opacity="0.06" />
      <rect x="2" y="2" width="376" height="504" rx="7" stroke="#E4D8BE" strokeWidth="1" />
      <rect x="2" y="10" width="376" height="78" fill="#F8F4E8" />
      <line x1="2" y1="88" x2="378" y2="88" stroke="#B8922E" strokeWidth="0.7" opacity="0.42" />
      <circle cx="38" cy="48" r="20" fill="#0B1628" opacity="0.06" />
      <circle cx="38" cy="48" r="16" fill="none" stroke="#B8922E" strokeWidth="1.2" opacity="0.5" />
      <text x="38" y="54" textAnchor="middle" fontFamily="serif" fontSize="15" fontWeight="700" fill="#0B1628" opacity="0.85">CF</text>
      <text x="66" y="40" fontFamily="serif" fontSize="15" fontWeight="500" fill="#0B1628">CertiFlow</text>
      <text x="66" y="56" fontFamily="sans-serif" fontSize="7.5" letterSpacing="2.5" fill="#7A6E5E">TECHNOLOGIES PVT. LTD.</text>
      <text x="358" y="38" textAnchor="end" fontFamily="sans-serif" fontSize="8" fill="#7A6E5E">December 15, 2024</text>
      <text x="28" y="116" fontFamily="sans-serif" fontSize="9.5" fill="#3E3228">Dear Ms. Ada Lovelace,</text>
      <text x="28" y="144" fontFamily="serif" fontSize="20" fontWeight="500" fill="#0B1628">Letter of Offer</text>
      <rect x="28" y="150" width="110" height="2.2" rx="1.1" fill="#B8922E" opacity="0.85" />
      <rect x="28" y="168" width="322" height="7" rx="2.5" fill="#7A6E5E" opacity="0.11" />
      <rect x="28" y="182" width="322" height="7" rx="2.5" fill="#7A6E5E" opacity="0.11" />
      <rect x="28" y="196" width="268" height="7" rx="2.5" fill="#7A6E5E" opacity="0.11" />
      <rect x="28" y="218" width="322" height="70" rx="6" fill="#EEE0BE" opacity="0.38" />
      <rect x="28" y="218" width="4" height="70" rx="2" fill="#B8922E" />
      <text x="42" y="238" fontFamily="sans-serif" fontSize="7.5" fill="#7A6E5E" letterSpacing="1.8">POSITION OFFERED</text>
      <text x="42" y="257" fontFamily="serif" fontSize="14.5" fontWeight="500" fill="#0B1628">Senior Software Engineer</text>
      <text x="42" y="274" fontFamily="sans-serif" fontSize="8.5" fill="#3E3228">Annual CTC: ₹24,00,000 · Start: January 15, 2025</text>
      <path d="M28 400 Q46 383 64 391 Q80 398 98 384 Q112 374 132 387" stroke="#0B1628" strokeWidth="1.6" fill="none" opacity="0.62" strokeLinecap="round" />
      <line x1="28" y1="412" x2="168" y2="412" stroke="#0B1628" strokeWidth="0.55" opacity="0.26" />
      <text x="28" y="424" fontFamily="sans-serif" fontSize="9" fill="#0B1628" fontWeight="500">Rajiv Mehta</text>
      <text x="28" y="436" fontFamily="sans-serif" fontSize="8" fill="#7A6E5E">Head of Human Resources</text>
      <circle cx="312" cy="422" r="37" fill="#B8922E" opacity="0.06" />
      <circle cx="312" cy="422" r="32" fill="none" stroke="#B8922E" strokeWidth="1" strokeDasharray="2.5 2" opacity="0.42" />
      <text x="312" y="425" textAnchor="middle" fontFamily="serif" fontSize="10" fontWeight="700" fill="#B8922E">CF</text>
    </svg>
  );
}

function Nav() {
  const [open, setOpen] = useState(false);
  const links = [
    { label: 'How it works', href: '#how' },
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' }
  ];
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-[color:var(--color-border)] bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink">
            <span className="font-serif text-xs font-semibold text-[#EEE0BE]">C</span>
          </div>
          <span className="font-serif text-[17px] font-medium tracking-tight text-ink">CertiFlow</span>
        </div>
        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l.label} href={l.href} className="text-sm text-ink/55 transition-colors hover:text-ink">{l.label}</a>
          ))}
        </div>
        <div className="hidden items-center gap-5 md:flex">
          <Link href="/login" className="text-sm text-ink/55 transition-colors hover:text-ink">Login</Link>
          <Link href="/register" className="flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm text-[#EEE0BE] transition-all duration-200 hover:bg-[#1A2F52]">
            Get started <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="p-1 text-ink md:hidden" aria-label="Menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-4 border-t border-[color:var(--color-border)] px-6 pb-5 pt-2 md:hidden">
          {links.map((l) => <a key={l.label} href={l.href} className="text-sm text-ink/70">{l.label}</a>)}
          <Link href="/login" className="text-sm text-ink/70">Login</Link>
          <Link href="/register" className="rounded-full bg-ink px-5 py-2.5 text-center text-sm text-[#EEE0BE]">Get started</Link>
        </div>
      )}
    </nav>
  );
}

function Hero() {
  // Every document in the hero stack lives here. Adjust left/right, top, w, rotate,
  // or z-* on any entry to reposition it or move it in front of another document.
  const documentStack = [
    { type: 'image', src: '/landing/offer-letter-gold.png', alt: 'Gold offer letter template', className: 'right-13 top-50 z-0 w-[198px]', rotate: -6, float: 10, duration: 5, delay: 0.35 },
    { type: 'image', src: '/landing/certificate-ornate.png', alt: 'Ornate certificate template', className: 'left-5 top-2 z-25 w-[315px]', rotate: -12, float: 7, duration: 15, delay: 0.15 },
    { type: 'offer-svg', className: 'right-3 top-1 z-20 w-[190px]', rotate: 15, float: 8, duration: 13, delay: 0.6 },
    { type: 'image', src: '/landing/offer-letter-blue.png', alt: 'Blue offer letter template', className: 'right-8 top-14 z-30 w-[210px]', rotate: -10, float: 6, duration: 13, delay: 0.8 },
    { type: 'certificate-svg', className: 'left-0 top-28 z-40 w-[365px]', rotate: 2, float: 10, duration: 11, delay: 0 },
    { type: 'image', src: '/landing/certificate-modern.png', alt: 'Modern certificate template', className: 'left-12 top-50 z-50 w-[340px]', rotate: -5, float: 9, duration: 14, delay: 0.5 }
  ];

  return (
    <section className="flex min-h-screen items-center overflow-hidden px-6 pb-16 pt-20">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <div>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
            className="mb-7 text-[11px] uppercase tracking-[4px] text-bronze">Certificate Delivery, Refined</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.22, ease: EASE }}
            className="mb-6 font-serif text-[clamp(3rem,6vw,5.5rem)] font-light leading-[1.02] text-ink">
            Certificates,<br /><span className="italic text-bronze">perfected.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, delay: 0.38 }}
            className="mb-10 max-w-[440px] text-[17px] leading-[1.75] text-ink-soft">
            A quietly powerful platform for bulk certificate and offer letter delivery. Upload a sheet, place your fields,
            and let CertiFlow generate personalized PDFs — without disturbing a single pixel of your design.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, delay: 0.54 }}
            className="flex flex-wrap items-center gap-4">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-[#EEE0BE] transition-all duration-200 hover:gap-3 hover:bg-[#1A2F52]">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how" className="border-b border-ink/28 pb-0.5 text-sm text-ink/60 transition-all hover:border-ink/60 hover:text-ink">See how it works</a>
          </motion.div>
        </div>
        <div className="relative hidden h-[500px] lg:block" aria-label="A selection of certificate and offer letter templates">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[340px] w-[340px] rounded-full blur-[80px]" style={{ background: 'radial-gradient(circle, rgba(184,146,46,0.18) 0%, transparent 70%)' }} />
          </div>
          {documentStack.map((document, index) => (
            <motion.div
              key={`${document.type}-${index}`}
              initial={{ opacity: 0, scale: 0.94, y: 22, rotate: document.rotate - 3 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotate: document.rotate }}
              transition={{ duration: 1.05, delay: 0.42 + index * 0.12, ease: EASE }}
              className={`absolute ${document.className}`}
            >
              <motion.div animate={{ y: [0, -document.float, 0], rotate: [0, 0.7, 0] }} transition={{ duration: document.duration, repeat: Infinity, ease: 'easeInOut', delay: document.delay }}>
                {document.type === 'image' ? (
                  <img src={document.src} alt={document.alt} className="w-full rounded-[5px] border border-white/70 shadow-[0_18px_38px_rgba(11,22,40,0.22)]" />
                ) : document.type === 'offer-svg' ? (
                  <OfferLetterMockup className="w-full" />
                ) : (
                  <CertificateMockup className="w-full" />
                )}
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const STATS = [
  { value: '50 / batch', tag: 'Controlled Sending', note: 'Process documents in measured batches' },
  { value: 'Sent · Pending · Failed', tag: 'Full Delivery Visibility', note: 'Track every certificate in real time' },
  { value: '100% layout', tag: 'Template Preserved', note: 'Pixel-perfect output, every time' }
];

function Stats() {
  return (
    <FadeUp>
      <div className="border-y border-[color:var(--color-border)] bg-paper-dim/40">
        <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-[color:var(--color-border)] px-6 py-10 md:grid-cols-3 md:divide-x md:divide-y-0">
          {STATS.map((s) => (
            <div key={s.tag} className="px-8 py-5 first:pl-0 last:pr-0">
              <p className="mb-1 font-serif text-xl font-medium text-ink">{s.value}</p>
              <p className="mb-1 text-[10px] uppercase tracking-[3px] text-bronze">{s.tag}</p>
              <p className="text-sm text-ink-soft">{s.note}</p>
            </div>
          ))}
        </div>
      </div>
    </FadeUp>
  );
}

const STEPS = [
  { num: '01', icon: <Upload className="h-5 w-5" />, title: 'Upload your list', body: 'Drop an Excel sheet of names, emails, roles and dates. We read the columns for you.' },
  { num: '02', icon: <Layout className="h-5 w-5" />, title: 'Compose the template', body: 'Place dynamic fields on your certificate background exactly where they belong.' },
  { num: '03', icon: <FileText className="h-5 w-5" />, title: 'Generate documents', body: 'Placeholders like {{name}} and {{course}} are set — your layout is never touched.' },
  { num: '04', icon: <Send className="h-5 w-5" />, title: 'Send in quiet batches', body: 'Delivery goes out in small, tracked batches with retries and full logs.' }
];

function HowItWorks() {
  return (
    <section id="how" className="px-6 py-28">
      <div className="mx-auto max-w-7xl">
        <FadeUp>
          <p className="mb-4 text-[11px] uppercase tracking-[4px] text-bronze">The Flow</p>
          <h2 className="mb-4 font-serif text-[clamp(2.2rem,4.5vw,3.4rem)] font-light leading-[1.1] text-ink">Four steps, and it is done.</h2>
          <p className="mb-16 max-w-lg text-[16px] leading-relaxed text-ink-soft">No manuals, no onboarding calls. The whole process reads like a carefully set design.</p>
        </FadeUp>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <FadeUp key={step.num} delay={i * 0.1}>
              <motion.div whileHover={{ y: -5, transition: { duration: 0.3 } }} className="h-full cursor-default rounded-2xl border border-[color:var(--color-border)] bg-paper-bright p-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-[#EEE0BE]">{step.icon}</div>
                  <div>
                    <span className="text-[10px] font-medium uppercase tracking-[3px] text-bronze">{step.num}</span>
                    <h3 className="mb-2 mt-0.5 font-serif text-[18px] font-medium text-ink">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-ink-soft">{step.body}</p>
                  </div>
                </div>
              </motion.div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: Shield, title: 'Your template, untouched', body: 'Only placeholders change. Fonts, seals, spacing and borders stay exactly as designed.' },
  { icon: BarChart2, title: 'Delivery you can see', body: 'Sent, pending, failed, generated and credits used — all in one calm dashboard.' },
  { icon: Users, title: 'Batch by design', body: 'A queue keeps sending controlled, resilient and kind to mail providers.' },
  { icon: CreditCard, title: 'Buy credits, then send', body: 'Top up with UPI and spend one per certificate. No seats, no subscriptions to wrestle with.' },
  { icon: Zap, title: 'Send in bulk', body: 'One upload becomes thousands of personalized certificates, delivered in controlled batches.' },
  { icon: FileText, title: 'Simple on purpose', body: 'No workflow builder, no noise. Log in, buy credits, upload, and send. That is the whole craft.' }
];

function Features() {
  return (
    <section id="features" className="bg-paper-dim/50 px-6 py-28">
      <div className="mx-auto max-w-7xl">
        <FadeUp>
          <p className="mb-4 text-[11px] uppercase tracking-[4px] text-bronze">What you get</p>
          <h2 className="mb-16 font-serif text-[clamp(2.2rem,4.5vw,3.4rem)] font-light leading-[1.1] text-ink">The features people actually use.</h2>
        </FadeUp>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <FadeUp key={f.title} delay={i * 0.07}>
                <motion.div whileHover={{ y: -5, transition: { duration: 0.3 } }} className="h-full cursor-default rounded-2xl border border-[color:var(--color-border)] bg-paper-bright p-7">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(184,146,46,0.12)' }}>
                    <Icon className="h-5 w-5 text-bronze" />
                  </div>
                  <h3 className="mb-2 font-serif text-[16px] font-medium text-ink">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-soft">{f.body}</p>
                </motion.div>
              </FadeUp>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const SCALE_STEPS = [
  { num: '01', title: 'Sign in', body: 'Create your organisation account in a minute — no sales call, no setup fee.' },
  { num: '02', title: 'Buy credits', body: 'Top up with UPI and spend exactly one credit per certificate. Nothing more.' },
  { num: '03', title: 'Send in bulk', body: 'Upload, compose once, and issue thousands with delivery you can watch.' }
];

function ScaleSection() {
  return (
    <section className="relative overflow-hidden bg-ink px-6 py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='g2'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.68' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23g2)'/%3E%3C/svg%3E")` }} />
      <div className="relative z-10 mx-auto max-w-7xl">
        <FadeUp>
          <p className="mb-6 text-[11px] uppercase tracking-[4px] text-bronze">Built for scale</p>
          <h2 className="mb-6 max-w-2xl font-serif text-[clamp(2.2rem,5vw,3.8rem)] font-light leading-[1.06] text-white">Log in, buy credits,<br />send thousands.</h2>
          <p className="mb-20 max-w-lg text-[16px] leading-relaxed text-white/45">
            CertiFlow is made for organisations issuing certificates in volume. Top up credits, upload your list once,
            and deliver personalized certificates in controlled batches you can track from start to finish.
          </p>
        </FadeUp>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {SCALE_STEPS.map((s, i) => (
            <FadeUp key={s.num} delay={i * 0.12}>
              <motion.div whileHover={{ y: -4, transition: { duration: 0.3 } }} className="cursor-default rounded-2xl border border-white/10 p-8" style={{ background: 'rgba(255,255,255,0.045)' }}>
                <p className="mb-5 text-[10px] uppercase tracking-[3px] text-bronze">{s.num}</p>
                <h3 className="mb-3 font-serif text-[22px] font-light text-white">{s.title}</h3>
                <p className="text-sm leading-relaxed text-white/45">{s.body}</p>
              </motion.div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  return (
    <section id="pricing" className="px-6 py-28">
      <div className="mx-auto max-w-7xl">
        <FadeUp>
          <p className="mb-4 text-[11px] uppercase tracking-[4px] text-bronze">Pricing</p>
          <h2 className="mb-4 font-serif text-[clamp(2.2rem,4.5vw,3.4rem)] font-light leading-[1.1] text-ink">Credits, with strict control.</h2>
          <p className="mb-16 max-w-lg text-[16px] leading-relaxed text-ink-soft">Sold in fixed credit packs. Every issued document spends one credit — no seats, no subscriptions.</p>
        </FadeUp>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PRICING_PLANS.map((plan, i) => {
            const featured = Boolean(plan.recommended);
            return (
              <FadeUp key={plan.key} delay={i * 0.1}>
                <motion.div whileHover={{ y: -6, transition: { duration: 0.3 } }}
                  className={`relative h-full cursor-default rounded-2xl p-8 ${featured ? 'border-2 border-bronze/55 bg-ink text-white' : 'border border-[color:var(--color-border)] bg-paper-bright text-ink'}`}
                  style={featured ? { boxShadow: '0 8px 40px rgba(184,146,46,0.18), 0 2px 12px rgba(11,22,40,0.2)' } : {}}>
                  {featured && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-bronze px-3 py-1 text-[11px] tracking-wide text-white">Recommended</span>
                  )}
                  <p className={`mb-5 text-[10px] uppercase tracking-[3px] ${featured ? 'text-bronze' : 'text-ink-soft'}`}>{plan.name}</p>
                  <p className={`mb-1 font-serif text-[2.2rem] font-medium ${featured ? 'text-white' : 'text-ink'}`}>{inr(plan.amountInr)}</p>
                  <p className={`mb-6 text-sm ${featured ? 'text-white/45' : 'text-ink-soft'}`}>{plan.credits.toLocaleString('en-IN')} credits</p>
                  <ul className={`mb-8 space-y-2.5 border-t pt-6 ${featured ? 'border-white/12' : 'border-[color:var(--color-border)]'}`}>
                    {plan.features.map((feature) => (
                      <li key={feature} className={`flex items-start gap-2.5 text-sm ${featured ? 'text-white/70' : 'text-ink-soft'}`}>
                        <Check className={`mt-0.5 h-4 w-4 shrink-0 ${featured ? 'text-bronze' : 'text-bronze'}`} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/register"
                    className={`block w-full rounded-xl py-3 text-center text-sm font-medium transition-colors ${featured ? 'bg-bronze text-white hover:bg-bronze-bright' : 'border border-ink/22 text-ink hover:bg-ink hover:text-[#EEE0BE]'}`}>
                    Choose {plan.name}
                  </Link>
                </motion.div>
              </FadeUp>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="bg-paper-dim/50 px-6 py-32">
      <div className="mx-auto max-w-3xl text-center">
        <FadeUp>
          <p className="mb-8 text-[11px] uppercase tracking-[4px] text-bronze">Begin</p>
          <h2 className="mb-14 font-serif text-[clamp(2.6rem,6vw,5rem)] font-light leading-[1.08] text-ink">One quiet dashboard.<br />One simple flow.</h2>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-sm font-medium text-[#EEE0BE] transition-all duration-200 hover:bg-[#1A2F52]">
              Create your account <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="text-sm text-ink/55 transition-colors hover:text-ink">Sign in</Link>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[color:var(--color-border)] px-6 py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink">
            <span className="font-serif text-[10px] font-semibold text-[#EEE0BE]">C</span>
          </div>
          <span className="font-serif text-[15px] font-medium text-ink">CertiFlow</span>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          {[{ label: 'How it works', href: '#how' }, { label: 'Features', href: '#features' }, { label: 'Pricing', href: '#pricing' }, { label: 'Login', href: '/login' }].map((l) => (
            <a key={l.label} href={l.href} className="text-[10px] uppercase tracking-[2.5px] text-ink-soft transition-colors hover:text-ink">{l.label}</a>
          ))}
        </div>
        <p className="text-[11px] text-ink-faint">© 2026 CertiFlow</p>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-paper text-ink">
      <GrainOverlay />
      <Nav />
      <Hero />
      <Stats />
      <HowItWorks />
      <Features />
      <ScaleSection />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}
