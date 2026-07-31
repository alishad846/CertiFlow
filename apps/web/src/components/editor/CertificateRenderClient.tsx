'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';

const CertificateRender = dynamic(
  () => import('@certiflow/canva-editor').then((m) => m.CertificateRender as ComponentType<any>),
  { ssr: false }
);

type RenderPayload = {
  /** Packed, already token-merged design. */
  design: unknown;
  /** Absolute API origin the design's font/image assets are fetched from. */
  apiBase?: string;
};

function buildRenderConfig(apiBase: string) {
  const base = apiBase.replace(/\/+$/, '');
  return {
    apis: {
      url: base ? `${base}/api/editor` : '/api/editor',
      userToken: '',
      searchFonts: '/search-fonts',
      searchTemplates: '/search-templates',
      searchTexts: '/search-texts',
      searchImages: '/search-images',
      searchShapes: '/search-shapes',
      searchFrames: '/search-frames',
      fetchUserImages: '/your-uploads/get-user-images',
      uploadUserImage: '/your-uploads/upload',
      removeUserImage: '/your-uploads/remove',
      templateKeywordSuggestion: '/template-suggestion',
      textKeywordSuggestion: '/text-suggestion',
      imageKeywordSuggestion: '/image-suggestion',
      shapeKeywordSuggestion: '/shape-suggestion',
      frameKeywordSuggestion: '/frame-suggestion',
    },
    unsplash: { accessKey: '', pageSize: 30 },
    editorAssetsUrl: '/editor-assets',
    translations: {},
  };
}

/**
 * Host for the headless certificate renderer. The batch worker's Puppeteer browser injects the merged
 * design onto `window.__CERTIFLOW_RENDER__` before navigation; this component mounts it read-only at
 * native size. When the page is ready, `CertificateRender` sets `window.__RENDER_READY__` so the
 * worker knows it is safe to capture the PDF.
 */
export default function CertificateRenderClient() {
  const [payload, setPayload] = useState<RenderPayload | null>(null);

  useEffect(() => {
    const globalWindow = window as unknown as Record<string, unknown>;
    const read = () => {
      const injected = globalWindow.__CERTIFLOW_RENDER__ as RenderPayload | undefined;
      if (injected && injected.design) {
        setPayload(injected);
        return true;
      }
      return false;
    };
    if (read()) return;
    // The design may be injected slightly after mount; poll briefly until it arrives.
    const interval = setInterval(() => {
      if (read()) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  if (!payload) {
    return null;
  }

  return (
    <>
      <style>{`html, body { margin: 0; padding: 0; background: #ffffff; }`}</style>
      <CertificateRender design={payload.design} config={buildRenderConfig(payload.apiBase ?? '')} />
    </>
  );
}
