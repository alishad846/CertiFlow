import { Worker } from 'bullmq';
import { env } from './config/env';
import { connection } from './services/queue';
import { processBatchJob, processEmailJob } from './workers/processors';
import { bootstrapSuperAdmin } from './services/bootstrap';
import { ensureDir } from './services/fs';

async function main() {
  await ensureDir(env.UPLOAD_DIR);
  await bootstrapSuperAdmin();

  const batchWorker = new Worker('certiflow-batches', processBatchJob, {
    connection,
    concurrency: 1
  });

  const emailWorker = new Worker('certiflow-emails', processEmailJob, {
    connection,
    concurrency: 3
  });

  batchWorker.on('completed', (job) => {
    console.log(`Batch job completed: ${job.id}`);
  });
  batchWorker.on('failed', (job, error) => {
    console.error(`Batch job failed: ${job?.id}`, error);
  });
  batchWorker.on('error', (err) => {
    // Gracefully handled; connection level logs the failure warning
  });
  emailWorker.on('failed', (job, error) => {
    console.error(`Email job failed: ${job?.id}`, error);
  });
  emailWorker.on('error', (err) => {
    // Gracefully handled; connection level logs the failure warning
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
