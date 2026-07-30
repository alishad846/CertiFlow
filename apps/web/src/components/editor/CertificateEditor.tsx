'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

const CanvaEditor = dynamic(
  () => import('@certiflow/canva-editor').then((m) => m.CanvaEditor as ComponentType<any>),
  { ssr: false }
);

export type CertificateEditorProps = {
  name: string;
  design: unknown;                       // saved editor_document JSON (or undefined for blank)
  config: any;                           // EditorConfig from editor-config.ts
  saving: boolean;
  onChanges: (design: unknown) => void;
  onNameChange: (name: string) => void;
  onRemove: () => void;
};

export default function CertificateEditor(props: CertificateEditorProps) {
  return (
    <CanvaEditor
      data={{ name: props.name, editorConfig: props.design }}
      config={props.config}
      saving={props.saving}
      onChanges={props.onChanges}
      onDesignNameChanges={props.onNameChange}
      onRemove={props.onRemove}
    />
  );
}
