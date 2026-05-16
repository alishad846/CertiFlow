import fs from 'fs/promises';
import path from 'path';
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

export async function renderCertificatePdf(params: {
  backgroundPath: string;
  fields: CertificateFieldConfig[];
  context: TemplateContext;
  outputDir: string;
  baseName: string;
}) {
  await ensureDir(params.outputDir);

  const background = sharp(params.backgroundPath);
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
  const background = sharp(params.backgroundPath);
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
    text: field.text
  }));
}
