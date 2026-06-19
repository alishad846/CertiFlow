import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { PDFDocument, StandardFonts, rgb, type PDFDocument as PDFDocumentType, type PDFPage, type PDFFont } from 'pdf-lib';
import { AppError } from '../lib/errors';
import { ensureDir, safeSegment } from './fs';
import type { CertificateFieldConfig } from './certificate-templates';
import { getPdfjsStandardFontDataUrl, loadPdfJs } from './pdf-runtime';
import { renderTemplateString } from './template-placeholders';

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
    return renderTemplateString(field.text, context);
  }

  return getFieldValue(context, field.field);
}

function getFieldPageNumber(field: CertificateFieldConfig) {
  return field.pageNumber && field.pageNumber > 0 ? field.pageNumber : 1;
}

function getFieldsForPage(fields: CertificateFieldConfig[], pageNumber: number) {
  return fields.filter((field) => getFieldPageNumber(field) === pageNumber);
}

function sampleBackgroundColor(
  ctx: any,
  rect: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number
) {
  const sampleThickness = Math.max(1, Math.min(4, Math.round(Math.min(rect.width, rect.height) * 0.15)));
  const regions = [
    { x: rect.x, y: rect.y - sampleThickness, width: rect.width, height: sampleThickness },
    { x: rect.x, y: rect.y + rect.height, width: rect.width, height: sampleThickness },
    { x: rect.x - sampleThickness, y: rect.y, width: sampleThickness, height: rect.height },
    { x: rect.x + rect.width, y: rect.y, width: sampleThickness, height: rect.height }
  ];

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (const region of regions) {
    const x = Math.max(0, Math.floor(region.x));
    const y = Math.max(0, Math.floor(region.y));
    const width = Math.max(0, Math.min(canvasWidth - x, Math.ceil(region.width)));
    const height = Math.max(0, Math.min(canvasHeight - y, Math.ceil(region.height)));

    if (!width || !height) {
      continue;
    }

    const imageData = ctx.getImageData(x, y, width, height).data;
    for (let index = 0; index < imageData.length; index += 4) {
      const alpha = imageData[index + 3];
      if (!alpha) {
        continue;
      }
      r += imageData[index];
      g += imageData[index + 1];
      b += imageData[index + 2];
      count += 1;
    }
  }

  if (!count) {
    return 'rgb(255, 255, 255)';
  }

  return `rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`;
}

function measureTextWidth(ctx: any, text: string, fontFamily: string, fontSize: number) {
  const previousFont = ctx.font;
  ctx.font = `${fontSize}px ${fontFamily}`;
  const width = ctx.measureText(text).width;
  ctx.font = previousFont;
  return width;
}

function buildPdfTextOverlay(params: {
  fields: CertificateFieldConfig[];
  context: TemplateContext;
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
  canvasContext: any;
}) {
  const pieces = params.fields.map((field) => {
    const value = getRenderableText(field, params.context);
    if (!value) {
      return '';
    }

    const fieldX = field.x * params.scale;
    const fieldY = field.y * params.scale;
    const fieldWidth = field.width * params.scale;
    const fontSize = field.fontSize * params.scale;
    const lines = value.split('\n');
    const anchorX = field.align === 'center' ? fieldX + fieldWidth / 2 : field.align === 'right' ? fieldX + fieldWidth : fieldX;
    const anchor = field.align === 'center' ? 'middle' : field.align === 'right' ? 'end' : 'start';
    const lineHeight = fontSize * 1.2;
    const padX = Math.max(1, Math.round(fontSize * 0.08));
    const padY = Math.max(2, Math.round(fontSize * 0.12));
    const rects = lines
      .map((line, index) => {
        const lineWidth = Math.max(1, measureTextWidth(params.canvasContext, line, field.fontFamily, fontSize));
        const rectWidth = lineWidth + padX * 2;
        const rectHeight = Math.max(fontSize * 1.15, fontSize + padY * 2);
        const baselineY = fieldY + fontSize + index * lineHeight;
        const rectY = Math.max(0, baselineY - fontSize - padY);
        const rectX =
          field.align === 'center'
            ? Math.max(0, anchorX - rectWidth / 2)
            : field.align === 'right'
              ? Math.max(0, anchorX - rectWidth)
              : Math.max(0, anchorX - padX);
        const fill = sampleBackgroundColor(
          params.canvasContext,
          { x: rectX, y: rectY, width: rectWidth, height: rectHeight },
          params.canvasWidth,
          params.canvasHeight
        );
        return `<rect x="${rectX}" y="${rectY}" width="${rectWidth}" height="${rectHeight}" fill="${fill}" />`;
      })
      .join('\n');

    return `
      ${rects}
      <text
        x="${anchorX}"
        y="${fieldY + fontSize}"
        text-anchor="${anchor}"
        font-family="${escapeXml(field.fontFamily)}"
        font-size="${fontSize}"
        fill="${escapeXml(field.color)}"
        xml:space="preserve"
      >${lines
        .map(
          (line, index) =>
            `<tspan x="${anchorX}" dy="${index === 0 ? 0 : fontSize * 1.2}">${escapeXml(line)}</tspan>`
        )
        .join('')}</text>
    `;
  });

  return Buffer.from(`
    <svg width="${params.canvasWidth}" height="${params.canvasHeight}" viewBox="0 0 ${params.canvasWidth} ${params.canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      ${pieces.join('\n')}
    </svg>
  `);
}

