import type { PoolClient } from 'pg';
import { AppError } from '../lib/errors';

export async function debitCredits(client: PoolClient, companyId: string, amount: number, referenceId: string) {
  const companyResult = await client.query<{ credits_remaining: number }>(
    'SELECT credits_remaining FROM companies WHERE id = $1 FOR UPDATE',
    [companyId]
  );

  const currentCredits = companyResult.rows[0]?.credits_remaining ?? 0;
  if (currentCredits < amount) {
    throw new AppError('Insufficient credits for this batch', 400);
  }

  await client.query('UPDATE companies SET credits_remaining = credits_remaining - $1 WHERE id = $2', [
    amount,
    companyId
  ]);

  await client.query(
    'INSERT INTO credit_ledger (company_id, change_amount, reason, reference_id) VALUES ($1, $2, $3, $4)',
    [companyId, -amount, 'batch_generation', referenceId]
  );
}
