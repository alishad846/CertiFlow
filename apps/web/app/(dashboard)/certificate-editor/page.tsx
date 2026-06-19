'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ImagePlus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
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

export default function CertificateEditorStartPage() {
  const [companyId, setCompanyId] = useState('');
  const [role, setRole] = useState<MeResponse['user']['role'] | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<TemplateSummary | null>(null);
  const [name, setName] = useState('');
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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
    if (role !== 'company_admin' || !companyId) {
      setActiveTemplate(null);
      return () => {
        active = false;
      };
    }

    apiFetch<{ templates: TemplateSummary[] }>('/certificate-templates/my')
      .then((data) => {
        if (!active) {
          return;
        }
        setActiveTemplate(data.templates.find((template) => template.isActive) ?? data.templates[0] ?? null);
      })
      .catch(() => {
        if (active) {
          setActiveTemplate(null);
        }
      });

    return () => {
      active = false;
    };
  }, [companyId, role]);

  return (
    <div className="space-y-6">
      <Card className="border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.03),rgba(42,141,240,0.05))]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Certificate editor</p>
        <h2 className="mt-3 text-4xl font-bold tracking-tight text-ink md:text-5xl">
          Upload a background image or PDF and place dynamic fields on it.
        </h2>
      </Card>

      {activeTemplate ? (
        <Card className="border-white/80">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-20 w-28 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                {activeTemplate.backgroundUrl.toLowerCase().endsWith('.pdf') ? (
                  <object
                    data={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}${activeTemplate.backgroundUrl}#toolbar=0&view=FitH`}
                    type="application/pdf"
                    className="h-full w-full"
                  >
                    <div className="flex h-full items-center justify-center bg-slate-100 text-xs font-semibold text-slate-500">
                      PDF
                    </div>
                  </object>
                ) : (
                  <img
                    src={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}${activeTemplate.backgroundUrl}`}
                    alt={activeTemplate.name}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Current template</p>
                <h3 className="mt-1 text-2xl font-bold tracking-tight text-ink">{activeTemplate.name}</h3>
                <p className="mt-2 text-sm text-slate-500">
                  {activeTemplate.imageWidth} x {activeTemplate.imageHeight}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link href={`/certificate-editor/${activeTemplate.id}`}>Continue editing</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/templates">Open templates</Link>
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="border-white/80">
        <form
          className="space-y-6"
          onSubmit={async (event) => {
            event.preventDefault();
            setMessage('');
            if (!backgroundFile) {
              setMessage('Please choose a PNG, JPG, or PDF background file.');
              return;
            }

            setLoading(true);
            try {
              const form = new FormData();
              form.append('name', name || 'Certificate template');
              form.append('backgroundImage', backgroundFile);
              if (companyId) form.append('companyId', companyId);

              const result = await apiFetch<{ template: { id: string } }>('/certificate-templates', {
                method: 'POST',
                body: form
              });
              window.location.assign(`/certificate-editor/${result.template.id}`);
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Failed to create template');
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Template name</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Main certificate template" />
            </div>
            {role === 'super_admin' ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Company ID for super admin</label>
                <Input value={companyId} onChange={(event) => setCompanyId(event.target.value)} placeholder="Only needed for super admin" />
              </div>
            ) : null}
          </div>

          <FileDropzone
            label="Certificate background"
            accept=".png,.jpg,.jpeg,.pdf"
            description="Upload the original certificate background image or PDF."
            onFileChange={setBackgroundFile}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="submit" disabled={loading} className="sm:min-w-[220px]">
              <ImagePlus className="mr-2 h-4 w-4" />
              {loading ? 'Creating template...' : 'Open editor'}
            </Button>
          </div>

          {message ? <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p> : null}
        </form>
      </Card>
    </div>
  );
}
