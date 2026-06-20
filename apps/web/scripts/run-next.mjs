import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Missing Next command.');
  process.exit(1);
}

const tempTarget = path.join(os.tmpdir(), 'certiflow-next-web');
const nextDistDir = path.relative(process.cwd(), tempTarget);
const env = {
  ...process.env
};
const rootNodeModules = path.resolve(process.cwd(), '../../node_modules');
env.NODE_PATH = [rootNodeModules, env.NODE_PATH].filter(Boolean).join(path.delimiter);
delete env.NEXT_DIST_DIR;

if (command === 'dev') {
  env.NEXT_DIST_DIR = nextDistDir;
  try {
    fs.rmSync(path.resolve(process.cwd(), nextDistDir), { recursive: true, force: true });
  } catch {
    // Ignore cleanup failures; Next can recreate the directory.
  }
}

const nextBin = path.resolve(process.cwd(), '../../node_modules/next/dist/bin/next');
const child = spawn(process.execPath, [nextBin, command, ...args], {
  stdio: 'inherit',
  env
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
