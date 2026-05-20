import dns from 'node:dns';
import { Pool, type PoolClient } from 'pg';
import { env } from '../config/env';

dns.setDefaultResultOrder('ipv4first');
const originalLookup = dns.lookup.bind(dns);

dns.lookup = ((hostname: string, options: unknown, callback?: unknown) => {
  if (typeof options === 'function') {
    return originalLookup(hostname, { family: 4 }, options as never);
  }

  if (typeof callback === 'function') {
    const lookupOptions =
      options && typeof options === 'object'
        ? { ...(options as Record<string, unknown>), family: 4 }
        : { family: 4 };

    return originalLookup(hostname, lookupOptions, callback as never);
  }

  return originalLookup(hostname, options as never);
}) as typeof dns.lookup;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  ssl:
    env.NODE_ENV === 'production'
      ? {
          rejectUnauthorized: false
        }
      : undefined
});

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
