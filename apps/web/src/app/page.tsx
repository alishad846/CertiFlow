import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Blocks,
  ChevronRight,
  CircleDollarSign,
  FileBadge2,
  Globe2,
  Layers3,
  Lock,
  MailCheck,
  ShieldCheck,
  Sparkles,
  Upload,
  Users2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getLivePricingPlans } from '@/lib/pricing';

const workflow = [
  {
    step: '01',
    title: 'Upload data',
    description: 'Drag and drop the Excel sheet with name, email, role, and date columns.',
    icon: Upload
  },
  {
    step: '02',
    title: 'Set the template',
    description: 'Upload a PNG or JPG background and place dynamic fields exactly where you want them.',
    icon: FileBadge2
  },
  {
    step: '03',
    title: 'Generate PDFs',
    description: 'Placeholders like {{name}} and {{course}} are replaced automatically.',
    icon: Layers3
  },
  {
    step: '04',
    title: 'Send in batches',
    description: 'Emails go out in small, tracked batches with retry support and logs.',
    icon: MailCheck
  }
];

const roles = [
  {
    title: 'Super Admin',
    icon: ShieldCheck,
    tone: 'blue',
    points: ['Create companies', 'Approve UPI top-ups', 'Set strict discounts', 'View platform-wide stats']
  },
  {
    title: 'Company Admin',
    icon: Users2,
    tone: 'green',
    points: ['Upload Excel + template', 'Launch certificate batches', 'Track delivery status', 'Use company credits']
  },
  {
    title: 'Recipient',
    icon: BadgeCheck,
    tone: 'amber',
    points: ['Receives personalized PDF', 'Gets professional email', 'Sees exact template output', 'No portal learning needed']
  }
];

const featureCards = [
  {
    icon: Lock,
    title: 'Template stays untouched',
    description: 'Only placeholders are replaced. Fonts, logos, spacing, and borders remain exactly like the uploaded certificate background.'
  },
  {
    icon: Globe2,
    title: 'Built for real teams',
    description: 'Works for EdTech certificate delivery with a beginner-friendly flow.'
  },
  {
    icon: CircleDollarSign,
    title: 'Credit-based billing',
    description: 'Buy credits through UPI top-ups and apply strict company discount rules only when allowed.'
  },
  {
    icon: BarChart3,
    title: 'Clear delivery visibility',
    description: 'See sent, pending, failed, generated documents, and credit usage in one dashboard.'
  },
  {
    icon: Blocks,
    title: 'Batch automation',
    description: 'Queue-based processing keeps sending controlled, resilient, and safer for mail providers.'
  },
  {
    icon: Sparkles,
    title: 'Simple by design',
    description: 'No workflow builder, no AI noise, no complicated ops panel. Just upload, generate, send.'
  }
];

const pricingFeatureList = [
  'Strict plan pricing',
  'UPI payment requests',
  'Super admin approval',
  'Credit deduction per recipient'
];

