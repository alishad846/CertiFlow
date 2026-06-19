import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';

export const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

connection.on('error', (err: any) => {
  if (err.code === 'ECONNREFUSED') {
    console.warn(`Redis connection failed to ${env.REDIS_URL}. Ensure Redis is running.`);
  } else {
    console.error('Redis connection error:', err.message);
  }
});

export const batchQueue = new Queue('certiflow-batches', {
  connection
});

batchQueue.on('error', (err) => {
  // Gracefully handled; connection level logs the failure warning
});

export const emailQueue = new Queue('certiflow-emails', {
  connection
});

emailQueue.on('error', (err) => {
  // Gracefully handled; connection level logs the failure warning
});
