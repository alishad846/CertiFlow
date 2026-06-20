import fs from 'fs/promises';
import path from 'path';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { AppError } from '../lib/errors';
import { ensureDir, safeSegment } from './fs';
import type { CertificateFieldConfig } from './certificate-templates';

type TemplateContext = Record<string, unknown>;

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getFieldValue(context: TemplateContext, field: string) {
  const value = context[field];
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

function getRenderableText(field: CertificateFieldConfig, context: TemplateContext) {
  if (typeof field.text === 'string') {
    return field.text;
  }

  return getFieldValue(context, field.field);
}

function getFieldPageNumber(field: CertificateFieldConfig) {
  return typeof field.pageNumber === 'number' && Number.isInteger(field.pageNumber) && field.pageNumber > 0
    ? field.pageNumber
    : undefined;
}

function shouldRenderOnPage(field: CertificateFieldConfig, pageNumber?: number) {
  const fieldPageNumber = getFieldPageNumber(field);
  if (fieldPageNumber !== undefined) {
    return fieldPageNumber === pageNumber;
  }

  return (pageNumber ?? 1) === 1;
}

function buildTextOverlay(params: {
  fields: CertificateFieldConfig[];
  context: TemplateContext;
  width: number;
  height: number;
  pageNumber?: number;
}) {
  const pieces = params.fields
    .filter((field) => shouldRenderOnPage(field, params.pageNumber))
    .map((field) => {
      const value = getRenderableText(field, params.context);
      if (!value) {
        return '';
      }
      const anchorX = field.align === 'center' ? field.x + field.width / 2 : field.align === 'right' ? field.x + field.width : field.x;
      const anchor = field.align === 'center' ? 'middle' : field.align === 'right' ? 'end' : 'start';
      const lines = value.split('\n').map((line) => escapeXml(line));
      return `
      <text
        x="${anchorX}"
        y="${field.y + field.fontSize}"
        text-anchor="${anchor}"
        font-family="${escapeXml(field.fontFamily)}"
        font-size="${field.fontSize}"
        fill="${escapeXml(field.color)}"
        xml:space="preserve"
      >${lines
        .map(
          (line, index) =>
            `<tspan x="${anchorX}" dy="${index === 0 ? 0 : field.fontSize * 1.2}">${line}</tspan>`
        )
        .join('')}</text>
    `;
    });

  return Buffer.from(`
    <svg width="${params.width}" height="${params.height}" viewBox="0 0 ${params.width} ${params.height}" xmlns="http://www.w3.org/2000/svg">
      ${pieces.join('\n')}
    </svg>
  `);
}

function getOutputPath(outputDir: string, baseName: string, suffix: string) {
  return path.join(outputDir, `${safeSegment(baseName)}${suffix}`);
}

type BackgroundSource = {
  input: string | Buffer;
  width: number;
  height: number;
};

type BackgroundPage = {
  input: Buffer;
  width: number;
  height: number;
};

async function renderPdfBackgroundPages(backgroundPath: string, pageNumbers?: number[]): Promise<BackgroundPage[]> {
  const pdfData = new Uint8Array(await fs.readFile(backgroundPath));
  const loadingTask: any = getDocument({
    data: pdfData,
    useWorkerFetch: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: true
  });

  try {
    const pdfDocument: any = await loadingTask.promise;
    const pages: BackgroundPage[] = [];
    const pagesToRender = pageNumbers?.length
      ? pageNumbers
      : Array.from({ length: pdfDocument.numPages }, (_value, index) => index + 1);

    for (const pageNumber of pagesToRender) {
      const page: any = await pdfDocument.getPage(pageNumber);
      try {
        const viewport = page.getViewport({ scale: 1 });
        const width = Math.max(1, Math.round(viewport.width));
        const height = Math.max(1, Math.round(viewport.height));
        const canvas: any = createCanvas(width, height);
        const canvasContext = canvas.getContext('2d');
        try {
          await page.render({
            canvas,
            canvasContext,
            viewport
          }).promise;
          pages.push({
            input: canvas.toBuffer('image/png'),
            width,
            height
          });
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }
      } finally {
        page.cleanup();
      }
    }

    return pages;
  } finally {
    await (loadingTask.destroy ? loadingTask.destroy().catch(() => undefined) : undefined);
  }
}

export async function loadBackgroundSource(backgroundPath: string): Promise<BackgroundSource> {
  const ext = path.extname(backgroundPath).toLowerCase();
  if (ext === '.pdf') {
    const [firstPage] = await renderPdfBackgroundPages(backgroundPath, [1]);
    if (!firstPage) {
      throw new AppError('Unable to read PDF background template', 400);
    }
    return firstPage;
  }

  const background = sharp(backgroundPath);
  const metadata = await background.metadata();
  return {
    input: backgroundPath,
    width: metadata.width ?? 1200,
    height: metadata.height ?? 800
  };
}

async function renderCertificateImage(params: {
  backgroundPath: string;
  fields: CertificateFieldConfig[];
  context: TemplateContext;
}) {
  const renderedPages = await renderCertificatePages(params, { pageNumbers: [1] });
  const firstPage = renderedPages[0];
  if (!firstPage) {
    throw new AppError('Unable to render certificate background', 400);
  }

  return firstPage;
}

async function renderCertificatePages(params: {
  backgroundPath: string;
  fields: CertificateFieldConfig[];
  context: TemplateContext;
}, options?: { pageNumbers?: number[] }) {
  const ext = path.extname(params.backgroundPath).toLowerCase();
  const backgrounds =
    ext === '.pdf'
      ? await renderPdfBackgroundPages(params.backgroundPath, options?.pageNumbers)
      : [
          {
            ...(await loadBackgroundSource(params.backgroundPath)),
            input: await sharp(params.backgroundPath).png().toBuffer()
          }
        ];

  return Promise.all(
    backgrounds.map(async (background, index) => {
      const pageNumber = options?.pageNumbers?.[index] ?? index + 1;
      const overlay = buildTextOverlay({
        fields: params.fields,
        context: params.context,
        width: background.width,
        height: background.height,
        pageNumber
      });

      const pngBuffer = await sharp(background.input)
        .composite([{ input: overlay }])
        .png()
        .toBuffer();

      return {
        pngBuffer,
        width: background.width,
        height: background.height
      };
    })
  );
}

async function stackPageImages(pages: Array<{ input: Buffer; width: number; height: number }>) {
  if (!pages.length) {
    throw new AppError('Unable to render PDF preview', 400);
  }

  const width = Math.max(...pages.map((page) => page.width));
  const height = pages.reduce((total, page) => total + page.height, 0);
  const canvas = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    }
  });

  let top = 0;
  const composites = pages.map((page) => {
    const left = Math.max(0, Math.floor((width - page.width) / 2));
    const position = { input: page.input, left, top };
    top += page.height;
    return position;
  });

  return canvas.composite(composites).png().toBuffer();
}

