import bcrypt from 'bcryptjs';
import { pool } from '../db/pool';
import { env } from '../config/env';
import { migrateDatabaseSchema } from './migrate';

export async function bootstrapSuperAdmin() {
  await migrateDatabaseSchema();

  const passwordHash = await bcrypt.hash(env.SUPER_ADMIN_PASSWORD, 12);
  await pool.query(
    `INSERT INTO users (id, company_id, name, email, password_hash, role)
     VALUES (gen_random_uuid(), NULL, $1, $2, $3, 'super_admin')
     ON CONFLICT (email) DO NOTHING`,
    [env.SUPER_ADMIN_NAME, env.SUPER_ADMIN_EMAIL, passwordHash]
  );
}
