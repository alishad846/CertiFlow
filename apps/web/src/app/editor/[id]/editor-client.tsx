'use client';

import { useCallback, useRef, useState } from 'react';
import CertificateEditor from '@/components/editor/CertificateEditor';
import { buildEditorConfig } from '@/components/editor/editor-config';
import { saveDesign } from '@/lib/editor-templates';
import { useEditorLockdown } from '@/components/editor/lockdown';

const MERGE_FIELDS = ['recipient_name', 'issue_date', 'course', 'certificate_id'];

export default function EditorClient({
  templateId,
  name,
  design
}: {
  templateId: string;
  name: string;
  design: unknown;
}) {
  useEditorLockdown();
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const config = buildEditorConfig({ token: '', fields: MERGE_FIELDS });

  const onChanges = useCallback(
    (next: unknown) => {
      if (timer.current) clearTimeout(timer.current);
      setSaving(true);
      timer.current = setTimeout(() => {
        saveDesign(templateId, { editorDocument: next }).finally(() => setSaving(false));
      }, 800);
    },
    [templateId]
  );

  const onNameChange = useCallback(
    (n: string) => {
      saveDesign(templateId, { name: n, editorDocument: design });
    },
    [templateId, design]
  );

  return (
    <CertificateEditor
      name={name}
      design={design}
      config={config}
      saving={saving}
      onChanges={onChanges}
      onNameChange={onNameChange}
      onRemove={() => history.back()}
    />
  );
}