async function renderPdfPageToPng(params: {
  backgroundPath: string;
  pageNumber: number;
  fields: CertificateFieldConfig[];
  context: TemplateContext;
}) {
  const pdfjs = await loadPdfJs();
  const pdfBytes = await fs.readFile(params.backgroundPath);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    disableWorker: true,
    isEvalSupported: false,
    useWorkerFetch: false,
    standardFontDataUrl: getPdfjsStandardFontDataUrl()
  } as any);

  try {
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(params.pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d') as any;

    await page.render({
      canvas: canvas as any,
      canvasContext: context,
      viewport
    }).promise;

    const overlay = buildPdfTextOverlay({
      fields: params.fields,
      context: params.context,
      scale,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      canvasContext: context
    });

    const flattenedBuffer = await sharp(canvas.toBuffer('image/png'))
      .composite([{ input: overlay }])
      .png()
      .toBuffer();

    page.cleanup();

    return {
      buffer: flattenedBuffer,
      width: Math.round(baseViewport.width),
      height: Math.round(baseViewport.height)
    };
  } finally {
    await loadingTask.destroy?.();
  }
}

function drawPdfFieldMask(params: {
  page: PDFPage;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}) {
  const paddingX = Math.max(4, Math.round(params.fontSize * 0.22));
  const paddingY = Math.max(4, Math.round(params.fontSize * 0.18));
  params.page.drawRectangle({
    x: Math.max(0, params.x - paddingX),
    y: Math.max(0, params.y - paddingY),
    width: Math.max(1, params.width + paddingX * 2),
    height: Math.max(1, params.height + paddingY * 2),
    color: rgb(1, 1, 1),
    opacity: 1
  });
}

