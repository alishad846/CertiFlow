'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { buildEditorConfig } from './editor-config';

// Same read-only render the editor + headless PDF use — so the chooser preview matches the editor 1:1.
const CertificateRender = dynamic(
  () => import('@certiflow/canva-editor').then((m) => m.CertificateRender as ComponentType<any>),
  { ssr: false }
);

const config = buildEditorConfig({ token: '', fields: [] });

export default function TemplatePreview({
  design,
  nativeWidth = 1414,
  nativeHeight = 1000,
}: {
  design: unknown;
  nativeWidth?: number;
  nativeHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = w ? w / nativeWidth : 0;

  return (
    <div
      ref={ref}
      style={{
        width: '100%',
        aspectRatio: `${nativeWidth} / ${nativeHeight}`,
        overflow: 'hidden',
        position: 'relative',
        background: '#fff',
      }}
    >
      {scale > 0 && design ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: nativeWidth,
            height: nativeHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
          }}
        >
          <CertificateRender design={design} config={config} />
        </div>
      ) : null}
    </div>
  );
}
