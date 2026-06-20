'use client';

import { useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileDropzone } from '@/components/ui/file-dropzone';

export default function CertificateEditorStartPage() {
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  return (
    <div className="space-y-6">
      <Card className="border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.03),rgba(42,141,240,0.05))]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Certificate editor</p>
        <h2 className="mt-3 text-4xl font-bold tracking-tight text-ink md:text-5xl">
          Upload a background image or PDF template and place dynamic fields on it.
        </h2>
      </Card>

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
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Company ID for super admin</label>
              <Input value={companyId} onChange={(event) => setCompanyId(event.target.value)} placeholder="Only needed for super admin" />
            </div>
          </div>

          <FileDropzone
            label="Certificate background"
            accept=".png,.jpg,.jpeg,.pdf"
            description="Upload the original certificate background image or PDF template."
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
