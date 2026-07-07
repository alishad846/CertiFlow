
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Blocks,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileBadge2,
  Globe2,
  Layers3,
  Lock,
  MailCheck,
  MousePointer2,
  ShieldCheck,
  Sparkles,
  Upload,
  Users2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PRICING_PLANS } from '@certiflow/shared';

const workflow = [
  {
    step: '01',
    title: 'Upload Excel',
    label: 'Data import',
    description: 'Upload recipient names, emails, roles, dates, and certificate fields in one clean sheet.',
    icon: Upload
  },
  {
    step: '02',
    title: 'Map template',
    label: 'Template setup',
    description: 'Place dynamic fields on the certificate design without changing the original layout.',
    icon: FileBadge2
  },
  {
    step: '03',
    title: 'Generate PDFs',
    label: 'Bulk creation',
    description: 'Create personalized PDF certificates automatically for every recipient.',
    icon: Layers3
  },
  {
    step: '04',
    title: 'Send and track',
    label: 'Delivery',
    description: 'Send certificates in controlled batches and track sent, pending, and failed emails.',
    icon: MailCheck
  }
];

const roles = [
  {
    title: 'Super Admin',
    icon: ShieldCheck,
    tone: 'blue',
    points: ['Create companies', 'Approve top-ups', 'Control discounts', 'Monitor usage']
  },
  {
    title: 'Company Admin',
    icon: Users2,
    tone: 'green',
    points: ['Upload Excel data', 'Map templates', 'Launch batches', 'Track delivery']
  },
  {
    title: 'Recipient',
    icon: BadgeCheck,
    tone: 'amber',
    points: ['Receives PDF', 'Gets clean email', 'No portal needed', 'Professional output']
  }
] as const;

const features = [
  {
    icon: Lock,
    title: 'Design-safe output',
    description: 'Fonts, logos, spacing, borders, and backgrounds stay exactly like the uploaded certificate.'
  },
  {
    icon: CircleDollarSign,
    title: 'Credit control',
    description: 'Fixed plans, UPI requests, approvals, and discount rules keep billing predictable.'
  },
  {
    icon: BarChart3,
    title: 'Delivery visibility',
    description: 'Track sent, pending, failed, generated documents, and credit usage from one place.'
  },
  {
    icon: Blocks,
    title: 'Batch automation',
    description: 'Queue-based sending keeps bulk email delivery controlled and reliable.'
  },
  {
    icon: Globe2,
    title: 'Team friendly',
    description: 'Built for EdTech, HR, and operations teams that need a simple daily workflow.'
  },
  {
    icon: Sparkles,
    title: 'Minimal workflow',
    description: 'No complicated builder. Just upload, map, generate, approve, and send.'
  }
];

const pricingFeatureList = [
  'Strict plan pricing',
  'UPI payment requests',
  'Super admin approval',
  'Credit deduction per recipient'
];