export async function renderCertificatePdf(params: {
  backgroundPath: string;
  fields: CertificateFieldConfig[];
  context: TemplateContext;
  outputDir: string;
  baseName: string;
}) {
  await ensureDir(params.outputDir);
  const renderedPages = await renderCertificatePages({
    backgroundPath: params.backgroundPath,
    fields: params.fields,
    context: params.context
  });

  const pngPath = getOutputPath(params.outputDir, params.baseName, '.png');
  const pdfPath = getOutputPath(params.outputDir, params.baseName, '.pdf');
  await fs.writeFile(pngPath, renderedPages[0].pngBuffer);

  const pdfDoc = await PDFDocument.create();
  for (const pageImage of renderedPages) {
    const page = pdfDoc.addPage([pageImage.width, pageImage.height]);
    const embedded = await pdfDoc.embedPng(new Uint8Array(pageImage.pngBuffer));
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: pageImage.width,
      height: pageImage.height
    });
  }

  const outputPdf = await pdfDoc.save();
  await fs.writeFile(pdfPath, outputPdf);

  return {
    pngPath,
    pdfPath,
    width: renderedPages[0].width,
    height: renderedPages[0].height
  };
}

export async function renderCertificatePreviewPdf(params: {
  backgroundPath: string;
  fields: CertificateFieldConfig[];
  context: TemplateContext;
}) {
  const renderedPages = await renderCertificatePages(params);
  if (!renderedPages.length) {
    throw new AppError('Unable to render PDF preview', 400);
  }

  const pdfDoc = await PDFDocument.create();
  for (const pageImage of renderedPages) {
    const page = pdfDoc.addPage([pageImage.width, pageImage.height]);
    const embedded = await pdfDoc.embedPng(new Uint8Array(pageImage.pngBuffer));
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: pageImage.width,
      height: pageImage.height
    });
  }

  return Buffer.from(await pdfDoc.save());
}

export async function renderCertificatePdfPreview(params: {
  backgroundPath: string;
  fields: CertificateFieldConfig[];
  context: TemplateContext;
}) {
  const ext = path.extname(params.backgroundPath).toLowerCase();

  if (ext === '.pdf') {
    const [firstPage] = await renderCertificatePages(params, { pageNumbers: [1] });
    if (!firstPage) {
      throw new AppError('Unable to render PDF preview', 400);
    }
    return firstPage.pngBuffer;
  }

  const rendered = await renderCertificateImage(params);
  return rendered.pngBuffer;
}

export async function renderCertificateBackgroundPreview(params: {
  backgroundPath: string;
  fields: CertificateFieldConfig[];
  context: TemplateContext;
  pageNumber?: number;
}) {
  const ext = path.extname(params.backgroundPath).toLowerCase();

  if (ext === '.pdf') {
    const renderedPages = await renderCertificatePages(params);
    if (!renderedPages.length) {
      throw new AppError('Unable to render PDF preview', 400);
    }
    const pageIndex = Math.min(Math.max((params.pageNumber ?? 1) - 1, 0), renderedPages.length - 1);
    return {
      pngBuffer: renderedPages[pageIndex].pngBuffer,
      pageCount: renderedPages.length
    };
  }

  const rendered = await renderCertificateImage(params);
  return {
    pngBuffer: rendered.pngBuffer,
    pageCount: 1
  };
}

export function normalizeCertificateFieldConfig(fields: CertificateFieldConfig[]) {
  return fields.map((field) => ({
    field: field.field,
    x: field.x,
    y: field.y,
    width: field.width,
    fontSize: field.fontSize,
    fontFamily: field.fontFamily,
    color: field.color,
    align: field.align,
    ...(typeof field.pageNumber === 'number' ? { pageNumber: field.pageNumber } : {}),
    text: field.text
  }));
}
