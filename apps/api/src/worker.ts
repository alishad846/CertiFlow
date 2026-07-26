import { Worker } from 'bullmq';
import { env } from './config/env';
import { connection } from './services/queue';
import { processBatchJob, processEmailJob } from './workers/processors';
import { bootstrapSuperAdmin } from './services/bootstrap';
import { ensureDir } from './services/fs';

async function main() {
  await ensureDir(env.UPLOAD_DIR);
  await ensureDir(env.CERT_STORE_DIR);
  await bootstrapSuperAdmin();

  // Heavy PDF generation runs here (separate process) so it never blocks the
  // API/web tier. Concurrency is env-tunable per deploy; email sending is
  // additionally rate-limited to protect SMTP and smooth out spikes.
  const batchWorker = new Worker('certiflow-batches', processBatchJob, {
    connection,
    concurrency: env.BATCH_WORKER_CONCURRENCY
  });

  const emailWorker = new Worker('certiflow-emails', processEmailJob, {
    connection,
    concurrency: env.EMAIL_WORKER_CONCURRENCY,
    limiter: {
      max: env.EMAIL_RATE_MAX,
      duration: env.EMAIL_RATE_DURATION_MS
    }
  });

  batchWorker.on('completed', (job) => {
    console.log(`Batch job completed: ${job.id}`);
  });
  batchWorker.on('failed', (job, error) => {
    console.error(`Batch job failed: ${job?.id}`, error);
  });
  batchWorker.on('error', () => {
    // Gracefully handled; connection level logs the failure warning
  });
  emailWorker.on('failed', (job, error) => {
    console.error(`Email job failed: ${job?.id}`, error);
  });
  emailWorker.on('error', () => {
    // Gracefully handled; connection level logs the failure warning
  });

  // Graceful shutdown: finish in-flight jobs, then exit cleanly.
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, draining workers...`);
    await Promise.allSettled([batchWorker.close(), emailWorker.close()]);
    await connection.quit().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
