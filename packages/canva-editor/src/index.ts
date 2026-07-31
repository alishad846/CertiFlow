'use client';

import { CanvaEditor } from './components/editor';
export { CanvaEditor };
export { CertificateRender } from './components/editor/CertificateRender';
export type { CertificateRenderProps } from './components/editor/CertificateRender';
export type { EditorConfig } from './types/editor';
export { useTranslate, useTranslationMessages } from './contexts/TranslationContext';
export type { TranslationMessages, TranslateFunction } from './contexts/TranslationContext';
export default CanvaEditor;