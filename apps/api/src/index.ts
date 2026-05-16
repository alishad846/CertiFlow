import { createApp } from './app';
import { env } from './config/env';
import { bootstrapSuperAdmin } from './services/bootstrap';
import { ensureDir } from './services/fs';
import { AppError } from './lib/errors';

async function main() {
  await ensureDir(env.UPLOAD_DIR);
  await bootstrapSuperAdmin();

  const app = createApp();
  const port = Number(process.env.PORT ?? env.API_PORT);
  app.listen(port, '0.0.0.0', () => {
    console.log(`API listening on http://0.0.0.0:${port}`);
  });
}

main().catch((error) => {
  const message = error instanceof AppError ? error.message : error;
  console.error(message);
  process.exit(1);
});
