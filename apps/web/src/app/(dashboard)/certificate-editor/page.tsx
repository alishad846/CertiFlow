'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Sparkles, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getTemplatePreviewSrc } from '@/lib/template-preview';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileDropzone } from '@/components/ui/file-dropzone';
import TemplatePreview from '@/components/editor/TemplatePreview';

type MeResponse = { user: { role: 'super_admin' | 'company_admin'; companyId: string | null } };

type TemplateSummary = {
  id: string;
  name: string;
  backgroundUrl: string;
  isActive: boolean;
  imageWidth: number;
  imageHeight: number;
};

type StockTemplate = {
  id: string;
  name: string;
  thumbnailUrl: string;
  category: 'certificate' | 'offer-letter';
  design: unknown;
};

type Selection =
  | { kind: 'mine'; id: string }
  | { kind: 'stock'; id: string }
  | { kind: 'upload' }
  | null;

export default function CertificateEditorChooserPage() {
  const router = useRouter();
  const [role, setRole] = useState<MeResponse['user']['role'] | null>(null);
  const [companyId, setCompanyId] = useState('');
  const [mine, setMine] = useState<TemplateSummary[]>([]);
  const [stock, setStock] = useState<StockTemplate[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [name, setName] = useState('');
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch<MeResponse>('/auth/me')
      .then((data) => {
        if (!active) return;
        setRole(data.user.role);
        if (data.user.role !== 'super_admin') setCompanyId(data.user.companyId ?? '');
      })
      .catch(() => active && setRole(null));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    // Ready-made gallery (available to everyone).
    apiFetch<{ templates: StockTemplate[] }>('/certificate-templates/stock')
      .then((data) => active && setStock(data.templates ?? []))
      .catch(() => active && setStock([]));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (role !== 'company_admin') {
      setMine([]);
      return () => {
        active = false;
      };
    }
    apiFetch<{ templates: TemplateSummary[] }>('/certificate-templates/my')
      .then((data) => active && setMine(data.templates ?? []))
      .catch(() => active && setMine([]));
    return () => {
      active = false;
    };
  }, [role]);

  const openEditor = async () => {
    setMessage('');
    if (!selection) {
      setMessage('Choose a template, pick a ready-made design, or upload your own to continue.');
      return;
    }
    setBusy(true);
    try {
      if (selection.kind === 'mine') {
        router.push(`/editor/${selection.id}`);
        return;
      }
      if (selection.kind === 'stock') {
        const res = await apiFetch<{ template: { id: string } }>('/certificate-templates/from-stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stockId: selection.id, companyId: companyId || undefined })
        });
        router.push(`/editor/${res.template.id}`);
        return;
      }
      // upload
      if (!backgroundFile) {
        setMessage('Please choose a PNG, JPG, or PDF background to upload.');
        setBusy(false);
        return;
      }
      const form = new FormData();
      form.append('name', name || 'My certificate');
      form.append('backgroundImage', backgroundFile);
      if (companyId) form.append('companyId', companyId);
      const res = await apiFetch<{ template: { id: string } }>('/certificate-templates', {
        method: 'POST',
        body: form
      });
      router.push(`/editor/${res.template.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open the editor.');
      setBusy(false);
    }
  };

  const cardBase =
    'group relative overflow-hidden rounded-2xl border bg-paper/40 text-left transition focus:outline-none';
  const isSel = (s: Selection) =>
    selection && s && selection.kind === s.kind && (('id' in selection && 'id' in s) ? selection.id === s.id : true);

  return (
    <div className="space-y-6">
      <Card>
        <p className="eyebrow">Certificate editor</p>
        <h2 className="mt-3 font-serif text-4xl tracking-tight text-ink md:text-5xl">
          Start a certificate design
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-ink-soft">
          Pick one of your templates, choose a ready-made design, or upload your own background —
          then open the full-screen editor to place names, dates, and details.
        </p>
      </Card>

      {/* Your templates */}
      {role === 'company_admin' ? (
        <Card>
          <div className="flex items-center justify-between">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-faint">Your templates</p>
          </div>
          {mine.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">You haven’t created any templates yet.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {mine.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelection({ kind: 'mine', id: t.id })}
                  className={`${cardBase} ${isSel({ kind: 'mine', id: t.id }) ? 'border-bronze ring-2 ring-bronze' : 'border-[color:var(--color-border)]'}`}
                >
                  <div className="aspect-[7/5] w-full overflow-hidden bg-paper/60">
                    <img src={getTemplatePreviewSrc(t)} alt={t.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="px-3 py-2">
                    <p className="truncate font-serif text-sm text-ink">{t.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {/* Ready-made gallery — previews are the actual editable designs (they match the editor exactly) */}
      <Card>
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-faint">Ready-made designs</p>
        {stock.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">Ready-made designs are on the way.</p>
        ) : (
          <div className="mt-4 space-y-6">
            {(
              [
                { key: 'certificate', label: 'Certificates', w: 1414, h: 1000 },
                { key: 'offer-letter', label: 'Offer letters', w: 1000, h: 1414 }
              ] as const
            ).map((group) => {
              const items = stock.filter((t) => t.category === group.key);
              if (items.length === 0) return null;
              return (
                <div key={group.key}>
                  <p className="mb-3 font-serif text-sm text-ink-soft">{group.label}</p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {items.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelection({ kind: 'stock', id: t.id })}
                        className={`${cardBase} ${isSel({ kind: 'stock', id: t.id }) ? 'border-bronze ring-2 ring-bronze' : 'border-[color:var(--color-border)]'}`}
                      >
                        <div className="w-full overflow-hidden bg-paper/60">
                          <TemplatePreview design={t.design} nativeWidth={group.w} nativeHeight={group.h} />
                        </div>
                        <div className="px-3 py-2">
                          <p className="truncate font-serif text-sm text-ink">{t.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Upload your own */}
      <Card>
        <button
          type="button"
          onClick={() => setSelection({ kind: 'upload' })}
          className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left ${isSel({ kind: 'upload' }) ? 'border-bronze ring-2 ring-bronze' : 'border-[color:var(--color-border)]'}`}
        >
          <ImagePlus className="h-4 w-4 text-bronze" />
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-faint">Upload your own</span>
        </button>

        {isSel({ kind: 'upload' }) ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-ink-soft">Template name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My certificate" />
              </div>
              {role === 'super_admin' ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-ink-soft">Company ID</label>
                  <Input value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="Company ID (super admin)" />
                </div>
              ) : null}
            </div>
            <FileDropzone
              label="Certificate background"
              accept=".png,.jpg,.jpeg,.pdf"
              description="Upload a PNG, JPG, or PDF to design on top of."
              onFileChange={setBackgroundFile}
            />
          </div>
        ) : null}
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button onClick={openEditor} disabled={busy} className="sm:min-w-[220px]">
          <Sparkles className="mr-2 h-4 w-4" />
          {busy ? 'Opening editor…' : 'Open editor'}
        </Button>
        <Button variant="secondary" onClick={() => router.push('/editor/new')} disabled={busy}>
          <Plus className="mr-2 h-4 w-4" /> Start from blank
        </Button>
      </div>

      {message ? (
        <p className="rounded-2xl border border-[color:var(--color-border)] bg-paper/50 px-4 py-3 text-sm text-ink-soft">
          {message}
        </p>
      ) : null}
    </div>
  );
}