export default async function HomePage() {
  const pricingPlans = await getLivePricingPlans();

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-4 text-ink md:px-6 md:py-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="absolute right-[-6rem] top-12 h-96 w-96 rounded-full bg-slate-900/8 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/3 h-[26rem] w-[26rem] rounded-full bg-cyan-200/25 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.06) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.55), transparent)'
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/70 bg-white/80 px-5 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-white shadow-glow">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">CertiFlow</p>
              <p className="text-lg font-bold tracking-tight">Bulk documents, credits, and controlled delivery</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="ghost">
              <Link href="/pricing">Pricing</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/register">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="relative overflow-hidden border-white/80 bg-white/80 p-7 md:p-10">
            <div className="absolute right-6 top-6 hidden h-20 w-20 rounded-full border border-sky-200/80 bg-sky-100/70 blur-[1px] md:block" />
            <div className="absolute bottom-6 right-10 hidden h-14 w-14 rounded-2xl border border-slate-200/70 bg-white/70 shadow-lg md:block" />

            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="blue" className="gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                3D SaaS landing page
              </Badge>
              <Badge tone="slate">For EdTech + HR teams</Badge>
              <Badge tone="green">Strict pricing rules</Badge>
            </div>

            <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight text-slate-950 md:text-7xl" style={{ fontFamily: 'var(--font-heading)' }}>
              A clean workflow for bulk certificate delivery.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Upload an Excel sheet, place fields on a certificate background, and let CertiFlow generate personalized PDFs and
              emails without changing the original design.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/register">
                  Start free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Delivery visibility', value: 'Sent / Pending / Failed' },
                { label: 'Batch size', value: '50 emails' },
                { label: 'Template safety', value: 'Layout preserved' }
              ].map((item) => (
                <div key={item.label} className="rounded-3xl border border-slate-200/70 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-base font-bold text-slate-950">{item.value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="relative overflow-hidden border-slate-200/70 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-6 text-white shadow-[0_28px_90px_rgba(15,23,42,0.25)] md:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.28),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_30%)]" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-sky-100/80">3D delivery pipeline</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight">Excel → Template → PDF → Email</h2>
                </div>
                <Badge tone="blue" className="bg-white/12 text-white">
                  Credits powered
                </Badge>
              </div>

              <div className="relative mt-8 flex min-h-[28rem] items-center justify-center [perspective:1600px]">
                <div className="absolute left-5 top-8 w-44 rotate-[-12deg] rounded-3xl border border-white/15 bg-white/8 p-4 shadow-2xl backdrop-blur-xl">
                  <p className="text-xs uppercase tracking-[0.24em] text-sky-100/70">Super Admin</p>
                  <p className="mt-2 text-lg font-semibold">Approve credits, discounts, and company access.</p>
                </div>

                <div className="absolute right-4 top-16 w-44 rotate-[10deg] rounded-3xl border border-white/15 bg-white/8 p-4 shadow-2xl backdrop-blur-xl">
                  <p className="text-xs uppercase tracking-[0.24em] text-sky-100/70">Company Admin</p>
                  <p className="mt-2 text-lg font-semibold">Uploads data and launches the batch with one form.</p>
                </div>

                <div className="absolute bottom-6 left-8 w-44 rotate-[-8deg] rounded-3xl border border-white/15 bg-white/8 p-4 shadow-2xl backdrop-blur-xl">
                  <p className="text-xs uppercase tracking-[0.24em] text-sky-100/70">Recipient</p>
                  <p className="mt-2 text-lg font-semibold">Receives a personalized PDF in a clean email.</p>
                </div>

                <div className="relative flex h-[20rem] w-[20rem] items-center justify-center">
                  <div className="absolute h-72 w-72 rounded-full border border-white/10 bg-white/5 blur-[1px]" />
                  <div className="absolute h-56 w-56 rounded-full border border-sky-200/20 bg-sky-300/10" />
                  <div className="absolute h-40 w-40 rounded-full border border-white/20 bg-white/8 shadow-inner" />

                  <div className="relative h-28 w-28 rotate-[-10deg] rounded-[2rem] border border-white/20 bg-gradient-to-br from-white/20 to-white/5 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.25)]">
                    <Upload className="h-7 w-7 text-sky-200" />
                    <p className="mt-6 text-xs uppercase tracking-[0.22em] text-sky-100/70">Input</p>
                    <p className="text-sm font-semibold">Excel + Template</p>
                  </div>

                  <div className="absolute -right-4 top-8 h-24 w-24 rotate-[14deg] rounded-[1.6rem] border border-white/15 bg-gradient-to-br from-sky-300/20 to-white/5 p-3 shadow-lg">
                    <FileBadge2 className="h-6 w-6 text-sky-200" />
                    <p className="mt-4 text-xs font-medium">Template stays intact</p>
                  </div>

                  <div className="absolute -left-6 bottom-10 h-24 w-24 rotate-[-12deg] rounded-[1.6rem] border border-white/15 bg-gradient-to-br from-emerald-300/20 to-white/5 p-3 shadow-lg">
                    <Layers3 className="h-6 w-6 text-emerald-200" />
                    <p className="mt-4 text-xs font-medium">Placeholder replacement</p>
                  </div>

                  <div className="absolute bottom-0 right-2 h-28 w-28 rotate-[8deg] rounded-[1.8rem] border border-white/15 bg-gradient-to-br from-white/20 to-sky-300/10 p-4 shadow-[0_16px_30px_rgba(0,0,0,0.25)]">
                    <MailCheck className="h-7 w-7 text-sky-100" />
                    <p className="mt-5 text-xs uppercase tracking-[0.22em] text-sky-100/70">Output</p>
                    <p className="text-sm font-semibold">PDF + email</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="bg-white/85 p-7 md:p-8">
            <div className="flex items-center gap-3">
              <Badge tone="blue">Role based</Badge>
              <p className="text-sm font-medium text-slate-500">Who does what</p>
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">Explain the platform by role.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              The landing page should be easy for non-technical users. This section makes the SaaS flow obvious for
              super admins, company admins, and the final recipient.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {roles.map((role) => {
                const Icon = role.icon;
                return (
                  <div key={role.title} className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                        <Icon className="h-6 w-6" />
                      </div>
                      <Badge tone={role.tone as 'blue' | 'green' | 'amber'}>{role.title}</Badge>
                    </div>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                      {role.points.map((point) => (
                        <li key={point} className="flex items-start gap-2">
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="bg-slate-950 p-7 text-white md:p-8">
            <Badge tone="blue" className="bg-white/10 text-white">
              Key features
            </Badge>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">The features people actually need.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              No AI noise, no workflow builder, no extra complexity. Just the feature set needed for daily operations.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {featureCards.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-950">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="bg-white/85 p-7 md:p-8">
            <div className="flex items-center gap-3">
              <Badge tone="green">How it works</Badge>
              <p className="text-sm font-medium text-slate-500">A simple 4-step flow</p>
            </div>
            <div className="mt-6 space-y-4">
              {workflow.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex gap-4 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{item.step}</p>
                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                          {item.title}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="overflow-hidden bg-gradient-to-br from-sky-50 via-white to-white p-7 md:p-8">
            <Badge tone="amber">Pricing snapshot</Badge>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">Credit based, with strict control.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Credits are sold in fixed plans. Super admin can approve top-ups and manage discounts only within allowed rules.
            </p>

            <div className="mt-6 grid gap-4">
              {pricingPlans.map((plan) => (
                <div key={plan.key} className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">{plan.name}</p>
                      <p className="mt-2 text-2xl font-bold text-slate-950">
                        Rs. {plan.amountInr.toLocaleString('en-IN')}
                        <span className="ml-2 text-sm font-medium text-slate-500">
                          {plan.credits.toLocaleString('en-IN')} credits
                        </span>
                      </p>
                    </div>
                    {plan.recommended ? <Badge tone="blue">Popular</Badge> : null}
                  </div>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {pricingFeatureList.map((feature) => (
                      <li key={feature} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="mt-6">
          <Card className="flex flex-col gap-5 bg-slate-950 px-7 py-8 text-white md:flex-row md:items-center md:justify-between md:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-200">Ready to try</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Launch with one clean dashboard and one simple flow.</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Good for demos, onboarding, and real operations without overwhelming non-technical teams.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/register">
                  Create account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
