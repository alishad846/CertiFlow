import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';

export const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

export const batchQueue = new Queue('certiflow-batches', {
  connection
});

export const emailQueue = new Queue('certiflow-emails', {
  connection
});
