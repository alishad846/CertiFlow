import { pool } from '../db/pool';
import { bootstrapSuperAdmin } from '../services/bootstrap';
import { migrateDatabaseSchema } from '../services/migrate';

async function resetDatabase() {
  console.log('Running schema migrations...');
  await migrateDatabaseSchema();

  console.log('Resetting database tables...');
  await pool.query(`
    TRUNCATE TABLE 
      email_logs, 
      documents, 
      batch_attachments, 
      batch_templates, 
      certificate_templates, 
      batches, 
      uploads, 
      credit_ledger, 
      upi_payments, 
      company_discounts, 
      password_resets, 
      users, 
      companies 
    CASCADE;
  `);
  console.log('All saved login credentials and company records have been deleted.');
  
  console.log('Re-seeding default super admin account...');
  await bootstrapSuperAdmin();
  console.log('Super admin re-seeded successfully.');
  
  await pool.end();
}

resetDatabase().catch((err) => {
  console.error('Failed to reset database:', err);
  process.exit(1);
});