function buildTextOverlay(params: {
  fields: CertificateFieldConfig[];
  context: TemplateContext;
  width: number;
  height: number;
}) {
  const pieces = params.fields.map((field) => {
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

function parseHexColor(color: string) {
  const value = color.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(value)) {
    return rgb(
      parseInt(value.slice(0, 2), 16) / 255,
      parseInt(value.slice(2, 4), 16) / 255,
      parseInt(value.slice(4, 6), 16) / 255
    );
  }
  return rgb(0.07, 0.07, 0.07);
}

function getPdfFontName(fontFamily: string) {
  switch (fontFamily.trim().toLowerCase()) {
    case 'times new roman':
      return StandardFonts.TimesRoman;
    case 'courier new':
      return StandardFonts.Courier;
    case 'arial':
    case 'poppins':
    default:
      return StandardFonts.Helvetica;
  }
}

async function drawPdfFieldsOnPage(params: {
  pdfDoc: PDFDocumentType;
  page: PDFPage;
  fields: CertificateFieldConfig[];
  context: TemplateContext;
  width: number;
  height: number;
}) {
  const fontCache = new Map<string, PDFFont>();
  const getFont = async (fontFamily: string) => {
    const fontName = getPdfFontName(fontFamily);
    const cacheKey = fontName;
    const cached = fontCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const loaded = await params.pdfDoc.embedFont(fontName);
    fontCache.set(cacheKey, loaded);
    return loaded;
  };

  for (const field of params.fields) {
    const value = getRenderableText(field, params.context);
    if (!value) {
      continue;
    }

    const font = await getFont(field.fontFamily);
    const fontSize = field.fontSize;
    const lineHeight = fontSize * 1.2;
    const lines = value.split('\n');
    const baseY = params.height - field.y - fontSize;
    const color = parseHexColor(field.color);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      let x = field.x;
      if (field.align === 'center') {
        x = field.x + field.width / 2 - textWidth / 2;
      } else if (field.align === 'right') {
        x = field.x + field.width - textWidth;
      }

      drawPdfFieldMask({
        page: params.page,
        x: field.x,
        y: baseY - index * lineHeight,
        width: field.width,
        height: fontSize,
        fontSize
      });

      params.page.drawText(line, {
        x,
        y: baseY - index * lineHeight,
        size: fontSize,
        font,
        color
      });
    }
  }
}

async function renderPdfBackground(params: {
  backgroundPath: string;
  fields: CertificateFieldConfig[];
  context: TemplateContext;
  outputDir: string;
  baseName: string;
}) {
  await ensureDir(params.outputDir);
  const pdfPath = getOutputPath(params.outputDir, params.baseName, '.pdf');
  const pdfjs = await loadPdfJs();
  const pdfBytes = await fs.readFile(params.backgroundPath);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    disableWorker: true,
    isEvalSupported: false,
    useWorkerFetch: false,
    standardFontDataUrl: getPdfjsStandardFontDataUrl()
  } as any);

  try {
    const sourceDoc = await loadingTask.promise;
    const outputDoc = await PDFDocument.create();
    let outputWidth = 0;
    let outputHeight = 0;

    for (let pageNumber = 1; pageNumber <= sourceDoc.numPages; pageNumber += 1) {
      const rendered = await renderPdfPageToPng({
        backgroundPath: params.backgroundPath,
        pageNumber,
        fields: getFieldsForPage(params.fields, pageNumber),
        context: params.context
      });

      outputWidth = rendered.width;
      outputHeight = rendered.height;
      const outputPage = outputDoc.addPage([rendered.width, rendered.height]);
      const embedded = await outputDoc.embedPng(rendered.buffer);
      outputPage.drawImage(embedded, {
        x: 0,
        y: 0,
        width: rendered.width,
        height: rendered.height
      });
    }

    const outputPdf = await outputDoc.save();
    await fs.writeFile(pdfPath, outputPdf);

    return {
      pngPath: pdfPath,
      pdfPath,
      width: outputWidth,
      height: outputHeight
    };
  } finally {
    await loadingTask.destroy?.();
  }
}

export async function renderCertificatePdf(params: {
  backgroundPath: string;
  fields: CertificateFieldConfig[];
  context: TemplateContext;
  outputDir: string;
  baseName: string;
}) {
  if (path.extname(params.backgroundPath).toLowerCase() === '.pdf') {
    return renderPdfBackground(params);
  }

  await ensureDir(params.outputDir);

  const background = sharp(params.backgroundPath, path.extname(params.backgroundPath).toLowerCase() === '.pdf' ? { density: 200 } : undefined);
  const metadata = await background.metadata();
  const width = metadata.width ?? 1200;
  const height = metadata.height ?? 800;
  const overlay = buildTextOverlay({
    fields: params.fields,
    context: params.context,
    width,
    height
  });

  const pngBuffer = await background
    .composite([{ input: overlay }])
    .png()
    .toBuffer();

  const pngPath = getOutputPath(params.outputDir, params.baseName, '.png');
  const pdfPath = getOutputPath(params.outputDir, params.baseName, '.pdf');
  await fs.writeFile(pngPath, pngBuffer);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([width, height]);
  const embedded = await pdfDoc.embedPng(pngBuffer);
  page.drawImage(embedded, {
    x: 0,
    y: 0,
    width,
    height
  });

  const outputPdf = await pdfDoc.save();
  await fs.writeFile(pdfPath, outputPdf);

  return {
    pngPath,
    pdfPath,
    width,
    height
  };
}

