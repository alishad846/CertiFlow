import Link from 'next/link';
import {
  ArrowUpRight,
  Upload,
  PenLine,
  FileBadge2,
  MailCheck,
  Lock,
  Layers,
  Coins,
  Sparkles,
  Gauge,
  Send
} from 'lucide-react';
import { PRICING_PLANS } from '@certiflow/shared';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/motion/reveal';
import { CountUp } from '@/components/motion/count-up';
import { SiteNav } from '@/components/site/site-nav';
import { CertificateArt } from '@/components/site/certificate-art';

const steps = [
  { n: '01', title: 'Upload your list', body: 'Drop an Excel sheet of names, emails, roles and dates. We read the columns for you.', icon: Upload },
  { n: '02', title: 'Compose the template', body: 'Place dynamic fields on your certificate background exactly where they belong.', icon: PenLine },
  { n: '03', title: 'Generate documents', body: 'Placeholders like {{name}} and {{course}} are set — your layout is never touched.', icon: FileBadge2 },
  { n: '04', title: 'Send in quiet batches', body: 'Delivery goes out in small, tracked batches with retries and full logs.', icon: MailCheck }
];

const features = [
  { icon: Lock, title: 'Your template, untouched', body: 'Only placeholders change. Fonts, seals, spacing and borders stay exactly as designed.' },
  { icon: Gauge, title: 'Delivery you can see', body: 'Sent, pending, failed, generated and credits used — all in one calm dashboard.' },
  { icon: Layers, title: 'Batch by design', body: 'A queue keeps sending controlled, resilient and kind to mail providers.' },
  { icon: Coins, title: 'Buy credits, then send', body: 'Top up credits with UPI and spend one per certificate. No seats, no subscriptions to wrestle with.' },
  { icon: Send, title: 'Send in bulk', body: 'One upload becomes thousands of personalized certificates, delivered in controlled batches.' },
  { icon: Sparkles, title: 'Simple on purpose', body: 'No workflow builder, no noise. Log in, buy credits, upload, and send. That is the whole craft.' }
];

