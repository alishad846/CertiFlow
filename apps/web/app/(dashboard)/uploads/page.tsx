'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  Layers3,
  Loader2,
  Mail,
  Paperclip,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';

import { apiFetch, apiUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { Input } from '@/components/ui/input';

type MeResponse = {
  user: {
    role: 'super_admin' | 'company_admin';
    companyId: string | null;
  };
};

type TemplateSummary = {
  id: string;
  name: string;
  backgroundUrl: string;
  isActive: boolean;
  imageWidth: number;
  imageHeight: number;
};

type MessageState = {
  type: 'success' | 'error' | 'info';
  text: string;
} | null;

export default function UploadPage() {
  const previewSectionRef = useRef<HTMLDivElement | null>(null);

  const [batchName, setBatchName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [role, setRole] =
    useState<MeResponse['user']['role'] | null>(null);

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const [emailMessage, setEmailMessage] = useState(
    'Hello {{name}},\nI hope you are doing well.',
  );

  const [attachmentMessage, setAttachmentMessage] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewMimeType, setPreviewMimeType] = useState('');
  const [message, setMessage] = useState<MessageState>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!previewUrl) {
      return;
    }

    previewSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, [previewUrl]);

  useEffect(() => {
    let active = true;

    apiFetch<MeResponse>('/auth/me')
      .then((data) => {
        if (!active) {
          return;
        }

        setRole(data.user.role);

        if (data.user.role !== 'super_admin') {
          setCompanyId(data.user.companyId ?? '');
        }
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setRole(null);

        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Unable to load your account information.',
        });
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const resolvedCompanyId = companyId.trim();

    const requestedTemplateId =
      new URLSearchParams(window.location.search)
        .get('templateId')
        ?.trim() ?? '';

    if (
      !role ||
      (role === 'super_admin' && !resolvedCompanyId)
    ) {
      setTemplates([]);
      setSelectedTemplateId('');

      return () => {
        active = false;
      };
    }

    setTemplatesLoading(true);

    const url =
      `/certificate-templates/my${
        role === 'super_admin'
          ? `?companyId=${encodeURIComponent(resolvedCompanyId)}`
          : ''
      }`;

    apiFetch<{ templates: TemplateSummary[] }>(url)
      .then((data) => {
        if (!active) {
          return;
        }

        setTemplates(data.templates);

        setSelectedTemplateId((current) => {
          if (
            requestedTemplateId &&
            data.templates.some(
              (template) => template.id === requestedTemplateId,
            )
          ) {
            return requestedTemplateId;
          }

          if (
            current &&
            data.templates.some(
              (template) => template.id === current,
            )
          ) {
            return current;
          }

          return '';
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setTemplates([]);
        setSelectedTemplateId('');

        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load certificate templates.',
        });
      })
      .finally(() => {
        if (active) {
          setTemplatesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [companyId, role]);

  const selectedTemplate =
    templates.find(
      (template) => template.id === selectedTemplateId,
    ) ?? null;

  const completedSteps = [
    Boolean(batchName.trim() && selectedTemplateId),
    Boolean(emailMessage.trim()),
    Boolean(excelFile),
  ].filter(Boolean).length;

  const addAttachments = (files: File[]) => {
    if (!files.length) {
      return;
    }

    setAttachments((current) => [...current, ...files]);
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments((current) =>
      current.filter((_, index) => index !== indexToRemove),
    );
  };

  const generatePreview = async () => {
    if (!excelFile) {
      setMessage({
        type: 'error',
        text: 'Upload an Excel sheet before generating a preview.',
      });
      return;
    }

    setPreviewLoading(true);
    setMessage(null);

    try {
      const form = new FormData();

      form.append('excelFile', excelFile);

      if (selectedTemplateId) {
        form.append(
          'certificateTemplateId',
          selectedTemplateId,
        );
      }

      if (companyId) {
        form.append('companyId', companyId);
      }

      const response = await fetch(
        `${apiUrl}/certificate-templates/preview`,
        {
          method: 'POST',
          credentials: 'include',
          body: form,
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);

        throw new Error(
          data?.message ?? 'Failed to generate preview.',
        );
      }

      const contentType =
        response.headers.get('content-type') ?? '';

      const blob = await response.blob();
      const nextPreview = URL.createObjectURL(blob);

      setPreviewMimeType(contentType);

      setPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }

        return nextPreview;
      });

      setMessage({
        type: 'success',
        text: 'Your sample preview was generated successfully.',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Preview generation failed.',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const createBatch = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!batchName.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter a clear name for this batch.',
      });
      return;
    }

    if (!excelFile) {
      setMessage({
        type: 'error',
        text: 'Please upload an Excel recipient sheet.',
      });
      return;
    }

    if (role === 'super_admin' && !companyId.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter the company ID for this batch.',
      });
      return;
    }

    setMessage(null);
    setLoading(true);

    try {
      const form = new FormData();

      form.append('batchName', batchName.trim());
      form.append('emailMessage', emailMessage);
      form.append('attachmentMessage', attachmentMessage);

      if (selectedTemplateId) {
        form.append(
          'certificateTemplateId',
          selectedTemplateId,
        );
      }

      if (companyId) {
        form.append('companyId', companyId);
      }

      form.append('excelFile', excelFile);

      attachments.forEach((file) => {
        form.append('attachments', file);
      });

      const result = await apiFetch<{
        batchId: string;
        totalRows: number;
        message: string;
      }>('/batches', {
        method: 'POST',
        body: form,
      });

      setMessage({
        type: 'success',
        text: `Batch queued successfully. ${result.totalRows} rows are now being processed.`,
      });

      window.setTimeout(() => {
        window.location.assign(`/batches/${result.batchId}`);
      }, 900);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Batch upload failed.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0f172a] via-[#122b51] to-[#075985] p-6 text-white shadow-[0_28px_75px_rgba(15,23,42,0.18)] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 left-1/3 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />

        <div className="pointer-events-none absolute right-12 top-8 hidden h-40 w-56 rotate-3 rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur xl:block">
          <FileSpreadsheet className="h-8 w-8 text-cyan-300" />

          <div className="mt-5 h-2 w-24 rounded-full bg-white/20" />
          <div className="mt-3 h-2 w-36 rounded-full bg-white/10" />

          <div className="mt-5 flex gap-2">
            <span className="h-7 w-12 rounded-lg bg-blue-400/20" />
            <span className="h-7 flex-1 rounded-lg bg-emerald-400/20" />
          </div>
        </div>

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.15em] text-cyan-100 backdrop-blur">
              <Layers3 className="h-4 w-4 text-cyan-300" />
              New certificate batch
            </div>

            <h1 className="mt-6 max-w-3xl text-3xl font-bold leading-[1.08] tracking-[-0.04em] sm:text-4xl lg:text-5xl">
              From spreadsheet to inbox,
              <span className="text-cyan-300">
                {' '}
                in one clear flow.
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Choose a design, personalise your message, upload
              recipient data, and preview everything before generating
              the batch.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                Preview before generation
              </span>

              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                Personalised documents
              </span>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">
              Setup progress
            </p>

            <div className="mt-3 flex items-center gap-2">
              {[1, 2, 3].map((step) => (
                <span
                  key={step}
                  className={`h-2 w-12 rounded-full ${
                    completedSteps >= step
                      ? 'bg-emerald-400'
                      : 'bg-white/15'
                  }`}
                />
              ))}
            </div>

            <p className="mt-3 text-xs text-slate-300">
              {completedSteps} of 3 required sections completed
            </p>
          </div>
        </div>
      </section>

      {/* Feedback */}
      {message && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-[22px] border px-4 py-4 shadow-sm ${
            message.type === 'error'
              ? 'border-red-100 bg-red-50 text-red-800'
              : message.type === 'success'
                ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                : 'border-blue-100 bg-blue-50 text-blue-800'
          }`}
        >
          {message.type === 'error' ? (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          ) : message.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <Info className="mt-0.5 h-5 w-5 shrink-0" />
          )}

          <p className="flex-1 text-sm font-medium leading-6">
            {message.text}
          </p>

          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Dismiss message"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Workflow */}
      <form className="space-y-6" onSubmit={createBatch}>
        {/* Step 1 */}
        <section className="overflow-hidden rounded-[30px] border border-white/90 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-sm font-bold text-white shadow-[0_10px_25px_rgba(37,99,235,0.25)]">
                1
              </span>

              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-blue-700" />

                  <h2 className="text-xl font-bold text-slate-950">
                    Name your batch and choose a design
                  </h2>
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  A descriptive batch name and reusable template make
                  the delivery easier to find later.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Batch name
              </label>

              <Input
                value={batchName}
                onChange={(event) =>
                  setBatchName(event.target.value)
                }
                placeholder="Example: May 2026 Certificate Batch"
              />

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Use a clear name such as the course, event, or month.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Certificate template
              </label>

              <select
                value={selectedTemplateId}
                onChange={(event) =>
                  setSelectedTemplateId(event.target.value)
                }
                disabled={templatesLoading || !templates.length}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">
                  {templatesLoading
                    ? 'Loading templates...'
                    : templates.length
                      ? 'Choose a certificate template'
                      : 'No templates available'}
                </option>

                {templates.map((template) => (
                  <option
                    key={template.id}
                    value={template.id}
                  >
                    {template.name}
                    {template.isActive ? ' (Active)' : ''}
                  </option>
                ))}
              </select>

              {selectedTemplate ? (
                <div className="mt-3 flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

                  <p className="text-xs leading-5 text-emerald-800">
                    <strong>{selectedTemplate.name}</strong>
                    {' - '}
                    {selectedTemplate.imageWidth} x{' '}
                    {selectedTemplate.imageHeight}
                    {selectedTemplate.isActive ? ' - Active' : ''}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  If no template is selected, the active company
                  template will be used.
                </p>
              )}
            </div>

            {role === 'super_admin' && (
              <div className="lg:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Company ID
                </label>

                <Input
                  value={companyId}
                  onChange={(event) =>
                    setCompanyId(event.target.value)
                  }
                  placeholder="Enter the company receiving this batch"
                />
              </div>
            )}
          </div>
        </section>

        {/* Step 2 */}
        <section className="overflow-hidden rounded-[30px] border border-white/90 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 bg-gradient-to-r from-cyan-50 to-white p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-600 text-sm font-bold text-white shadow-[0_10px_25px_rgba(8,145,178,0.25)]">
                2
              </span>

              <div>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-cyan-700" />

                  <h2 className="text-xl font-bold text-slate-950">
                    Write a friendly recipient message
                  </h2>
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Personalise the email body and add an optional
                  description for the certificate attachment.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-sm font-semibold text-slate-700">
                  Email message
                </label>

                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                  Supports {'{{name}}'}
                </span>
              </div>

              <textarea
                value={emailMessage}
                onChange={(event) =>
                  setEmailMessage(event.target.value)
                }
                rows={7}
                placeholder={'Hello {{name}},\nI hope you are doing well.'}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />

              <p className="mt-2 text-xs text-slate-500">
                This text appears in the recipient&apos;s email.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-sm font-semibold text-slate-700">
                  Attachment description
                </label>

                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                  Optional
                </span>
              </div>

              <textarea
                value={attachmentMessage}
                onChange={(event) =>
                  setAttachmentMessage(event.target.value)
                }
                rows={7}
                placeholder="Certificate for {{name}}"
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />

              <p className="mt-2 text-xs text-slate-500">
                Add a short description for the attached certificate.
              </p>
            </div>
          </div>
        </section>

        {/* Step 3 */}
        <section className="overflow-hidden rounded-[30px] border border-white/90 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-bold text-white shadow-[0_10px_25px_rgba(5,150,105,0.25)]">
                3
              </span>

              <div>
                <div className="flex items-center gap-2">
                  <Paperclip className="h-5 w-5 text-emerald-700" />

                  <h2 className="text-xl font-bold text-slate-950">
                    Upload recipient data and attachments
                  </h2>
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Your Excel sheet supplies the personalised fields used
                  for each generated document.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-[26px] border border-blue-100 bg-blue-50/40 p-2">
                <FileDropzone
                  label="Excel recipient sheet"
                  accept=".xls,.xlsx"
                  description="Upload the spreadsheet containing recipient names, emails, and certificate fields."
                  onFileChange={setExcelFile}
                />
              </div>

              <div className="rounded-[26px] border border-slate-200 bg-slate-50/70 p-2">
                <FileDropzone
                  label="Additional attachments"
                  accept=".pdf,.png,.jpg,.jpeg"
                  description="Optionally attach supporting PDF, PNG, or JPEG files."
                  multiple
                  onFilesChange={addAttachments}
                />
              </div>
            </div>

            {excelFile && (
              <div className="mt-5 flex items-center gap-3 rounded-[20px] border border-emerald-100 bg-emerald-50 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                  <FileSpreadsheet className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-950">
                    {excelFile.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {(excelFile.size / 1024).toFixed(1)} KB recipient
                    spreadsheet
                  </p>
                </div>

                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            )}

            {attachments.length > 0 && (
              <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-slate-800">
                    Additional attachments
                  </p>

                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">
                    {attachments.length}{' '}
                    {attachments.length === 1 ? 'file' : 'files'}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {attachments.map((file, index) => (
                    <div
                      key={`${file.name}-${file.lastModified}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Paperclip className="h-4 w-4 shrink-0 text-blue-600" />

                        <span className="truncate text-sm text-slate-700">
                          {file.name}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex items-start gap-3 rounded-[20px] border border-amber-200 bg-amber-50 p-4">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

              <div>
                <p className="text-sm font-bold text-amber-900">
                  Check your spreadsheet before continuing
                </p>

                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Column names must match your certificate fields. Use a
                  sample email address when testing your first batch.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Step 4 */}
        <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-[0_24px_65px_rgba(15,23,42,0.16)] sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-cyan-300">
                  <Sparkles className="h-5 w-5" />
                </span>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
                    Step 4
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    Preview, confirm, and generate
                  </h2>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-300">
                Generate one sample first. Check the recipient name,
                field placement, design, and message before creating the
                complete batch.
              </p>

              {!excelFile && (
                <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <AlertCircle className="h-4 w-4" />
                  Upload an Excel sheet to enable these actions.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                disabled={!excelFile || previewLoading}
                onClick={generatePreview}
              >
                {previewLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}

                {previewLoading
                  ? 'Generating preview...'
                  : 'Generate sample'}
              </Button>

              <Button
                type="submit"
                disabled={loading || !excelFile}
                className="sm:min-w-[210px]"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="mr-2 h-4 w-4" />
                )}

                {loading
                  ? 'Creating batch...'
                  : 'Generate documents'}
              </Button>
            </div>
          </div>
        </section>

        {/* Preview */}
        {previewUrl && (
          <section
            ref={previewSectionRef}
            className="overflow-hidden rounded-[30px] border border-white/90 bg-white shadow-[0_22px_65px_rgba(15,23,42,0.1)]"
          >
            <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Preview ready
                </div>

                <h2 className="mt-2 text-2xl font-bold text-slate-950">
                  Check your certificate sample
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Confirm the content and field placement before
                  generating the complete batch.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl('');
                  setPreviewMimeType('');
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-4 w-4" />
                Close preview
              </button>
            </div>

            <div className="bg-slate-100/80 p-4 sm:p-6">
              {previewMimeType.includes('pdf') ? (
                <object
                  data={previewUrl}
                  type="application/pdf"
                  className="h-[70vh] w-full rounded-[22px] border border-slate-200 bg-white shadow-sm"
                >
                  <p className="p-4 text-sm text-slate-500">
                    Your browser cannot display the PDF preview.
                  </p>
                </object>
              ) : (
                <img
                  src={previewUrl}
                  alt="Certificate preview"
                  className="mx-auto max-h-[75vh] w-auto max-w-full rounded-[22px] border border-slate-200 bg-white shadow-md"
                />
              )}
            </div>

            <div className="flex flex-col gap-4 border-t border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                <span>
                  If everything looks correct, use “Generate documents”
                  above to create the complete batch.
                </span>
              </div>

              <a
                href={previewUrl}
                download="certificate-preview"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                Download preview
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </section>
        )}
      </form>
    </div>
  );
}