export async function renderCertificatePdfPreview(params: {
  backgroundPath: string;
  fields: CertificateFieldConfig[];
  context: TemplateContext;
}) {
  if (path.extname(params.backgroundPath).toLowerCase() === '.pdf') {
    const pdfjs = await loadPdfJs();
    const pdfBytes = await fs.readFile(params.backgroundPath);
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBytes),
      disableWorker: true,
      isEvalSupported: false,
      useWorkerFetch: false,
      standardFontDataUrl: getPdfjsStandardFontDataUrl()
    } as any);

    try {
      const sourceDoc = await loadingTask.promise;
      const outputDoc = await PDFDocument.create();

      for (let pageNumber = 1; pageNumber <= sourceDoc.numPages; pageNumber += 1) {
        const rendered = await renderPdfPageToPng({
          backgroundPath: params.backgroundPath,
          pageNumber,
          fields: getFieldsForPage(params.fields, pageNumber),
          context: params.context
        });

        const outputPage = outputDoc.addPage([rendered.width, rendered.height]);
        const embedded = await outputDoc.embedPng(rendered.buffer);
        outputPage.drawImage(embedded, {
          x: 0,
          y: 0,
          width: rendered.width,
          height: rendered.height
        });
      }

      return Buffer.from(await outputDoc.save());
    } finally {
      await loadingTask.destroy?.();
    }
  }

  const background = sharp(params.backgroundPath, path.extname(params.backgroundPath).toLowerCase() === '.pdf' ? { density: 200 } : undefined);
  const metadata = await background.metadata();
  const width = metadata.width ?? 1200;
  const height = metadata.height ?? 800;
  const overlay = buildTextOverlay({
    fields: params.fields,
    context: params.context,
    width,
    height
  });

  return background
    .composite([{ input: overlay }])
    .png()
    .toBuffer();
}

export async function renderCertificateBackgroundPreview(backgroundPath: string) {
  const ext = path.extname(backgroundPath).toLowerCase();
  if (ext !== '.pdf') {
    const background = sharp(backgroundPath);
    return background.png().toBuffer();
  }

  const pdfjs = await loadPdfJs();
  const pdfBytes = await fs.readFile(backgroundPath);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    disableWorker: true,
    isEvalSupported: false,
    useWorkerFetch: false,
    standardFontDataUrl: getPdfjsStandardFontDataUrl()
  } as any);
  const pdfDoc = await loadingTask.promise;

  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d') as any;

  await page.render({
    canvas: canvas as any,
    canvasContext: context,
    viewport
  }).promise;

  page.cleanup();
  await loadingTask.destroy?.();

  return canvas.toBuffer('image/png');
}

async function renderPdfBackgroundPagePreview(params: {
  backgroundPath: string;
  pageNumber: number;
}) {
  const pdfjs = await loadPdfJs();
  const pdfBytes = await fs.readFile(params.backgroundPath);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    disableWorker: true,
    isEvalSupported: false,
    useWorkerFetch: false,
    standardFontDataUrl: getPdfjsStandardFontDataUrl()
  } as any);

  try {
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(params.pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d') as any;

    await page.render({
      canvas: canvas as any,
      canvasContext: context,
      viewport
    }).promise;

    page.cleanup();

    return {
      buffer: canvas.toBuffer('image/png'),
      width: Math.round(baseViewport.width),
      height: Math.round(baseViewport.height)
    };
  } finally {
    await loadingTask.destroy?.();
  }
}

export async function renderCertificateBackgroundPreviewPage(backgroundPath: string, pageNumber: number) {
  const ext = path.extname(backgroundPath).toLowerCase();
  if (ext !== '.pdf') {
    const background = sharp(backgroundPath);
    const metadata = await background.metadata();
    return {
      buffer: await background.png().toBuffer(),
      width: metadata.width ?? 1200,
      height: metadata.height ?? 800
    };
  }

  return renderPdfBackgroundPagePreview({ backgroundPath, pageNumber });
}

export async function listCertificateBackgroundPreviewPages(backgroundPath: string) {
  const ext = path.extname(backgroundPath).toLowerCase();
  if (ext !== '.pdf') {
    const metadata = await sharp(backgroundPath).metadata();
    return [
      {
        pageNumber: 1,
        width: metadata.width ?? 1200,
        height: metadata.height ?? 800
      }
    ];
  }

  const pdfjs = await loadPdfJs();
  const pdfBytes = await fs.readFile(backgroundPath);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    disableWorker: true,
    isEvalSupported: false,
    useWorkerFetch: false,
    standardFontDataUrl: getPdfjsStandardFontDataUrl()
  } as any);

  try {
    const pdfDoc = await loadingTask.promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      pages.push({
        pageNumber,
        width: Math.round(viewport.width),
        height: Math.round(viewport.height)
      });
      page.cleanup();
    }
    return pages;
  } finally {
    await loadingTask.destroy?.();
  }
}

export function normalizeCertificateFieldConfig(fields: CertificateFieldConfig[]) {
  return fields.map((field) => ({
    field: field.field,
    ...(field.pageNumber !== undefined ? { pageNumber: field.pageNumber } : {}),
    x: field.x,
    y: field.y,
    width: field.width,
    fontSize: field.fontSize,
    fontFamily: field.fontFamily,
    color: field.color,
    align: field.align,
    text: field.text
  }));
}