export default function HomePage() {
  return (
    <main className="relative overflow-clip">
      <SiteNav />

      {/* ============ HERO ============ */}
      <section className="relative mx-auto flex min-h-[92vh] max-w-6xl flex-col justify-center px-5 pb-16 pt-32 md:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Reveal group>
              <p className="eyebrow">Certificate delivery, refined</p>
              <h1 className="mt-6 font-serif text-6xl leading-[0.98] tracking-tight text-ink md:text-7xl">
                Certificates,
                <br />
                <span className="italic text-bronze-deep">perfected.</span>
              </h1>
              <div className="mt-6 h-px w-40 rule-bronze" />
              <p className="mt-7 max-w-xl text-lg leading-8 text-ink-soft">
                A quietly powerful platform for bulk certificate delivery. Upload a sheet, place your fields, and let
                CertiFlow generate personalized PDFs and emails — without disturbing a single pixel of your design.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button asChild>
                  <Link href="/register">
                    Start free
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="#how">See how it works</Link>
                </Button>
              </div>
            </Reveal>
          </div>

          <CertificateArt />
        </div>
      </section>

      {/* ============ STATS BAND ============ */}
      <section className="mx-auto max-w-6xl px-5 md:px-8">
        <Reveal
          group
          className="grid gap-px overflow-hidden rounded-[28px] border border-[color:var(--color-border)] bg-[color:var(--color-border)] sm:grid-cols-3"
        >
          {[
            { value: <CountUp to={50} suffix=" / batch" />, label: 'Controlled sending' },
            { value: <span>Sent · Pending · Failed</span>, label: 'Full delivery visibility' },
            { value: <CountUp to={100} suffix="% layout" />, label: 'Template preserved' }
          ].map((stat, i) => (
            <div key={i} className="bg-paper-bright px-7 py-8">
              <p className="font-serif text-3xl text-ink">{stat.value}</p>
              <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-ink-faint">{stat.label}</p>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-28 md:px-8">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">The flow</p>
          <h2 className="mt-4 font-serif text-5xl tracking-tight text-ink">Four steps, and it is done.</h2>
          <p className="mt-4 text-lg leading-8 text-ink-soft">
            No manuals, no onboarding calls. The whole process reads like a carefully set page.
          </p>
        </Reveal>

        <Reveal group className="mt-14 grid gap-6 md:grid-cols-2">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.n} className="paper group flex gap-5 rounded-[24px] p-7 transition-transform duration-500 hover:-translate-y-1">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-paper-bright">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-serif text-2xl text-bronze-deep">{s.n}</span>
                    <span className="h-px w-8 rule-bronze" />
                    <span className="font-serif text-xl text-ink">{s.title}</span>
                  </div>
                  <p className="mt-3 text-[0.95rem] leading-7 text-ink-soft">{s.body}</p>
                </div>
              </div>
            );
          })}
        </Reveal>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" className="mx-auto max-w-6xl px-5 pb-28 md:px-8">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">What you get</p>
          <h2 className="mt-4 font-serif text-5xl tracking-tight text-ink">The features people actually use.</h2>
        </Reveal>

        <Reveal group className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="paper rounded-[24px] p-7 transition-transform duration-500 hover:-translate-y-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-bronze/30 bg-bronze/10 text-bronze-deep">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-serif text-2xl text-ink">{f.title}</h3>
                <p className="mt-3 text-[0.95rem] leading-7 text-ink-soft">{f.body}</p>
              </div>
            );
          })}
        </Reveal>
      </section>

      {/* ============ BULK VALUE PANEL ============ */}
      <section className="mx-auto max-w-6xl px-5 pb-28 md:px-8">
        <div className="paper-ink rounded-[32px] px-7 py-14 md:px-14">
          <Reveal className="max-w-2xl">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.32em] text-bronze-bright">Built for scale</p>
            <h2 className="mt-4 font-serif text-5xl tracking-tight text-paper-bright">Log in, buy credits, send thousands.</h2>
            <p className="mt-4 text-lg leading-8 text-mist">
              CertiFlow is made for organisations issuing certificates in volume. Top up credits, upload your list once,
              and deliver personalized certificates in controlled batches you can track from start to finish.
            </p>
          </Reveal>

          <Reveal group className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { k: '01', title: 'Sign in', body: 'Create your organisation account in a minute — no sales call, no setup fee.' },
              { k: '02', title: 'Buy credits', body: 'Top up with UPI and spend exactly one credit per certificate. Nothing more.' },
              { k: '03', title: 'Send in bulk', body: 'Upload, compose once, and issue thousands of certificates with delivery you can watch.' }
            ].map((r) => (
              <div key={r.k} className="rounded-[22px] border border-mist/20 bg-paper-bright/5 p-7 backdrop-blur-sm">
                <span className="font-serif text-3xl text-bronze-bright">{r.k}</span>
                <div className="mt-3 h-px w-10 rule-bronze" />
                <h3 className="mt-4 font-serif text-2xl text-paper-bright">{r.title}</h3>
                <p className="mt-3 text-sm leading-6 text-mist">{r.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 pb-28 md:px-8">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Pricing</p>
          <h2 className="mt-4 font-serif text-5xl tracking-tight text-ink">Credits, with strict control.</h2>
          <p className="mt-4 text-lg leading-8 text-ink-soft">
            Sold in fixed plans. Super admins approve credit purchases and manage discounts only within allowed rules.
          </p>
        </Reveal>

        <Reveal group className="mt-14 grid gap-6 md:grid-cols-3">
          {PRICING_PLANS.map((plan) => (
            <div key={plan.key} className={plan.recommended ? 'paper-ink rounded-[24px] p-8' : 'paper rounded-[24px] p-8'}>
              <div className="flex items-center justify-between">
                <p
                  className={
                    plan.recommended
                      ? 'font-mono text-[0.65rem] uppercase tracking-[0.24em] text-bronze-bright'
                      : 'font-mono text-[0.65rem] uppercase tracking-[0.24em] text-ink-faint'
                  }
                >
                  {plan.name}
                </p>
                {plan.recommended ? (
                  <span className="font-serif text-sm italic text-bronze-bright">Recommended</span>
                ) : null}
              </div>
              <p className={plan.recommended ? 'mt-6 font-serif text-4xl text-paper-bright' : 'mt-6 font-serif text-4xl text-ink'}>
                ₹{plan.amountInr.toLocaleString('en-IN')}
              </p>
              <p className={plan.recommended ? 'mt-1 text-sm text-mist' : 'mt-1 text-sm text-ink-soft'}>
                {plan.credits.toLocaleString('en-IN')} credits
              </p>
              <Button asChild variant={plan.recommended ? 'bronze' : 'secondary'} className="mt-7 w-full">
                <Link href="/register">Choose {plan.name}</Link>
              </Button>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ============ CTA ============ */}
      <section className="mx-auto max-w-6xl px-5 pb-28 md:px-8">
        <Reveal className="paper relative overflow-hidden rounded-[32px] px-7 py-16 text-center md:px-14">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-bronze/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-mist/25 blur-3xl" />
          <p className="eyebrow relative">Begin</p>
          <h2 className="relative mx-auto mt-5 max-w-2xl font-serif text-5xl leading-tight tracking-tight text-ink md:text-6xl">
            One quiet dashboard. One simple flow.
          </h2>
          <div className="relative mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/register">
                Create your account
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </Reveal>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-[color:var(--color-border)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink font-serif text-lg text-paper-bright">
              C
            </span>
            <span className="font-serif text-xl text-ink">CertiFlow</span>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
            <Link href="#how" className="transition-colors hover:text-ink">How it works</Link>
            <Link href="#features" className="transition-colors hover:text-ink">Features</Link>
            <Link href="#pricing" className="transition-colors hover:text-ink">Pricing</Link>
            <Link href="/login" className="transition-colors hover:text-ink">Login</Link>
          </div>
          <p className="font-mono text-[0.65rem] tracking-[0.16em] text-ink-faint">© {new Date().getFullYear()} CERTIFLOW</p>
        </div>
      </footer>
    </main>
  );
}
