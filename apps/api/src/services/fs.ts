import { mkdir, access } from 'fs/promises';
import path from 'path';

export async function ensureDir(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

export function safeSegment(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

export async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function buildCompanyPath(baseDir: string, companyId: string) {
  return path.join(baseDir, `company-${companyId}`);
}
