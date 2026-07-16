'use client';

import { useEffect, useRef, useState } from 'react';
import {
  UploadCloud,
  Sparkles,
  FileSpreadsheet,
  Mail,
  Paperclip,
  Info,
  Layers3,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { apiFetch, apiUrl } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileDropzone } from '@/components/ui/file-dropzone';

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

export default function UploadPage() {
  const previewSectionRef = useRef<HTMLDivElement | null>(null);
  const [batchName, setBatchName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [role, setRole] = useState<MeResponse['user']['role'] | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState('Hello {{name}},\nI hope you are doing well.');
  const [attachmentMessage, setAttachmentMessage] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewMimeType, setPreviewMimeType] = useState('');
  const [message, setMessage] = useState('');

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

    previewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      .catch(() => {
        if (!active) {
          return;
        }
        setRole(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const resolvedCompanyId = companyId.trim();
    const requestedTemplateId = new URLSearchParams(window.location.search).get('templateId')?.trim() ?? '';

    if (!role || (role === 'super_admin' && !resolvedCompanyId)) {
      setTemplates([]);
      setSelectedTemplateId('');
      return () => {
        active = false;
      };
    }

    setTemplatesLoading(true);
    const url = `/certificate-templates/my${role === 'super_admin' ? `?companyId=${encodeURIComponent(resolvedCompanyId)}` : ''}`;
    apiFetch<{ templates: TemplateSummary[] }>(url)
      .then((data) => {
        if (!active) {
          return;
        }
        setTemplates(data.templates);
        setSelectedTemplateId((current) => {
          if (requestedTemplateId && data.templates.some((template) => template.id === requestedTemplateId)) {
            return requestedTemplateId;
          }
          if (current && data.templates.some((template) => template.id === current)) {
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
        setMessage(error instanceof Error ? error.message : 'Failed to load templates');
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

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;

  const addAttachments = (files: File[]) => {
    if (!files.length) {
      return;
    }
    setAttachments((current) => [...current, ...files]);
  };
  const removeAttachment = (indexToRemove: number) => {
    setAttachments((current) => current.filter((_, index) => index !== indexToRemove));
  };

  return (
  <div className="space-y-6">
    {/* Compact page introduction */}
    <section className="overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(135deg,#ffffff_0%,#f4f8ff_58%,#eaf4ff_100%)] shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <div className="grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            <Layers3 className="h-3.5 w-3.5" />
            New certificate batch
          </div>

          <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-ink md:text-4xl">
            Generate and deliver certificates in a few simple steps.
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
            Choose a template, prepare the email, upload your Excel sheet,
            and preview everything before generating the batch.
          </p>
        </div>

        <div className="hidden items-center gap-2 rounded-[24px] border border-white bg-white/80 p-3 shadow-sm xl:flex">
          {[
            ['1', 'Details'],
            ['2', 'Message'],
            ['3', 'Files'],
            ['4', 'Generate']
          ].map(([number, label], index) => (
            <div key={number} className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-2xl px-2 py-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-ink text-xs font-bold text-white">
                  {number}
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  {label}
                </span>
              </div>

              {index < 3 ? (
                <ArrowRight className="h-4 w-4 text-slate-300" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>

    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setMessage('');
        setLoading(true);

        try {
          const form = new FormData();
          form.append('batchName', batchName);
          form.append('emailMessage', emailMessage);
          form.append('attachmentMessage', attachmentMessage);

          if (selectedTemplateId) {
            form.append(
              'certificateTemplateId',
              selectedTemplateId
            );
          }

          if (companyId) {
            form.append('companyId', companyId);
          }

          if (excelFile) {
            form.append('excelFile', excelFile);
          }

          attachments.forEach((file) =>
            form.append('attachments', file)
          );

          const result = await apiFetch<{
            batchId: string;
            totalRows: number;
            message: string;
          }>('/batches', {
            method: 'POST',
            body: form
          });

          setMessage(
            `Batch queued successfully. ${result.totalRows} rows are being processed.`
          );

          window.setTimeout(() => {
            window.location.assign(`/batches/${result.batchId}`);
          }, 900);
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : 'Upload failed'
          );
        } finally {
          setLoading(false);
        }
      }}
    >
      {/* Step 1: Batch details */}
      <Card className="overflow-hidden border-white/80 p-0">
        <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-100 text-blue-700">
              <FileSpreadsheet className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                Step 1
              </p>
              <h3 className="mt-1 text-lg font-bold text-ink">
                Batch details
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Name this batch and select its certificate template.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-6 lg:grid-cols-2">
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
              Use a clear name so you can identify this batch later.
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
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-accent-400 focus:ring-4 focus:ring-accent-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">
                {templatesLoading
                  ? 'Loading templates...'
                  : 'Choose a template'}
              </option>

              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.isActive ? ' (Active)' : ''}
                </option>
              ))}
            </select>

            {selectedTemplate ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

                <p className="text-xs leading-5 text-emerald-800">
                  <span className="font-semibold">
                    {selectedTemplate.name}
                  </span>
                  {' · '}
                  {selectedTemplate.imageWidth} ×{' '}
                  {selectedTemplate.imageHeight}
                  {selectedTemplate.isActive ? ' · Active' : ''}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                If no template is selected, your active template will
                be used.
              </p>
            )}
          </div>

          {role === 'super_admin' ? (
            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Company ID
              </label>

              <Input
                value={companyId}
                onChange={(event) =>
                  setCompanyId(event.target.value)
                }
                placeholder="Enter the company ID"
              />
            </div>
          ) : null}
        </div>
      </Card>

      {/* Step 2: Email content */}
      <Card className="overflow-hidden border-white/80 p-0">
        <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-100 text-blue-700">
              <Mail className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                Step 2
              </p>
              <h3 className="mt-1 text-lg font-bold text-ink">
                Email content
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Write the message recipients will receive.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-6 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-slate-700">
                Email message
              </label>

              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                Supports {'{{name}}'}
              </span>
            </div>

            <textarea
              value={emailMessage}
              onChange={(event) =>
                setEmailMessage(event.target.value)
              }
              rows={6}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-accent-400 focus:ring-4 focus:ring-accent-100"
              placeholder={'Hello {{name}},\nI hope you are doing well.'}
            />

            <p className="mt-2 text-xs text-slate-500">
              This text appears in the body of the email.
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-slate-700">
                Attachment text
              </label>

              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                Optional
              </span>
            </div>

            <textarea
              value={attachmentMessage}
              onChange={(event) =>
                setAttachmentMessage(event.target.value)
              }
              rows={6}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-accent-400 focus:ring-4 focus:ring-accent-100"
              placeholder="Certificate for {{name}}"
            />

            <p className="mt-2 text-xs text-slate-500">
              Add a short description for the certificate attachment.
            </p>
          </div>
        </div>
      </Card>

      {/* Step 3: Upload files */}
      <Card className="overflow-hidden border-white/80 p-0">
        <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-100 text-blue-700">
              <Paperclip className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                Step 3
              </p>
              <h3 className="mt-1 text-lg font-bold text-ink">
                Upload files
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Add the recipient spreadsheet and any optional files.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-[24px] border border-blue-100 bg-blue-50/30 p-2">
              <FileDropzone
                label="Excel recipient sheet"
                accept=".xls,.xlsx"
                description="Required columns can include Name, Email, Course, Role, Joining Date, Completion Date, and Roll Number."
                onFileChange={setExcelFile}
              />
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-2">
              <FileDropzone
                label="Extra attachments"
                accept=".pdf,.png,.jpg,.jpeg"
                description="Optional PDF, PNG, or JPEG files to include with the batch."
                multiple
                onFilesChange={addAttachments}
              />
            </div>
          </div>

          {attachments.length > 0 ? (
            <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700">
                  Selected attachments
                </p>

                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                  {attachments.length}{' '}
                  {attachments.length === 1 ? 'file' : 'files'}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {attachments.map((file, index) => (
                  <div
                    key={`${file.name}-${file.lastModified}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Paperclip className="h-4 w-4 shrink-0 text-blue-600" />
                      <span className="truncate">{file.name}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

            <div>
              <p className="text-sm font-semibold text-amber-900">
                Check your spreadsheet before continuing
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-800">
                Column names and formatting must match your certificate
                fields exactly. For testing, use a sample email address
                so you can safely check delivery.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Step 4: Review and generate */}
      <Card className="border-white/80">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              Step 4
            </p>

            <h3 className="mt-2 text-xl font-bold text-ink">
              Preview and generate
            </h3>

            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
              Generate one sample first to confirm that names and other
              fields are positioned correctly.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              disabled={!excelFile || previewLoading}
              onClick={async () => {
                if (!excelFile) {
                  return;
                }

                setPreviewLoading(true);

                try {
                  const form = new FormData();
                  form.append('excelFile', excelFile);

                  if (selectedTemplateId) {
                    form.append(
                      'certificateTemplateId',
                      selectedTemplateId
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
                      body: form
                    }
                  );

                  if (!response.ok) {
                    const data = await response
                      .json()
                      .catch(() => null);

                    throw new Error(
                      data?.message ?? 'Failed to generate preview'
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

                  setMessage('Preview generated successfully.');
                } catch (error) {
                  setMessage(
                    error instanceof Error
                      ? error.message
                      : 'Preview failed'
                  );
                } finally {
                  setPreviewLoading(false);
                }
              }}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {previewLoading
                ? 'Generating preview...'
                : 'Generate sample preview'}
            </Button>

            <Button
              type="submit"
              disabled={loading || !excelFile}
              className="sm:min-w-[220px]"
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              {loading ? 'Queuing batch...' : 'Generate documents'}
            </Button>
          </div>
        </div>

        {!excelFile ? (
          <p className="mt-4 text-xs font-medium text-slate-500 lg:text-right">
            Upload an Excel sheet to enable preview and generation.
          </p>
        ) : null}
      </Card>

      {message ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3.5 text-sm text-blue-900"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{message}</p>
        </div>
      ) : null}

      {previewUrl ? (
        <div
          ref={previewSectionRef}
          className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.07)]"
        >
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
            <div>
              <p className="text-sm font-bold text-slate-800">
                Certificate preview
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Confirm the content and field placement before generating.
              </p>
            </div>

            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Preview ready
            </span>
          </div>

          <div className="bg-slate-100/70 p-4">
            {previewMimeType.includes('pdf') ? (
              <object
                data={previewUrl}
                type="application/pdf"
                className="h-[70vh] w-full rounded-[20px] border border-slate-200 bg-white"
              >
                <p className="p-4 text-sm text-slate-500">
                  Your browser cannot preview PDF files here.
                </p>
              </object>
            ) : (
              <img
                src={previewUrl}
                alt="Certificate preview"
                loading="lazy"
                decoding="async"
                className="mx-auto max-h-[75vh] w-auto max-w-full rounded-[20px] border border-slate-200 bg-white shadow-sm"
              />
            )}
          </div>
        </div>
      ) : null}
    </form>
  </div>
);
}