export default function HomePage() {
  const [activeStep, setActiveStep] = useState(0);
  const activeWorkflow = workflow[activeStep];
  const ActiveIcon = activeWorkflow.icon;

  return (
    <main className="min-h-screen bg-[#f7fafc] px-4 py-4 text-slate-950 md:px-6 md:py-6">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:76px_76px]" />

      <div className="relative mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <Link href="/" className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-500">CertiFlow</span>
              <span className="block text-lg font-bold tracking-tight">
                Bulk certificates, credits, and delivery control
              </span>
            </span>
          </Link>

          <nav className="flex flex-wrap items-center gap-3">
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
          </nav>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <Card className="border-slate-200 bg-white p-7 shadow-sm md:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="blue" className="gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                Minimal SaaS workflow
              </Badge>
              <Badge tone="slate">For EdTech + HR teams</Badge>
              <Badge tone="green">Credit controlled</Badge>
            </div>

            <h1
              className="mt-7 max-w-4xl text-5xl font-bold leading-[1.02] tracking-tight text-slate-950 md:text-7xl"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Send bulk certificates with control, clarity, and confidence.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Upload Excel data, map fields on a certificate design, generate personalized PDFs, and deliver them with
              clean tracking instead of manual follow-up.
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

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Visibility', value: 'Sent / Pending / Failed' },
                { label: 'Batching', value: 'Controlled delivery' },
                { label: 'Template', value: 'Design preserved' }
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-1 hover:bg-white hover:shadow-md"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-base font-bold text-slate-950">{item.value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden border-slate-900 bg-slate-950 p-6 text-white shadow-sm md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-sky-200">Interactive product preview</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight">Excel to email, without chaos.</h2>
              </div>
              <Badge tone="blue" className="bg-white/10 text-white">
                Live flow
              </Badge>
            </div>

            <div className="mt-7 rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
              <div className="rounded-3xl bg-white p-5 text-slate-950 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Certificate batch
                    </p>
                    <p className="mt-1 text-xl font-bold">June Training Completion</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    Ready
                  </span>
                </div>

                <div className="mt-5 grid gap-3">
                  {['Aarav Sharma', 'Meera Nair', 'Rohan Patel'].map((name, index) => (
                    <div key={name} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-bold">{name}</p>
                          <p className="text-xs text-slate-500">certificate-{index + 1}.pdf</p>
                        </div>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl bg-slate-950 px-3 py-4 text-white">
                    <p className="text-2xl font-bold">50</p>
                    <p className="text-xs text-slate-300">Batch size</p>
                  </div>
                  <div className="rounded-2xl bg-sky-50 px-3 py-4">
                    <p className="text-2xl font-bold text-sky-700">48</p>
                    <p className="text-xs text-slate-500">Sent</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 px-3 py-4">
                    <p className="text-2xl font-bold text-amber-700">2</p>
                    <p className="text-xs text-slate-500">Pending</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {workflow.map((item, index) => {
                const Icon = item.icon;
                const isActive = activeStep === index;

                return (
                  <button
                    key={item.title}
                    type="button"
                    onMouseEnter={() => setActiveStep(index)}
                    onFocus={() => setActiveStep(index)}
                    className={`rounded-2xl border p-3 text-left transition ${
                        isActive
                            ? 'border-sky-300 bg-sky-50 text-sky-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="mt-2 block text-xs font-bold">{item.title}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                  <ActiveIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-950">{activeWorkflow.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{activeWorkflow.description}</p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <Card className="border-slate-200 bg-white p-7 shadow-sm md:p-8">
            <Badge tone="blue">Role based</Badge>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Simple for every user.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Each person gets a focused workflow, so non-technical teams can operate CertiFlow without heavy training.
            </p>

            <div className="mt-6 grid gap-4">
              {roles.map((role) => {
                const Icon = role.icon;

                return (
                  <div
                    key={role.title}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                        <Icon className="h-5 w-5" />
                      </span>
                      <Badge tone={role.tone}>{role.title}</Badge>
                    </div>

                    <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-600 sm:grid-cols-2 lg:grid-cols-1">
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

          <Card className="border-slate-200 bg-white p-7 shadow-sm md:p-8">
            <Badge tone="green">Product strengths</Badge>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Professional, minimal, and practical.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              CertiFlow focuses on trust, control, and delivery confidence instead of decorative clutter.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-md"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-slate-950">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="border-slate-200 bg-white p-7 shadow-sm md:p-8">
            <Badge tone="green">How it works</Badge>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">A clean 4-step flow.</h2>

            <div className="mt-6 space-y-4">
              {workflow.map((item, index) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.title}
                    type="button"
                    onMouseEnter={() => setActiveStep(index)}
                    onFocus={() => setActiveStep(index)}
                    className="flex w-full gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:-translate-y-1 hover:bg-white hover:shadow-md"
                  >
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="flex-1">
                      <span className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          {item.step}
                        </span>
                        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                          {item.title}
                        </span>
                      </span>
                      <span className="mt-2 block text-sm leading-6 text-slate-600">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="border-slate-200 bg-white p-7 shadow-sm md:p-8">
            <Badge tone="amber">Pricing snapshot</Badge>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Credit based, with strict control.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Credits are sold in fixed plans. Super admins approve top-ups and manage discounts only within allowed
              rules.
            </p>

            <div className="mt-6 grid gap-4">
              {PRICING_PLANS.map((plan) => (
                <div
                  key={plan.key}
                  className={`rounded-2xl border p-5 transition hover:-translate-y-1 hover:shadow-md ${
                    plan.recommended
                      ? 'border-sky-200 bg-sky-50'
                      : 'border-slate-200 bg-slate-50 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">{plan.name}</p>
                      <p className="mt-2 text-2xl font-bold text-slate-950">
                        Rs. {plan.amountInr.toLocaleString('en-IN')}
                        <span className="ml-2 text-sm font-semibold text-slate-500">
                          {plan.credits.toLocaleString('en-IN')} credits
                        </span>
                      </p>
                    </div>
                    {plan.recommended ? <Badge tone="blue">Popular</Badge> : null}
                  </div>

                  <ul className="mt-4 flex flex-wrap gap-2">
                    {pricingFeatureList.map((feature) => (
                      <li
                        key={feature}
                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                      >
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
          <Card className="overflow-hidden border-slate-200 bg-white p-0 text-slate-950 shadow-sm">
            <div className="grid gap-6 p-7 md:grid-cols-[1fr_auto] md:items-center md:p-8">
              <div className="max-w-2xl">
                <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
                  <MousePointer2 className="h-4 w-4" />
                  Ready to try
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                  Launch certificate delivery with one clean dashboard.
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
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
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}

