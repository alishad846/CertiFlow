'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the LATEST design so renaming (and Home/Save) never clobber edits with the stale
  // mount-time `design` — the bug that reverted saved templates back to their original stock design.
  const latestDesign = useRef<unknown>(design);
  const config = buildEditorConfig({ token: '', fields: MERGE_FIELDS });

  const onChanges = useCallback(
    (next: unknown) => {
      latestDesign.current = next;
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
      // Save the name alongside the LATEST design (not the stale original) so edits survive a rename.
      saveDesign(templateId, { name: n, editorDocument: latestDesign.current });
    },
    [templateId]
  );

  // Header "Save": persist the latest design, then take the user to the Upload Batch flow so they can
  // send certificates with the template they just finished.
  const onSave = useCallback(
    (latest: unknown) => {
      if (timer.current) clearTimeout(timer.current);
      setSaving(true);
      saveDesign(templateId, { editorDocument: latest })
        .then(() => router.push('/uploads'))
        .catch(() => setSaving(false));
    },
    [templateId, router]
  );

  // Home → "Save & go to dashboard": persist the latest design, then navigate to the dashboard.
  const onHomeSave = useCallback(
    (latest: unknown) => {
      if (timer.current) clearTimeout(timer.current);
      setSaving(true);
      saveDesign(templateId, { editorDocument: latest })
        .then(() => router.push('/dashboard'))
        .catch(() => setSaving(false));
    },
    [templateId, router]
  );

  // Home → "Leave without saving": the editor autosaves as you work, so to truly discard this
  // session's edits we write the ORIGINAL design (as it was when the editor opened) back, then leave.
  const onHomeDiscard = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setSaving(true);
    saveDesign(templateId, { editorDocument: design ?? null }).finally(() => router.push('/dashboard'));
  }, [templateId, design, router]);

  return (
    <CertificateEditor
      name={name}
      design={design}
      config={config}
      saving={saving}
      onChanges={onChanges}
      onNameChange={onNameChange}
      onRemove={() => history.back()}
      onSave={onSave}
      onHomeSave={onHomeSave}
      onHomeDiscard={onHomeDiscard}
    />
  );
}
