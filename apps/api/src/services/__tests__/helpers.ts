import { randomUUID } from 'crypto';
import { afterAll } from 'vitest';
import { pool } from '../../db/pool';

// Reusable DB-fixture harness for apps/api service/route tests.
//
// Rows are inserted directly via SQL (not through service functions) so
// fixtures stay independent of the behaviour under test. Column lists were
// read from the authoritative schema in `apps/api/src/services/migrate.ts`
// (and the base `docker/postgres-init/001_schema.sql`) to make sure every
// NOT NULL column is populated.
//
// Every company created by `seedTemplateFixture` is tracked and deleted
// (cascading to uploads/certificate_templates via ON DELETE CASCADE) in a
// single `afterAll`. Seeded users are tracked and deleted explicitly too:
// `users.company_id` is ON DELETE SET NULL (not CASCADE), so deleting the
// company alone would orphan the user row instead of removing it.
// `afterAll` also closes the shared `pool` so `vitest run` exits cleanly
// instead of hanging on an open Postgres connection.

const createdCompanyIds: string[] = [];
const createdUserIds: string[] = [];

export async function seedTemplateFixture() {
  const suffix = randomUUID();

  const companyResult = await pool.query<{ id: string }>(
    `INSERT INTO companies (name) VALUES ($1) RETURNING id`,
    [`Test Co ${suffix}`]
  );
  const companyId = companyResult.rows[0].id;
  createdCompanyIds.push(companyId);

  const userResult = await pool.query<{ id: string }>(
    `INSERT INTO users (company_id, name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'company_admin')
     RETURNING id`,
    [companyId, 'Test Admin', `test-${suffix}@example.com`, 'not-a-real-hash']
  );
  const userId = userResult.rows[0].id;
  createdUserIds.push(userId);

  const uploadResult = await pool.query<{ id: string }>(
    `INSERT INTO uploads (company_id, original_name, stored_path, kind, created_by)
     VALUES ($1, $2, $3, 'image', $4)
     RETURNING id`,
    [companyId, 'background.png', `/tmp/fixtures/${suffix}.png`, userId]
  );
  const uploadId = uploadResult.rows[0].id;

  const templateResult = await pool.query<{ id: string }>(
    `INSERT INTO certificate_templates (company_id, name, background_upload_id, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [companyId, 'Legacy Template', uploadId, userId]
  );
  const templateId = templateResult.rows[0].id;

  return { templateId, companyId, userId };
}

afterAll(async () => {
  if (createdCompanyIds.length) {
    await pool.query('DELETE FROM companies WHERE id = ANY($1::uuid[])', [createdCompanyIds]);
  }
  if (createdUserIds.length) {
    await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdUserIds]);
  }
  await pool.end();
});
