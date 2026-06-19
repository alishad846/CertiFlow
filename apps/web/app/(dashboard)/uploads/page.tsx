'use client';

import { useEffect, useRef, useState } from 'react';
import { UploadCloud, Sparkles } from 'lucide-react';
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
      <Card className="border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.03),rgba(42,141,240,0.05))]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">New batch</p>
        <h2 className="mt-3 text-4xl font-bold tracking-tight text-ink md:text-5xl">Upload Excel and generate certificates from the active template.</h2>
      </Card>

      <Card className="border-white/80">
        <form
          className="space-y-6"
          onSubmit={async (event) => {
            event.preventDefault();
            setMessage('');
            setLoading(true);
            try {
              const form = new FormData();
              form.append('batchName', batchName);
              form.append('emailMessage', emailMessage);
              form.append('attachmentMessage', attachmentMessage);
              if (selectedTemplateId) form.append('certificateTemplateId', selectedTemplateId);
              if (companyId) form.append('companyId', companyId);
              if (excelFile) form.append('excelFile', excelFile);
              attachments.forEach((file) => form.append('attachments', file));

              const result = await apiFetch<{ batchId: string; totalRows: number; message: string }>('/batches', {
                method: 'POST',
                body: form
              });
              setMessage(`Batch queued successfully. ${result.totalRows} rows are being processed.`);
              window.setTimeout(() => {
                window.location.assign(`/batches/${result.batchId}`);
              }, 900);
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Upload failed');
            } finally {
              setLoading(false);
            }
          }}
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Batch name</label>
            <Input value={batchName} onChange={(event) => setBatchName(event.target.value)} placeholder="May 2026 Certificate Batch" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Template</label>
              <select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                disabled={templatesLoading || !templates.length}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-accent-400 focus:ring-4 focus:ring-accent-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">{templatesLoading ? 'Loading templates...' : 'Choose a template'}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.isActive ? ' (Active)' : ''}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Pick the certificate template you edited. If you leave this blank, the active certificate template will be used.
              </p>
              {selectedTemplate ? (
                <p className="mt-2 text-xs font-medium text-slate-600">
                  Selected: {selectedTemplate.name} {selectedTemplate.isActive ? '(Active)' : ''} - {selectedTemplate.imageWidth} x{' '}
                  {selectedTemplate.imageHeight}
                </p>
              ) : null}
            </div>

            {role === 'super_admin' ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Company ID for super admin</label>
                <Input value={companyId} onChange={(event) => setCompanyId(event.target.value)} placeholder="Only needed for super admin" />
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Email message</label>
              <textarea
                value={emailMessage}
                onChange={(event) => setEmailMessage(event.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-accent-400 focus:ring-4 focus:ring-accent-100"
                placeholder="Hello {{name}},\nI hope you are doing well."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Attachment text</label>
              <textarea
                value={attachmentMessage}
                onChange={(event) => setAttachmentMessage(event.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-accent-400 focus:ring-4 focus:ring-accent-100"
                placeholder="Certificate for {{name}}"
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <FileDropzone
              label="Excel sheet"
              accept=".xls,.xlsx"
              description="Columns like Name, Email, Course, Role, Joining Date, Completion Date, Roll Number."
              onFileChange={setExcelFile}
            />

            <FileDropzone
              label="Extra attachments"
              accept=".pdf,.png,.jpg,.jpeg"
              description="Add PDF, PNG, or JPEG files to send with the batch."
              multiple
              onFilesChange={addAttachments}
            />
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            Column names and formatting should match your Excel sheet exactly. For preview/testing, use a sample or
            random email address in the sheet so you can safely check delivery.
          </div>
          
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                  if (selectedTemplateId) form.append('certificateTemplateId', selectedTemplateId);
                  if (companyId) form.append('companyId', companyId);

                  const response = await fetch(`${apiUrl}/certificate-templates/preview`, {
                    method: 'POST',
                    credentials: 'include',
                    body: form
                  });
                  if (!response.ok) {
                    const data = await response.json().catch(() => null);
                    throw new Error(data?.message ?? 'Failed to generate preview');
                  }
                  const contentType = response.headers.get('content-type') ?? '';
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
                  setMessage(error instanceof Error ? error.message : 'Preview failed');
                } finally {
                  setPreviewLoading(false);
                }
              }}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {previewLoading ? 'Generating preview...' : 'Generate Sample Preview'}
            </Button>
            <Button type="submit" disabled={loading} className="sm:min-w-[220px]">
              <UploadCloud className="mr-2 h-4 w-4" />
              {loading ? 'Queuing batch...' : 'Generate documents'}
            </Button>
          </div>

          {previewUrl ? (
            <div ref={previewSectionRef} className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Sample preview</p>
              {previewMimeType.includes('pdf') ? (
                <object
                  data={previewUrl}
                  type="application/pdf"
                  className="mt-3 h-[70vh] w-full rounded-[24px] border border-slate-200 bg-white"
                >
                  <p className="p-4 text-sm text-slate-500">Your browser cannot preview PDF files here.</p>
                </object>
              ) : (
                <img
                  src={previewUrl}
                  alt="Certificate preview"
                  loading="lazy"
                  decoding="async"
                  className="mt-3 w-full rounded-[24px] border border-slate-200 bg-white"
                />
              )}
            </div>
          ) : null}

          {attachments.length ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">Selected extra attachments</p>
              <div className="mt-3 space-y-2">
                {attachments.map((file, index) => (
                  <div
                    key={`${file.name}-${file.lastModified}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="shrink-0 rounded-full px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {message ? <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p> : null}
        </form>
      </Card>
    </div>
  );
}
