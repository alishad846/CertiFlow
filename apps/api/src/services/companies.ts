import { pool } from '../db/pool';

export type CompanyAccess = {
  id: string;
  name: string;
  status: 'active' | 'blocked';
  credits_remaining: number;
  can_create_batches: boolean;
  can_request_upi: boolean;
  can_view_reports: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
};

export async function getCompanyAccess(companyId: string) {
  const result = await pool.query<CompanyAccess>(
    `SELECT id, name, status, credits_remaining, can_create_batches, can_request_upi, can_view_reports,
            blocked_reason, blocked_at
     FROM companies
     WHERE id = $1`,
    [companyId]
  );

  return result.rows[0] ?? null;
}

