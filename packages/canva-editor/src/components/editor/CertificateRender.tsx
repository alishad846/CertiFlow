'use client';

import { FC, useEffect } from 'react';
import { EditorConfig, SerializedPage } from 'canva-editor/types';
import { GlobalStyle } from 'canva-editor/layers';
import { unpack } from 'canva-editor/utils/minifier';
import { EditorContext } from './EditorContext';
import { useEditorStore } from '../../hooks/useEditorStore';
import { useEditor } from '../../hooks';
import { useUsedFont } from '../../hooks/useUsedFont';
import Page from './Page';
import {
  TranslationContext,
  createTranslateFunction,
} from '../../contexts/TranslationContext';

export type CertificateRenderProps = {
  /** Packed design (the exact `editor_document` stored on a certificate template). */
  design: unknown;
  config: EditorConfig;
  /** Fired once the first page's fonts + images have finished loading. */
  onReady?: (size: { width: number; height: number }) => void;
};

/**
 * Chromeless, read-only render of a single certificate page at its native pixel size (scale 1).
 *
 * This is the headless-render counterpart to the on-screen editor: the batch worker drives a
 * Puppeteer browser to this component's host page, waits for `window.__RENDER_READY__`, then prints
 * the exact-sized page to PDF. Unlike the slideshow `Preview`, it never scales to the viewport, so the
 * captured PDF matches the design 1:1 — the parity guarantee the signed certificate depends on.
 */
const RenderInner: FC<{
  design: unknown;
  onReady?: (size: { width: number; height: number }) => void;
}> = ({ design, onReady }) => {
  const { pages, pageSize, actions } = useEditor((state) => ({
    pages: state.pages,
    pageSize: state.pageSize,
  }));
  const { usedFonts } = useUsedFont();

  useEffect(() => {
    if (!design) return;
    const serialized: SerializedPage[] = unpack(design);
    actions.setData(serialized);
    // actions is stable for the lifetime of the store; design is the only real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design]);

  useEffect(() => {
    if (pages.length === 0) return;
    let cancelled = false;

    const signalReady = () => {
      if (cancelled) return;
      const size = { width: pageSize.width, height: pageSize.height };
      (window as unknown as Record<string, unknown>).__RENDER_SIZE__ = size;
      (window as unknown as Record<string, unknown>).__RENDER_READY__ = true;
      onReady?.(size);
    };

    const waitForAssets = async () => {
      // Let the first paint kick off font + image requests before we await them.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      try {
        const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
        if (fonts?.ready) await fonts.ready;
      } catch {
        /* font loading API unavailable — proceed */
      }
      const images = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
      await Promise.all(
        images.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
              })
        )
      );
      // A short settle so @font-face swaps and layout have flushed before capture.
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      signalReady();
    };

    void waitForAssets();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length, pageSize.width, pageSize.height, usedFonts]);

  if (pages.length === 0) {
    return null;
  }

  return (
    <div
      id="certiflow-render-root"
      data-width={pageSize.width}
      data-height={pageSize.height}
      style={{
        position: 'relative',
        width: pageSize.width,
        height: pageSize.height,
        overflow: 'hidden',
        background: '#ffffff',
      }}
    >
      <GlobalStyle fonts={usedFonts} />
      <Page
        pageIndex={0}
        width={pageSize.width}
        height={pageSize.height}
        scale={1}
        isActive={true}
      />
    </div>
  );
};

export const CertificateRender: FC<CertificateRenderProps> = ({
  design,
  config,
  onReady,
}) => {
  const { getState, actions, query } = useEditorStore();
  const messages = config.translations || {};
  const translate = createTranslateFunction(messages);

  return (
    <TranslationContext.Provider value={{ messages, translate }}>
      <EditorContext.Provider value={{ config, getState, actions, query }}>
        <RenderInner design={design} onReady={onReady} />
      </EditorContext.Provider>
    </TranslationContext.Provider>
  );
};

export default CertificateRender;
