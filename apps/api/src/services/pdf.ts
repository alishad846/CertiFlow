import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { ensureDir } from './fs';
import { AppError } from '../lib/errors';
import { env } from '../config/env';

const execFileAsync = promisify(execFile);

export async function convertDocxToPdf(docxPath: string, outputDir: string) {
  await ensureDir(outputDir);

  try {
    await execFileAsync(env.SOFFICE_PATH, [
      '--headless',
      '--convert-to',
      'pdf',
      '--outdir',
      outputDir,
      docxPath
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'LibreOffice conversion failed';
    throw new AppError(`PDF conversion failed: ${message}`, 500);
  }

  return path.join(outputDir, `${path.parse(docxPath).name}.pdf`);
}
