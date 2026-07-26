'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { CertificateEditor } from '@/components/certificate-editor/certificate-editor';
import type { CertificateFieldConfig, CertificateIssueDateMode } from '@/types/certificate';

type CertificateTemplateResponse = {
  template: {
    id: string;
    name: string;
    backgroundUrl: string;
    imageWidth: number;
    imageHeight: number;
    fieldConfig: CertificateFieldConfig[];
    issueDateMode: CertificateIssueDateMode;
    issueDateValue: string | null;
  };
};

type CertificateEditorSavePayload = {
  name: string;
  fieldConfig: CertificateFieldConfig[];
  issueDateMode: CertificateIssueDateMode;
  issueDateValue: string | null;
};

export default function CertificateEditorPage() {
  const params = useParams<{ id?: string }>() ?? {};
  const [template, setTemplate] = useState<CertificateTemplateResponse['template'] | null>(null);
  const [loading, setLoading] = useState(true);
  const templateId = String(params.id ?? '');

  useEffect(() => {
    let active = true;
    apiFetch<CertificateTemplateResponse>(`/certificate-templates/${templateId}`)
      .then((data) => {
        if (active) {
          setTemplate(data.template);
        }
      })
      .catch(() => {
        window.location.replace('/certificate-editor');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [templateId]);

  if (loading || !template) {
    return (
      <Card>
        <div className="h-[60vh] animate-pulse rounded-[28px] bg-paper-dim" />
      </Card>
    );
  }

  return (
    <CertificateEditor
      template={template}
      onSave={async (payload: CertificateEditorSavePayload) => {
        const result = await apiFetch<CertificateTemplateResponse>(`/certificate-templates/${template.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: payload.name,
            fieldConfig: payload.fieldConfig,
            issueDateMode: payload.issueDateMode,
            issueDateValue: payload.issueDateValue,
            isActive: true
          })
        });
        setTemplate(result.template);
        window.location.assign(`/uploads?templateId=${encodeURIComponent(result.template.id)}`);
      }}
    />
  );
}
