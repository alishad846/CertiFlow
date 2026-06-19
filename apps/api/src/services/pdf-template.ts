import fs from 'fs/promises';
import path from 'path';
import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import { AppError } from '../lib/errors';
import { ensureDir } from './fs';
import { getPdfjsStandardFontDataUrl, loadPdfJs } from './pdf-runtime';
import { renderTemplateString } from './template-placeholders';

type TemplateData = Record<string, unknown>;

type RenderedTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
};

type TextLine = {
  items: RenderedTextItem[];
  baselineY: number;
  fontSize: number;
};

function getItemFontSize(item: RenderedTextItem) {
  return Math.max(8, Math.round(item.fontSize || 12));
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

function drawResolvedText(params: {
  ctx: any;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  canvasWidth: number;
  canvasHeight: number;
  coverWholeRow?: boolean;
}) {
  const paddingX = Math.max(4, Math.round(params.fontSize * 0.24));
  const paddingY = Math.max(6, Math.round(params.fontSize * 0.4));
  const fontFamily = 'Arial, Helvetica, sans-serif';
  let fontSize = getItemFontSize(params);
  const minFontSize = 6;
  const maxWidth = Math.max(1, params.width - paddingX * 2);
  const maskX = params.coverWholeRow ? 0 : Math.max(0, params.x - paddingX);
  const maskY = Math.max(0, params.y - params.height - paddingY);
  const maskWidth = params.coverWholeRow ? params.canvasWidth : Math.max(1, params.width + paddingX * 2);
  const maskHeight = Math.max(params.height + paddingY * 2, Math.round(fontSize * 2.1));

  params.ctx.save();
  params.ctx.font = `${fontSize}px ${fontFamily}`;
  while (fontSize > minFontSize && params.ctx.measureText(params.text).width > maxWidth) {
    fontSize -= 0.5;
    params.ctx.font = `${fontSize}px ${fontFamily}`;
  }

  params.ctx.fillStyle = '#ffffff';
  params.ctx.fillRect(maskX, maskY, maskWidth, maskHeight);

  params.ctx.font = `${fontSize}px ${fontFamily}`;
  params.ctx.fillStyle = '#111827';
  params.ctx.textBaseline = 'alphabetic';
  params.ctx.fillText(params.text, params.x + paddingX, params.y);
  params.ctx.restore();
}

function sortTextItems(items: RenderedTextItem[]) {
  return [...items].sort((left, right) => {
    if (Math.abs(left.y - right.y) > 0.5) {
      return left.y - right.y;
    }
    return left.x - right.x;
  });
}

function groupTextItemsIntoLines(items: RenderedTextItem[]) {
  const sortedItems = sortTextItems(items);
  const lines: TextLine[] = [];
  for (const item of sortedItems) {
    const currentLine = lines[lines.length - 1];
    if (!currentLine) {
      lines.push({
        items: [item],
        baselineY: item.y,
        fontSize: item.fontSize
      });
      continue;
    }

    const tolerance = Math.max(4, Math.min(currentLine.fontSize, item.fontSize) * 0.8);
    if (Math.abs(item.y - currentLine.baselineY) <= tolerance) {
      currentLine.items.push(item);
      currentLine.fontSize = Math.max(currentLine.fontSize, item.fontSize);
      continue;
    }

    lines.push({
      items: [item],
      baselineY: item.y,
      fontSize: item.fontSize
    });
  }

  for (const line of lines) {
    line.items.sort((left, right) => left.x - right.x);
  }

  return lines;
}

function formatHyphenatedDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}-${month}-${year}`;
}

async function renderPdfPage(params: {
  page: any;
  pdfjs: Awaited<ReturnType<typeof loadPdfJs>>;
  data: TemplateData;
  scale: number;
}) {
  const { page, pdfjs, data, scale } = params;
  const baseViewport = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');

  await page.render({
    canvas: canvas as any,
    canvasContext: ctx as any,
    viewport
  }).promise;

  const textContent = await page.getTextContent({ disableNormalization: false });
  const renderedItems: RenderedTextItem[] = [];

  for (const item of textContent.items) {
    if (!('str' in item) || typeof item.str !== 'string' || !item.str.length) {
      continue;
    }

    const tx = pdfjs.Util.transform(viewport.transform, item.transform as any);
    const fontSize = Math.max(8, Math.round(Math.max(Math.hypot(tx[2], tx[3]), (item.height || 0) * scale, 10)));
    const renderedItem: RenderedTextItem = {
      text: item.str,
      x: tx[4],
      y: tx[5],
      width: Math.max(item.width * scale, 0),
      height: Math.max((item.height || 0) * scale, fontSize * 1.15),
      fontSize
    };
    renderedItems.push(renderedItem);
  }

  const lines = groupTextItemsIntoLines(renderedItems);
  for (const line of lines) {
    const lineText = line.items.map((item) => item.text).join('');
    if (!lineText || !lineText.includes('{{')) {
      const datePrefixMatch = lineText.match(/^(\s*Date\s*:\s*)(.+)$/i);
      if (!datePrefixMatch) {
        continue;
      }

      const resolvedDateLine = `${datePrefixMatch[1]}${formatHyphenatedDate(new Date())}`;
      const boxX = Math.max(0, Math.min(...line.items.map((item) => item.x)));
      const boxRight = Math.max(...line.items.map((item) => item.x + item.width));
      const boxWidth = Math.max(1, boxRight - boxX);
      const boxHeight = Math.max(...line.items.map((item) => item.height));
      const boxY = line.baselineY;

      drawResolvedText({
        ctx,
        text: resolvedDateLine,
        x: boxX,
        y: boxY,
        width: boxWidth,
        height: boxHeight,
        fontSize: line.fontSize,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        coverWholeRow: true
      });
      continue;
    }

    const resolvedLine = renderTemplateString(lineText, data);
    const boxX = Math.max(0, Math.min(...line.items.map((item) => item.x)));
    const boxRight = Math.max(...line.items.map((item) => item.x + item.width));
    const boxWidth = Math.max(1, boxRight - boxX);
    const boxHeight = Math.max(...line.items.map((item) => item.height));
    const boxY = line.baselineY;

    drawResolvedText({
      ctx,
      text: resolvedLine,
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
      fontSize: line.fontSize,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      coverWholeRow: true
    });
  }

  return {
    canvas,
    width: baseViewport.width,
    height: baseViewport.height
  };
}

export async function renderPdfTemplate(params: {
  templatePath: string;
  outputPath: string;
  data: TemplateData;
}) {
  const pdfjs = await loadPdfJs();
  const pdfBytes = await fs.readFile(params.templatePath);
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
      const page = await sourceDoc.getPage(pageNumber);
      const rendered = await renderPdfPage({
        page: page as any,
        pdfjs,
        data: params.data,
        scale: 1.75
      });

      const pngBuffer = rendered.canvas.toBuffer('image/png');
      const pdfPage = outputDoc.addPage([rendered.width, rendered.height]);
      const embedded = await outputDoc.embedPng(pngBuffer);
      pdfPage.drawImage(embedded, {
        x: 0,
        y: 0,
        width: rendered.width,
        height: rendered.height
      });

      page.cleanup();
    }

    const outputPdf = await outputDoc.save();
    await ensureDir(path.dirname(params.outputPath));
    await fs.writeFile(params.outputPath, outputPdf);
    return params.outputPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to render PDF template';
    throw new AppError(`PDF template error: ${message}`, 400);
  } finally {
    await loadingTask.destroy?.();
  }
}
