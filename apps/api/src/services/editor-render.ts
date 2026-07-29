import puppeteer, { type Browser } from 'puppeteer';
import { renderTemplateString } from './template-placeholders';
import type { TemplateData } from './template-placeholders';
import { env } from '../config/env';

/**
 * Replace every `{{token}}` occurrence in a Canva editor document with its value from `context`,
 * returning a deep clone (the input is never mutated).
 *
 * Tokens only ever live inside text-layer HTML, so a format-agnostic recursive string walk is the
 * most robust merge: it works on both the readable design shape and the PACKED/minified shape that
 * is actually stored in `certificate_templates.editor_document` (where a text layer's HTML lives
 * under the short key `v`). This same merge is reused by the headless PDF renderer so the on-screen
 * design and the rendered certificate stay in lockstep.
 *
 * Unresolved tokens collapse to an empty string (renderTemplateString's behaviour), which is what we
 * want for a final render — a missing column should not leak `{{placeholder}}` onto the certificate.
 */
export function mergeEditorDocument<T>(design: T, context: TemplateData): T {
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      return renderTemplateString(node, context);
    }
    if (Array.isArray(node)) {
      return node.map(walk);
    }
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        out[key] = walk(value);
      }
      return out;
    }
    return node;
  };

  return walk(design) as T;
}

const RENDER_READY_TIMEOUT_MS = 60_000;

/**
 * Launch a headless Chromium suitable for certificate rendering. Reuse a single browser across a
 * whole batch (pass it into `renderEditorPdf`) — spinning one up per recipient is the dominant cost.
 */
export async function launchRenderBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    ...(env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: env.PUPPETEER_EXECUTABLE_PATH } : {}),
  });
}

export type EditorPdfResult = { pdf: Buffer; width: number; height: number };

/**
 * Render a Canva-editor design to a pixel-exact PDF via the chromeless `/render` page.
 *
 * The design's `{{token}}` placeholders are merged with `context` first, then the merged (packed)
 * design is injected onto the render page's window. We wait for its `__RENDER_READY__` signal (fonts
 * + images loaded), read the page's native size, and print at exactly that size so the output matches
 * the on-screen design 1:1. Only page 1 is captured — certificates are single-page.
 */
export async function renderEditorPdf(params: {
  editorDocument: unknown;
  context: TemplateData;
  browser?: Browser;
  baseUrl?: string;
  apiBase?: string;
}): Promise<EditorPdfResult> {
  const merged = mergeEditorDocument(params.editorDocument, params.context);
  const baseUrl = (params.baseUrl ?? env.RENDER_BASE_URL).replace(/\/+$/, '');
  const apiBase = (params.apiBase ?? env.RENDER_API_BASE).replace(/\/+$/, '');

  const ownsBrowser = !params.browser;
  const browser = params.browser ?? (await launchRenderBrowser());
  const page = await browser.newPage();

  try {
    await page.evaluateOnNewDocument(
      (payload) => {
        (window as unknown as Record<string, unknown>).__CERTIFLOW_RENDER__ = payload;
      },
      { design: merged, apiBase }
    );
    await page.setViewport({ width: 1640, height: 924 });
    await page.goto(`${baseUrl}/render`, { waitUntil: 'load', timeout: RENDER_READY_TIMEOUT_MS });
    await page.waitForFunction('window.__RENDER_READY__ === true', {
      timeout: RENDER_READY_TIMEOUT_MS,
    });

    const size = (await page.evaluate('window.__RENDER_SIZE__')) as
      | { width: number; height: number }
      | undefined;
    const width = Math.max(1, Math.round(size?.width ?? 1640));
    const height = Math.max(1, Math.round(size?.height ?? 924));

    // The design renders at native size (scale 1) regardless of viewport; match the viewport so
    // nothing clips, then capture exactly page-sized.
    await page.setViewport({ width, height });
    const pdf = await page.pdf({
      width: `${width}px`,
      height: `${height}px`,
      printBackground: true,
      pageRanges: '1',
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
    });

    return { pdf: Buffer.from(pdf), width, height };
  } finally {
    await page.close().catch(() => undefined);
    if (ownsBrowser) {
      await browser.close().catch(() => undefined);
    }
  }
}
