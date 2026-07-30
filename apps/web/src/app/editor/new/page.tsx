'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBlankTemplate } from '@/lib/editor-templates';
import { isAuthError, EditorFullScreenLoader, EditorFullScreenError } from '@/components/editor/editor-page-chrome';

export default function NewEditorPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    createBlankTemplate()
      .then((created) => {
        if (active) router.replace(`/editor/${created.id}`);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to create template';
        if (isAuthError(message)) {
          window.location.replace('/login');
          return;
        }
        if (active) setError(message);
      });

    return () => {
      active = false;
    };
  }, [router]);

  if (error) {
    return <EditorFullScreenError message={error} />;
  }

  return <EditorFullScreenLoader />;
}
