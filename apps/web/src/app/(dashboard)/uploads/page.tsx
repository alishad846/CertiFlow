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
  const [templateType, setTemplateType] = useState<'certificate' | 'offer_letter'>('certificate');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
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
      <Card>
        <p className="eyebrow">New batch</p>
        <h2 className="mt-3 font-serif text-4xl tracking-tight text-ink md:text-5xl">Upload Excel and generate certificates from the active template.</h2>
      </Card>

      <Card>
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
              form.append('templateType', templateType);
              if (templateType === 'offer_letter' && templateFile) {
                form.append('templateFile', templateFile);
              }
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
            <label className="mb-2 block text-sm font-medium text-ink-soft">Batch name</label>
            <Input value={batchName} onChange={(event) => setBatchName(event.target.value)} placeholder="May 2026 Certificate Batch" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-ink-soft">Template type</p>
              <div className="mt-2 flex gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                  <input
                    type="radio"
                    name="templateType"
                    value="certificate"
                    checked={templateType === 'certificate'}
                    onChange={() => setTemplateType('certificate')}
                    className="h-4 w-4 text-bronze focus:ring-bronze"
                  />
                  Certificate (editor)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                  <input
                    type="radio"
                    name="templateType"
                    value="offer_letter"
                    checked={templateType === 'offer_letter'}
                    onChange={() => setTemplateType('offer_letter')}
                    className="h-4 w-4 text-bronze focus:ring-bronze"
                  />
                  Custom document (DOCX)
                </label>
              </div>

              {templateType === 'certificate' ? (
                <div className="mt-4 space-y-2">
                  <label className="block text-sm font-medium text-ink-soft">Choose certificate template</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(event) => setSelectedTemplateId(event.target.value)}
                    disabled={templatesLoading || !templates.length}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-paper-bright px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze focus:ring-4 focus:ring-bronze/15 disabled:cursor-not-allowed disabled:bg-paper-dim"
                  >
                    <option value="">{templatesLoading ? 'Loading templates' : 'Choose a template'}</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.isActive ? ' (Active)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs leading-5 text-ink-faint">
                    Pick the certificate template you edited. If you leave this blank, the active certificate template will be used.
                  </p>
                  {selectedTemplate ? (
                    <p className="text-xs font-medium text-ink-soft">
                      Selected: {selectedTemplate.name} {selectedTemplate.isActive ? '(Active)' : ''} · {selectedTemplate.imageWidth} x{' '}
                      {selectedTemplate.imageHeight}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-[color:var(--color-border)] bg-paper/50 px-4 py-3 text-sm text-ink-soft">
                  Upload a custom DOCX file. Use {'{{ColumnName}}'} inside the document for dynamic data replacement.
                </div>
              )}
            </div>

            {role === 'super_admin' ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-ink-soft">Company ID for super admin</label>
                <Input value={companyId} onChange={(event) => setCompanyId(event.target.value)} placeholder="Only needed for super admin" />
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-ink-soft">Email message</label>
              <textarea
                value={emailMessage}
                onChange={(event) => setEmailMessage(event.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-paper-bright px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-bronze focus:ring-4 focus:ring-bronze/15"
                placeholder="Hello {{name}},\nI hope you are doing well."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-ink-soft">Attachment text</label>
              <textarea
                value={attachmentMessage}
                onChange={(event) => setAttachmentMessage(event.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-paper-bright px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-bronze focus:ring-4 focus:ring-bronze/15"
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

            {templateType === 'offer_letter' ? (
              <FileDropzone
                label="DOCX template"
                accept=".docx"
                description="Upload the DOCX template file to be used for this batch."
                onFileChange={setTemplateFile}
              />
            ) : null}

            <FileDropzone
              label="Extra attachments"
              accept=".pdf,.png,.jpg,.jpeg"
              description="Add PDF, PNG, or JPEG files to send with the batch."
              multiple
              onFilesChange={addAttachments}
            />
          </div>

          <div className="rounded-2xl border border-bronze/25 bg-bronze/8 px-4 py-3 text-xs leading-5 text-bronze-deep">
            Column names and formatting should match your Excel sheet exactly. For preview and testing, use a sample or
            random email address in the sheet so you can safely check delivery.
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {templateType === 'certificate' && (
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
                {previewLoading ? 'Generating preview' : 'Generate sample preview'}
              </Button>
            )}
            <Button type="submit" disabled={loading || (templateType === 'offer_letter' && !templateFile)} className="sm:min-w-[220px]">
              <UploadCloud className="mr-2 h-4 w-4" />
              {loading ? 'Queuing batch' : 'Generate documents'}
            </Button>
          </div>

          {previewUrl ? (
            <div ref={previewSectionRef} className="rounded-[28px] border border-[color:var(--color-border)] bg-paper/50 p-4">
              <p className="font-serif text-lg text-ink">Sample preview</p>
              {previewMimeType.includes('pdf') ? (
                <object
                  data={previewUrl}
                  type="application/pdf"
                  className="mt-3 h-[70vh] w-full rounded-[24px] border border-[color:var(--color-border)] bg-paper-bright"
                >
                  <p className="p-4 text-sm text-ink-soft">Your browser cannot preview PDF files here.</p>
                </object>
              ) : (
                <img
                  src={previewUrl}
                  alt="Certificate preview"
                  loading="lazy"
                  decoding="async"
                  className="mt-3 w-full rounded-[24px] border border-[color:var(--color-border)] bg-paper-bright"
                />
              )}
            </div>
          ) : null}

          {attachments.length ? (
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-paper/50 p-4">
              <p className="text-sm font-medium text-ink-soft">Selected extra attachments</p>
              <div className="mt-3 space-y-2">
                {attachments.map((file, index) => (
                  <div
                    key={`${file.name}-${file.lastModified}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--color-border)] bg-paper-bright px-3 py-2 text-sm text-ink-soft"
                  >
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="shrink-0 rounded-full px-3 py-1 text-xs font-medium text-[#a3412e] transition hover:bg-[#a3412e]/8"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {message ? (
            <p className="rounded-2xl border border-[color:var(--color-border)] bg-paper/50 px-4 py-3 text-sm text-ink-soft">{message}</p>
          ) : null}
        </form>
      </Card>
    </div>
  );
}
