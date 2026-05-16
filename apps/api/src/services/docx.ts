import fs from 'fs/promises';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { AppError } from '../lib/errors';
import { ensureDir } from './fs';

export async function renderDocxTemplate(params: {
  templatePath: string;
  outputPath: string;
  data: Record<string, unknown>;
}) {
  const content = await fs.readFile(params.templatePath, 'binary');
  const zip = new PizZip(content);

  let doc;
  try {
    doc = new Docxtemplater(zip, {
      delimiters: {
        start: '{{',
        end: '}}'
      },
      paragraphLoop: true,
      linebreaks: true
    });
    doc.render(params.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to render DOCX template';
    throw new AppError(`DOCX template error: ${message}`, 400);
  }

  const buffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  await ensureDir(path.dirname(params.outputPath));
  await fs.writeFile(params.outputPath, buffer);
  return params.outputPath;
}
