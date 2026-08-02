// Copies non-TypeScript runtime assets from src/ into dist/ after `tsc`.
//
// tsc only emits .js/.d.ts, so fonts, images, stock-template PNGs and JSON
// manifests under src/data never reach dist/. At runtime the compiled code
// resolves these relative to __dirname (dist/...), which means they exist when
// running from source via tsx (dev) but are MISSING in a built/Docker deploy.
// This script mirrors every non-.ts/.tsx file from src/ into dist/ so the
// production build behaves exactly like dev.
import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(here, '..', 'src');
const distRoot = path.join(here, '..', 'dist');

const isCode = (name) => name.endsWith('.ts') || name.endsWith('.tsx');

async function copyAssets(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Never ship test fixtures into the runtime bundle.
      if (entry.name === '__tests__') continue;
      await copyAssets(srcPath);
      continue;
    }
    if (isCode(entry.name)) continue;
    const relative = path.relative(srcRoot, srcPath);
    const destPath = path.join(distRoot, relative);
    await mkdir(path.dirname(destPath), { recursive: true });
    await cp(srcPath, destPath);
  }
}

async function main() {
  if (!existsSync(srcRoot)) {
    throw new Error(`copy-assets: source directory not found at ${srcRoot}`);
  }
  await stat(srcRoot);
  await copyAssets(srcRoot);
  console.log('copy-assets: mirrored non-TS assets from src/ into dist/');
}

main().catch((error) => {
  console.error('copy-assets failed:', error);
  process.exit(1);
});
