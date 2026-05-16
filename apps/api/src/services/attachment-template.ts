import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { AppError } from '../lib/errors';
import { ensureDir, safeSegment } from './fs';

type TemplateData = Record<string, unknown>;

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTemplateText(template: string, data: TemplateData) {
  return template
    .replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => {
      const value = data[key];
      if (value === null || value === undefined) {
        return '';
      }
      return String(value);
    })
    .trim();
}

function wrapText(text: string, maxCharacters: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [''];
  }

  const lines: string[] = [];
  let currentLine = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const word = words[index];
    if ((currentLine + ' ' + word).length > maxCharacters) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine += ` ${word}`;
    }
  }

  lines.push(currentLine);
  return lines;
}

function buildOutputPath(outputDir: string, originalName: string, recipientName: string) {
  const ext = path.extname(originalName) || '.bin';
  const base = safeSegment(path.basename(originalName, ext)) || 'attachment';
  const recipient = safeSegment(recipientName || 'recipient');
  return path.join(outputDir, `${base}-${recipient}${ext}`);
}

async function renderImageAttachment(params: {
  templatePath: string;
  outputPath: string;
  data: TemplateData;
  overlayTemplate: string;
}) {
  const image = sharp(params.templatePath);
  const metadata = await image.metadata();
  const width = metadata.width ?? 1200;
  const height = metadata.height ?? 800;
  const text = renderTemplateText(params.overlayTemplate, params.data);
  const fontSize = Math.max(18, Math.min(48, Math.round(width / 34)));
  const margin = Math.max(24, Math.round(width * 0.05));
  const maxCharacters = Math.max(18, Math.floor((width - margin * 2) / (fontSize * 0.55)));
  const lines = wrapText(text, maxCharacters);
  const lineHeight = Math.round(fontSize * 1.35);
  const boxHeight = Math.min(Math.round(height * 0.3), lines.length * lineHeight + margin);
  const boxY = Math.max(0, height - boxHeight - margin);
  const centerX = Math.round(width / 2);

  const svg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${margin}" y="${boxY}" width="${width - margin * 2}" height="${boxHeight}" rx="${Math.max(12, Math.round(fontSize * 0.35))}" fill="#ffffff" fill-opacity="0.84"/>
      <text x="${centerX}" y="${boxY + Math.round(fontSize * 1.2)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" fill="#0f172a">
        ${lines
          .map((line, index) => `<tspan x="${centerX}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
          .join('')}
      </text>
    </svg>
  `);

  await image.composite([{ input: svg }]).toFile(params.outputPath);
}

async function renderPdfAttachment(params: {
  templatePath: string;
  outputPath: string;
  data: TemplateData;
  overlayTemplate: string;
}) {
  const pdfBytes = await fs.readFile(params.templatePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const text = renderTemplateText(params.overlayTemplate, params.data);

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    const fontSize = Math.max(14, Math.min(28, Math.round(width / 36)));
    const margin = Math.max(24, Math.round(width * 0.05));
    const maxCharacters = Math.max(18, Math.floor((width - margin * 2) / (fontSize * 0.6)));
    const lines = wrapText(text, maxCharacters);
    const lineHeight = Math.round(fontSize * 1.35);
    const boxHeight = Math.min(Math.round(height * 0.28), lines.length * lineHeight + margin);
    const boxY = margin;

    page.drawRectangle({
      x: margin,
      y: boxY,
      width: width - margin * 2,
      height: boxHeight,
      color: rgb(1, 1, 1),
      opacity: 0.84,
      borderColor: rgb(0.86, 0.89, 0.94),
      borderWidth: 1
    });

    let cursorY = boxY + boxHeight - Math.round(fontSize * 1.25);
    for (const line of lines) {
      page.drawText(line, {
        x: margin + 16,
        y: cursorY,
        size: fontSize,
        font,
        color: rgb(0.08, 0.11, 0.18),
        maxWidth: width - margin * 2 - 32
      });
      cursorY -= lineHeight;
    }
  }

  const outputPdf = await pdfDoc.save();
  await fs.writeFile(params.outputPath, outputPdf);
}

export async function renderPersonalizedAttachment(params: {
  templatePath: string;
  originalName: string;
  outputDir: string;
  data: TemplateData;
  overlayTemplate?: string;
}) {
  await ensureDir(params.outputDir);
  const outputPath = buildOutputPath(params.outputDir, params.originalName, String(params.data.name ?? 'recipient'));
  const ext = path.extname(params.originalName).toLowerCase();
  const hasOverlay = Boolean(params.overlayTemplate?.trim());

  if (!hasOverlay) {
    await fs.copyFile(params.templatePath, outputPath);
    return {
      path: outputPath,
      filename: path.basename(outputPath)
    };
  }

  try {
    if (ext === '.pdf') {
      await renderPdfAttachment({
        templatePath: params.templatePath,
        outputPath,
        data: params.data,
        overlayTemplate: params.overlayTemplate ?? ''
      });
    } else if (['.png', '.jpg', '.jpeg'].includes(ext)) {
      await renderImageAttachment({
        templatePath: params.templatePath,
        outputPath,
        data: params.data,
        overlayTemplate: params.overlayTemplate ?? ''
      });
    } else {
      await fs.copyFile(params.templatePath, outputPath);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to render attachment template';
    throw new AppError(`Attachment template error: ${message}`, 400);
  }

  return {
    path: outputPath,
    filename: path.basename(outputPath)
  };
}
