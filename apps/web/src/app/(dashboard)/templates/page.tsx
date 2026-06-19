'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, PencilLine, Trash2, Sparkles, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getTemplatePreviewSrc } from '@/lib/template-preview';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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

export default function TemplatesPage() {
  const [companyId, setCompanyId] = useState('');
  const [role, setRole] = useState<MeResponse['user']['role']>('company_admin');
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState('');
  const [message, setMessage] = useState('');

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
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!companyId && role !== 'super_admin') {
      return;
    }

    let active = true;
    setLoading(true);
    apiFetch<{ templates: TemplateItem[] }>(`/certificate-templates${role === 'super_admin' ? `?companyId=${encodeURIComponent(companyId)}` : ''}`)
      .then((data) => {
        if (active) {
          setTemplates(data.templates);
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'Failed to load templates');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [companyId, role]);

  return (
    <div className="space-y-6">
      <Card className="border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.03),rgba(42,141,240,0.05))]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">My Templates</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight text-ink md:text-5xl">Manage, duplicate, and reuse certificate designs.</h2>
          </div>
          <Button asChild>
            <Link href="/certificate-editor">
              <Plus className="mr-2 h-4 w-4" />
              New template
            </Link>
          </Button>
        </div>
      </Card>

      {role === 'super_admin' ? (
        <Card className="border-white/80">
          <label className="mb-2 block text-sm font-medium text-slate-700">Company ID</label>
          <Input value={companyId} onChange={(event) => setCompanyId(event.target.value)} placeholder="Enter company ID to view templates" />
        </Card>
      ) : null}

      {message ? <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {loading ? (
          <Card className="border-white/80">
            <div className="h-72 animate-pulse rounded-[24px] bg-slate-200/70" />
          </Card>
        ) : templates.length ? (
          templates.map((template) => (
            <Card key={template.id} className="border-white/80 overflow-hidden">
              <div className="grid gap-4 lg:grid-cols-[220px,1fr]">
                <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50 min-h-[220px]">
                  <img
                    src={getTemplatePreviewSrc(template)}
                    alt={template.name}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Template</p>
                      <h3 className="mt-1 text-2xl font-bold tracking-tight text-ink">{template.name}</h3>
                      <p className="mt-2 text-sm text-slate-500">
                        {template.imageWidth} x {template.imageHeight}
                      </p>
                    </div>
                    {template.isActive ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Active</span> : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="secondary">
                      <Link href={`/certificate-editor/${template.id}`}>
                        <PencilLine className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={actioningId === template.id}
                      onClick={async () => {
                        setActioningId(template.id);
                        try {
                          const result = await apiFetch<{ template: TemplateItem }>(`/certificate-templates/${template.id}/duplicate`, {
                            method: 'POST'
                          });
                          window.location.assign(`/certificate-editor/${result.template.id}`);
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : 'Failed to duplicate template');
                        } finally {
                          setActioningId('');
                        }
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={actioningId === template.id}
                      onClick={async () => {
                        setActioningId(template.id);
                        try {
                          await apiFetch(`/certificate-templates/${template.id}`, {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ isActive: true })
                          });
                          setTemplates((current) => current.map((item) => ({ ...item, isActive: item.id === template.id })));
                          window.location.assign(`/uploads?templateId=${encodeURIComponent(template.id)}`);
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : 'Failed to activate template');
                        } finally {
                          setActioningId('');
                        }
                      }}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Use template
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={actioningId === template.id}
                      onClick={async () => {
                        if (!window.confirm('Delete this template?')) {
                          return;
                        }
                        setActioningId(template.id);
                        try {
                          await apiFetch(`/certificate-templates/${template.id}`, { method: 'DELETE' });
                          setTemplates((current) => current.filter((item) => item.id !== template.id));
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : 'Failed to delete template');
                        } finally {
                          setActioningId('');
                        }
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="border-white/80">
            <p className="text-sm text-slate-500">No templates found for this company.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
