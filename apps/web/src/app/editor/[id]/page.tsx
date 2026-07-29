'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getTemplate } from '@/lib/editor-templates';
import { buildBackgroundDocument } from '@/lib/editor-document';
import { isAuthError, EditorFullScreenLoader, EditorFullScreenError } from '@/components/editor/editor-page-chrome';
import EditorClient from './editor-client';

function isEmptyDesign(d: unknown) {
  return !d || (typeof d === 'object' && !Array.isArray(d) && Object.keys(d as object).length === 0);
}

/**
 * Choose the design to open: the saved editor document if one exists, otherwise seed a
 * background from the template's uploaded image so the user designs on top of it. A blank
 * template (white placeholder background) opens as a clean blank canvas.
 */
function resolveDesign(t: {
  editorDocument: unknown;
  backgroundUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
}) {
  if (!isEmptyDesign(t.editorDocument)) return t.editorDocument;
  if (t.backgroundUrl && !/blank\.png$/i.test(t.backgroundUrl)) {
    return buildBackgroundDocument({
      backgroundUrl: t.backgroundUrl,
      width: t.imageWidth ?? 1414,
      height: t.imageHeight ?? 1000
    });
  }
  return undefined;
}

export default function EditorPage() {
  const params = useParams<{ id?: string }>() ?? {};
  const templateId = String(params.id ?? '');
  const [template, setTemplate] = useState<{ name: string; design: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getTemplate(templateId)
      .then((t) => {
        if (active) setTemplate({ name: t.name, design: resolveDesign(t) });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load template';
        if (isAuthError(message)) {
          window.location.replace('/login');
          return;
        }
        if (active) setError(message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [templateId]);

  if (error) {
    return <EditorFullScreenError message={error} />;
  }

  if (loading || !template) {
    return <EditorFullScreenLoader />;
  }

  return (
    <EditorClient templateId={templateId} name={template.name} design={template.design} />
  );
}
