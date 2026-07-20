'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  FileImage,
  FileText,
  LayoutTemplate,
  Loader2,
  PencilLine,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { Input } from '@/components/ui/input';

type TemplateItem = {
  id: string;
  name: string;
  backgroundUrl: string;
  isActive: boolean;
  updatedAt: string;
  imageWidth: number;
  imageHeight: number;
};

type MeResponse = {
  user: {
    role: 'super_admin' | 'company_admin';
    companyId: string | null;
  };
};

type MessageState = {
  type: 'success' | 'error';
  text: string;
} | null;

type TemplateCardProps = {
  template: TemplateItem;
  apiBaseUrl: string;
  isActioning: boolean;
  onDuplicate: (template: TemplateItem) => void;
  onUse: (template: TemplateItem) => void;
  onDelete: (template: TemplateItem) => void;
};

function formatDate(dateValue: string) {
  if (!dateValue) {
    return 'Recently';
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function TemplateCard({
  template,
  apiBaseUrl,
  isActioning,
  onDuplicate,
  onUse,
  onDelete,
}: TemplateCardProps) {
  const isPdf = template.backgroundUrl
    .toLowerCase()
    .endsWith('.pdf');

  const previewUrl = `${apiBaseUrl}${template.backgroundUrl}`;

  return (
    <article
      className={`group relative overflow-hidden rounded-[30px] border bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_25px_65px_rgba(15,23,42,0.12)] sm:p-5 ${
        template.isActive
          ? 'border-emerald-200'
          : 'border-white/90'
      }`}
    >
      {template.isActive && (
        <div className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Active template
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-[220px,1fr]">
        <div className="relative min-h-[230px] overflow-hidden rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-100 to-blue-50">
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-slate-950/60 to-transparent p-3 text-white">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
              {isPdf ? (
                <FileText className="h-3.5 w-3.5" />
              ) : (
                <FileImage className="h-3.5 w-3.5" />
              )}

              {isPdf ? 'PDF design' : 'Image design'}
            </span>
          </div>

          {isPdf ? (
            <object
              data={`${previewUrl}#toolbar=0&view=FitH`}
              type="application/pdf"
              className="h-full min-h-[230px] w-full"
            >
              <div className="flex min-h-[230px] flex-col items-center justify-center p-5 text-center">
                <FileText className="h-10 w-10 text-blue-600" />

                <p className="mt-3 text-sm font-bold text-slate-800">
                  PDF template
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Preview unavailable
                </p>
              </div>
            </object>
          ) : (
            <img
              src={previewUrl}
              alt={`${template.name} template preview`}
              loading="lazy"
              decoding="async"
              className="h-full min-h-[230px] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          )}

          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" />
        </div>

        <div className="flex min-w-0 flex-col py-1">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">
                Certificate template
              </span>

              {isPdf && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-600">
                  PDF
                </span>
              )}
            </div>

            <h3 className="mt-2 truncate text-2xl font-bold tracking-[-0.025em] text-slate-950">
              {template.name}
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {template.imageWidth} x {template.imageHeight}
              </span>

              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                Updated {formatDate(template.updatedAt)}
              </span>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-600">
            Edit this design, create a copy, or select it for your next
            document batch.
          </p>

          <div className="mt-auto pt-5">
            <div className="grid gap-2 sm:grid-cols-2">
              <Link
                href={`/certificate-editor/${template.id}`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <PencilLine className="h-4 w-4" />
                Edit design
              </Link>

              <button
                type="button"
                disabled={isActioning}
                onClick={() => onUse(template)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isActioning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}

                Use template
              </button>
            </div>

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={isActioning}
                onClick={() => onDuplicate(template)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicate
              </button>

              <button
                type="button"
                disabled={isActioning}
                onClick={() => onDelete(template)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function LoadingTemplates() {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {[1, 2].map((item) => (
        <div
          key={item}
          className="overflow-hidden rounded-[28px] border border-white bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
        >
          <div className="grid animate-pulse gap-5 md:grid-cols-[220px,1fr]">
            <div className="h-56 rounded-[22px] bg-slate-200/80" />

            <div className="py-2">
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="mt-4 h-8 w-3/4 rounded-lg bg-slate-200" />
              <div className="mt-3 h-4 w-36 rounded bg-slate-100" />

              <div className="mt-12 flex gap-2">
                <div className="h-11 flex-1 rounded-xl bg-slate-100" />
                <div className="h-11 flex-1 rounded-xl bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminEmptyState() {
  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/90 bg-white p-8 text-center shadow-[0_18px_50px_rgba(15,23,42,0.07)] sm:p-12">
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-100/70 blur-3xl" />

      <div className="relative mx-auto max-w-lg">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-[0_18px_40px_rgba(37,99,235,0.25)]">
          <Search className="h-9 w-9" />
        </div>

        <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Select a company to begin
        </h2>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          Enter a company ID above to view and manage its certificate
          templates.
        </p>
      </div>
    </div>
  );
}

function EmptyTemplates() {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/90 bg-white px-6 py-12 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:px-10 sm:py-16">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-emerald-100/60 blur-3xl" />

      <div className="relative mx-auto max-w-2xl">
        <div className="relative mx-auto h-40 w-56">
          <div className="absolute left-4 top-8 h-28 w-36 -rotate-6 rounded-[24px] border border-blue-100 bg-blue-50 shadow-sm" />

          <div className="absolute right-3 top-5 h-28 w-36 rotate-6 rounded-[24px] border border-cyan-100 bg-cyan-50 shadow-sm" />

          <div className="absolute left-1/2 top-0 flex h-36 w-40 -translate-x-1/2 flex-col items-center justify-center rounded-[26px] border border-slate-100 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.13)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white">
              <Sparkles className="h-7 w-7" />
            </div>

            <div className="mt-4 h-2 w-20 rounded-full bg-slate-200" />
            <div className="mt-2 h-2 w-12 rounded-full bg-blue-100" />
          </div>

          <span className="absolute right-2 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
        </div>

        <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
          Your design library is ready
        </p>

        <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-slate-950">
          Create your first certificate template
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
          Design a reusable certificate once, then personalise it for
          every recipient in your future batches.
        </p>

        <Link
          href="/certificate-editor"
          className="mt-7 inline-flex items-center gap-3 rounded-2xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create your first template
          <ArrowRight className="h-4 w-4" />
        </Link>

        <div className="mx-auto mt-10 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
          <div className="rounded-[20px] border border-blue-100 bg-blue-50/70 p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-xs font-bold text-white">
              1
            </span>

            <p className="mt-3 text-sm font-bold text-slate-900">
              Upload a design
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-600">
              Start with your certificate background.
            </p>
          </div>

          <div className="rounded-[20px] border border-cyan-100 bg-cyan-50/70 p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-600 text-xs font-bold text-white">
              2
            </span>

            <p className="mt-3 text-sm font-bold text-slate-900">
              Add fields
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-600">
              Place names and other recipient details.
            </p>
          </div>

          <div className="rounded-[20px] border border-emerald-100 bg-emerald-50/70 p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-xs font-bold text-white">
              3
            </span>

            <p className="mt-3 text-sm font-bold text-slate-900">
              Save and reuse
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-600">
              Use the template in future batches.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [companyId, setCompanyId] = useState('');
  const [role, setRole] =
    useState<MeResponse['user']['role']>('company_admin');

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState('');
  const [message, setMessage] = useState<MessageState>(null);

  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  useEffect(() => {
    let active = true;

    apiFetch<MeResponse>('/auth/me')
      .then((data) => {
        if (!active) {
          return;
        }

        setRole(data.user.role);

        if (data.user.companyId) {
          setCompanyId(data.user.companyId);
        }
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Unable to load your account information.',
        });
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!companyId && role !== 'super_admin') {
      return;
    }

    if (!companyId && role === 'super_admin') {
      setTemplates([]);
      setLoading(false);
      return;
    }

    let active = true;

    setLoading(true);
    setMessage(null);

    const query =
      role === 'super_admin'
        ? `?companyId=${encodeURIComponent(companyId)}`
        : '';

    apiFetch<{ templates: TemplateItem[] }>(
      `/certificate-templates${query}`,
    )
      .then((data) => {
        if (active) {
          setTemplates(data.templates);
        }
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load templates.',
        });
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [companyId, role]);

  const duplicateTemplate = async (template: TemplateItem) => {
    setActioningId(template.id);
    setMessage(null);

    try {
      const result = await apiFetch<{
        template: TemplateItem;
      }>(`/certificate-templates/${template.id}/duplicate`, {
        method: 'POST',
      });

      window.location.assign(
        `/certificate-editor/${result.template.id}`,
      );
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to duplicate the template.',
      });

      setActioningId('');
    }
  };

  const useTemplate = async (template: TemplateItem) => {
    setActioningId(template.id);
    setMessage(null);

    try {
      await apiFetch(`/certificate-templates/${template.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: true,
        }),
      });

      setTemplates((current) =>
        current.map((item) => ({
          ...item,
          isActive: item.id === template.id,
        })),
      );

      window.location.assign(
        `/uploads?templateId=${encodeURIComponent(template.id)}`,
      );
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to activate the template.',
      });

      setActioningId('');
    }
  };

  const deleteTemplate = async (template: TemplateItem) => {
    const confirmed = window.confirm(
      `Delete "${template.name}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setActioningId(template.id);
    setMessage(null);

    try {
      await apiFetch(`/certificate-templates/${template.id}`, {
        method: 'DELETE',
      });

      setTemplates((current) =>
        current.filter((item) => item.id !== template.id),
      );

      setMessage({
        type: 'success',
        text: `"${template.name}" was deleted successfully.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to delete the template.',
      });
    } finally {
      setActioningId('');
    }
  };

  const renderTemplateContent = () => {
    if (loading) {
      return <LoadingTemplates />;
    }

    if (templates.length > 0) {
      return (
        <div className="grid gap-5 xl:grid-cols-2">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              apiBaseUrl={apiBaseUrl}
              isActioning={actioningId === template.id}
              onDuplicate={duplicateTemplate}
              onUse={useTemplate}
              onDelete={deleteTemplate}
            />
          ))}
        </div>
      );
    }

    if (role === 'super_admin' && !companyId) {
      return <AdminEmptyState />;
    }

    return <EmptyTemplates />;
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0f172a] via-[#122b51] to-[#075985] p-6 text-white shadow-[0_28px_75px_rgba(15,23,42,0.18)] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 left-1/3 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />

        <div className="pointer-events-none absolute right-14 top-10 hidden h-36 w-28 rotate-6 rounded-[24px] border border-white/10 bg-white/5 backdrop-blur xl:block">
          <div className="m-3 h-12 rounded-xl bg-white/10" />
          <div className="mx-3 mt-3 h-2 rounded-full bg-cyan-300/30" />
          <div className="mx-3 mt-2 h-2 w-2/3 rounded-full bg-white/15" />
        </div>

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.15em] text-cyan-100 backdrop-blur">
              <LayoutTemplate className="h-4 w-4 text-cyan-300" />
              My templates
            </div>

            <h1 className="mt-6 max-w-3xl text-3xl font-bold leading-[1.08] tracking-[-0.04em] sm:text-4xl lg:text-5xl">
              Designs worth reusing,
              <span className="text-cyan-300">
                {' '}
                all in one place.
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Create polished certificate designs, duplicate your
              favourites, and choose the right template for every batch.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                Easy to customise
              </span>

              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                Ready for secure delivery
              </span>
            </div>
          </div>

          <Link
            href="/certificate-editor"
            className="group inline-flex w-full shrink-0 items-center justify-between rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-950 shadow-[0_15px_35px_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-cyan-50 sm:w-auto sm:min-w-[190px]"
          >
            <span className="inline-flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Plus className="h-5 w-5" />
              </span>

              New template
            </span>

            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      {/* Company selector for super admin */}
      {role === 'super_admin' && (
        <section className="relative overflow-hidden rounded-[28px] border border-white/90 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-100/70 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <Search className="h-5 w-5" />
                </span>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                    Company templates
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-slate-950">
                    View a company&apos;s design library
                  </h2>
                </div>
              </div>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Enter a company ID to view and manage the templates
                belonging to that organisation.
              </p>
            </div>

            <div className="w-full lg:max-w-md">
              <label
                htmlFor="companyId"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Company ID
              </label>

              <Input
                id="companyId"
                value={companyId}
                onChange={(event) =>
                  setCompanyId(event.target.value)
                }
                placeholder="Enter company ID"
                className="h-12"
              />
            </div>
          </div>
        </section>
      )}

      {/* Feedback */}
      {message && (
        <div
          role="alert"
          className={`flex items-start gap-3 rounded-[22px] border px-4 py-4 shadow-sm ${
            message.type === 'error'
              ? 'border-red-100 bg-red-50 text-red-800'
              : 'border-emerald-100 bg-emerald-50 text-emerald-800'
          }`}
        >
          {message.type === 'error' ? (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          )}

          <p className="flex-1 text-sm font-medium leading-6">
            {message.text}
          </p>

          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Dismiss message"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Template library */}
      <section>
        <div className="mb-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              Design library
            </p>

            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
              {loading
                ? 'Loading your templates'
                : `${templates.length} ${
                    templates.length === 1
                      ? 'template'
                      : 'templates'
                  } ready to use`}
            </h2>
          </div>

          {!loading && templates.length > 0 && (
            <p className="text-sm text-slate-500">
              Select a design to edit, duplicate, or use
            </p>
          )}
        </div>

        {renderTemplateContent()}
      </section>

      {/* Help */}
      {!loading && (
        <section className="overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-r from-blue-50 via-cyan-50/70 to-emerald-50/60 p-6 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
                <UploadCloud className="h-5 w-5" />
              </span>

              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Need a new certificate design?
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Open the editor to upload a background and add
                  personalised recipient fields.
                </p>
              </div>
            </div>

            <Link
              href="/certificate-editor"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              Open certificate editor
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}