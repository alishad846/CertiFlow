import path from 'path';
import { pathToFileURL } from 'url';
import { DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';

type NodeProcessWithBuiltin = NodeJS.Process & {
  getBuiltinModule?: (name: string) => unknown;
};

let pdfjsPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;

export async function loadPdfJs() {
  const nodeProcess = process as NodeProcessWithBuiltin;
  if (!nodeProcess.getBuiltinModule) {
    nodeProcess.getBuiltinModule = (name: string) => require(name);
  }

  const globals = globalThis as typeof globalThis & {
    DOMMatrix?: unknown;
    ImageData?: unknown;
    Path2D?: unknown;
  };

  if (!globals.DOMMatrix) {
    globals.DOMMatrix = DOMMatrix as any;
  }
  if (!globals.ImageData) {
    globals.ImageData = ImageData as any;
  }
  if (!globals.Path2D) {
    globals.Path2D = Path2D as any;
  }

  pdfjsPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsPromise;
}

export function getPdfjsStandardFontDataUrl() {
  const standardFontDir = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts');
  return pathToFileURL(`${standardFontDir}${path.sep}`).href;
}

