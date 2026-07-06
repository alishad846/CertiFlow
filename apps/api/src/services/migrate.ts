import { withTransaction } from '../db/pool';
import { PRICING_PLANS as DEFAULT_PRICING_PLANS } from '@certiflow/shared';

const initializationStatements = [
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
       CREATE TYPE user_role AS ENUM ('super_admin', 'company_admin');
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upload_kind') THEN
       CREATE TYPE upload_kind AS ENUM ('excel', 'docx', 'image', 'pdf');
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_status') THEN
       CREATE TYPE company_status AS ENUM ('active', 'blocked');
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'batch_status') THEN
       CREATE TYPE batch_status AS ENUM ('queued', 'processing', 'sending', 'completed', 'completed_with_failures', 'failed');
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
       CREATE TYPE document_status AS ENUM ('pending', 'processing', 'sent', 'failed');
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_status') THEN
       CREATE TYPE email_status AS ENUM ('pending', 'sent', 'failed');
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upi_payment_status') THEN
       CREATE TYPE upi_payment_status AS ENUM ('pending', 'submitted', 'approved', 'rejected');
     END IF;
   END
   $$`
];

const migrationStatements = [
  `ALTER TABLE IF EXISTS users
     ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0`,
  `ALTER TABLE IF EXISTS companies
     ADD COLUMN IF NOT EXISTS status company_status NOT NULL DEFAULT 'active'`,
  `ALTER TABLE IF EXISTS companies
     ADD COLUMN IF NOT EXISTS can_create_batches boolean NOT NULL DEFAULT true`,
  `ALTER TABLE IF EXISTS companies
     ADD COLUMN IF NOT EXISTS can_request_upi boolean NOT NULL DEFAULT true`,
  `ALTER TABLE IF EXISTS companies
     ADD COLUMN IF NOT EXISTS can_view_reports boolean NOT NULL DEFAULT true`,
  `ALTER TABLE IF EXISTS companies
     ADD COLUMN IF NOT EXISTS blocked_reason text`,
  `ALTER TABLE IF EXISTS companies
     ADD COLUMN IF NOT EXISTS blocked_at timestamptz`,
  `ALTER TABLE IF EXISTS companies
     ADD COLUMN IF NOT EXISTS blocked_by uuid`,
  `ALTER TABLE IF EXISTS companies
     DROP CONSTRAINT IF EXISTS companies_blocked_by_fkey`,
  `ALTER TABLE IF EXISTS companies
     ADD CONSTRAINT companies_blocked_by_fkey FOREIGN KEY (blocked_by) REFERENCES users(id) ON DELETE SET NULL`,
  `CREATE TABLE IF NOT EXISTS upi_payments (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
     created_by uuid REFERENCES users(id) ON DELETE SET NULL,
     plan_key text NOT NULL,
     plan_name text NOT NULL,
     credits integer NOT NULL,
     base_amount_inr numeric(10, 2) NOT NULL DEFAULT 0,
     discount_percent integer NOT NULL DEFAULT 0,
     discount_amount_inr numeric(10, 2) NOT NULL DEFAULT 0,
     amount_inr numeric(10, 2) NOT NULL DEFAULT 0,
     status upi_payment_status NOT NULL DEFAULT 'pending',
     transaction_reference text,
     customer_name text,
     customer_email text,
     payment_note text,
     approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
     approved_at timestamptz,
     created_at timestamptz NOT NULL DEFAULT NOW(),
     updated_at timestamptz NOT NULL DEFAULT NOW()
   )`,
  `ALTER TABLE IF EXISTS upi_payments
     ADD COLUMN IF NOT EXISTS created_by uuid`,
  `ALTER TABLE IF EXISTS upi_payments
     ADD COLUMN IF NOT EXISTS plan_key text`,
  `ALTER TABLE IF EXISTS upi_payments
     ADD COLUMN IF NOT EXISTS plan_name text`,
  `ALTER TABLE IF EXISTS upi_payments
     ADD COLUMN IF NOT EXISTS credits integer`,
  `ALTER TABLE IF EXISTS upi_payments
     ADD COLUMN IF NOT EXISTS base_amount_inr numeric(10, 2) NOT NULL DEFAULT 0`,
  `ALTER TABLE IF EXISTS upi_payments
     ADD COLUMN IF NOT EXISTS discount_percent integer NOT NULL DEFAULT 0`,
  `ALTER TABLE IF EXISTS upi_payments
     ADD COLUMN IF NOT EXISTS discount_amount_inr numeric(10, 2) NOT NULL DEFAULT 0`,
  `ALTER TABLE IF EXISTS upi_payments
     ADD COLUMN IF NOT EXISTS amount_inr numeric(10, 2) NOT NULL DEFAULT 0`,
  `ALTER TABLE IF EXISTS upi_payments
     ADD COLUMN IF NOT EXISTS status upi_payment_status NOT NULL DEFAULT 'pending'`,
  `ALTER TABLE IF EXISTS upi_payments
     ADD COLUMN IF NOT EXISTS transaction_reference text`,
  `ALTER TABLE IF EXISTS upi_payments
     ADD COLUMN IF NOT EXISTS customer_name text`,
  `ALTER TABLE IF EXISTS upi_payments
     ADD COLUMN IF NOT EXISTS customer_email text`,
  `ALTER TABLE IF EXISTS upi_payments
     ADD COLUMN IF NOT EXISTS payment_note text`,
  `ALTER TABLE IF EXISTS upi_payments
     ADD COLUMN IF NOT EXISTS approved_by uuid`,
  `ALTER TABLE IF EXISTS upi_payments
     ADD COLUMN IF NOT EXISTS approved_at timestamptz`,
  `ALTER TABLE IF EXISTS upi_payments
     ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW()`,
  `ALTER TABLE IF EXISTS upi_payments
     ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW()`,
  `CREATE TABLE IF NOT EXISTS company_discounts (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     company_id uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
     discount_percent integer NOT NULL DEFAULT 0,
     note text,
     created_by uuid REFERENCES users(id) ON DELETE SET NULL,
     updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
     created_at timestamptz NOT NULL DEFAULT NOW(),
     updated_at timestamptz NOT NULL DEFAULT NOW()
   )`,
  `ALTER TABLE IF EXISTS company_discounts
     ADD COLUMN IF NOT EXISTS note text`,
  `ALTER TABLE IF EXISTS company_discounts
     ADD COLUMN IF NOT EXISTS created_by uuid`,
  `ALTER TABLE IF EXISTS company_discounts
     ADD COLUMN IF NOT EXISTS updated_by uuid`,
  `ALTER TABLE IF EXISTS company_discounts
     ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW()`,
  `ALTER TABLE IF EXISTS company_discounts
     ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW()`,
  `ALTER TABLE IF EXISTS company_discounts
     ADD COLUMN IF NOT EXISTS discount_percent integer NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS credit_ledger (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
     change_amount integer NOT NULL,
     reason text NOT NULL,
     reference_id uuid,
     created_at timestamptz NOT NULL DEFAULT NOW()
   )`,
  `ALTER TABLE IF EXISTS credit_ledger
     ADD COLUMN IF NOT EXISTS reference_id uuid`,
  `ALTER TABLE IF EXISTS credit_ledger
     ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW()`,
  `CREATE TABLE IF NOT EXISTS company_email_settings (
     company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
     sender_name text,
     sender_email text,
     reply_to_name text,
     reply_to_email text,
     smtp_host text,
     smtp_port integer NOT NULL DEFAULT 587,
     smtp_secure boolean NOT NULL DEFAULT false,
     smtp_allow_invalid_certs boolean NOT NULL DEFAULT false,
     smtp_user text,
     smtp_pass text,
     enabled boolean NOT NULL DEFAULT false,
     email_subject_template text,
     email_body_template text,
     brand_logo_url text,
     brand_primary_color text,
     created_at timestamptz NOT NULL DEFAULT NOW(),
     updated_at timestamptz NOT NULL DEFAULT NOW()
   )`,
  `ALTER TABLE IF EXISTS company_email_settings
     ADD COLUMN IF NOT EXISTS sender_name text`,
  `ALTER TABLE IF EXISTS company_email_settings
     ADD COLUMN IF NOT EXISTS sender_email text`,
  `ALTER TABLE IF EXISTS company_email_settings
     ADD COLUMN IF NOT EXISTS reply_to_name text`,
  `ALTER TABLE IF EXISTS company_email_settings
     ADD COLUMN IF NOT EXISTS reply_to_email text`,
  `ALTER TABLE IF EXISTS company_email_settings
     ADD COLUMN IF NOT EXISTS smtp_host text`,
  `ALTER TABLE IF EXISTS company_email_settings
     ADD COLUMN IF NOT EXISTS smtp_port integer NOT NULL DEFAULT 587`,
  `ALTER TABLE IF EXISTS company_email_settings
     ADD COLUMN IF NOT EXISTS smtp_secure boolean NOT NULL DEFAULT false`,
  `ALTER TABLE IF EXISTS company_email_settings
     ADD COLUMN IF NOT EXISTS smtp_allow_invalid_certs boolean NOT NULL DEFAULT false`,
  `ALTER TABLE IF EXISTS company_email_settings
     ADD COLUMN IF NOT EXISTS smtp_user text`,
  `ALTER TABLE IF EXISTS company_email_settings
     ADD COLUMN IF NOT EXISTS smtp_pass text`,
  `ALTER TABLE IF EXISTS company_email_settings
     ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false`,
  `ALTER TABLE IF EXISTS company_email_settings
     ADD COLUMN IF NOT EXISTS email_subject_template text`,
  `ALTER TABLE IF EXISTS company_email_settings
     ADD COLUMN IF NOT EXISTS email_body_template text`,
  `ALTER TABLE IF EXISTS company_email_settings
     ADD COLUMN IF NOT EXISTS brand_logo_url text`,
  `ALTER TABLE IF EXISTS company_email_settings
     ADD COLUMN IF NOT EXISTS brand_primary_color text`,
  `ALTER TABLE IF EXISTS company_email_settings
     ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW()`,
  `ALTER TABLE IF EXISTS company_email_settings
     ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW()`,
  `ALTER TABLE IF EXISTS batches
     ADD COLUMN IF NOT EXISTS sender_email text`,
  `ALTER TABLE IF EXISTS batches
     ADD COLUMN IF NOT EXISTS sender_name text`,
  `ALTER TABLE IF EXISTS batches
     ADD COLUMN IF NOT EXISTS email_message text`,
  `ALTER TABLE IF EXISTS batches
     ADD COLUMN IF NOT EXISTS attachment_message text`,
  `ALTER TABLE IF EXISTS batches
     ADD COLUMN IF NOT EXISTS certificate_template_id uuid`,
  `CREATE TABLE IF NOT EXISTS batch_attachments (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
     original_name text NOT NULL,
     stored_path text NOT NULL,
     mime_type text,
     attachment_order integer NOT NULL DEFAULT 0,
     created_at timestamptz NOT NULL DEFAULT NOW()
   )`,
  `ALTER TABLE IF EXISTS batch_attachments
     ADD COLUMN IF NOT EXISTS original_name text`,
  `ALTER TABLE IF EXISTS batch_attachments
     ADD COLUMN IF NOT EXISTS stored_path text`,
  `ALTER TABLE IF EXISTS batch_attachments
     ADD COLUMN IF NOT EXISTS mime_type text`,
  `ALTER TABLE IF EXISTS batch_attachments
     ADD COLUMN IF NOT EXISTS attachment_order integer NOT NULL DEFAULT 0`,
  `ALTER TABLE IF EXISTS batch_attachments
     ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW()`,
  `CREATE TABLE IF NOT EXISTS batch_templates (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
     upload_id uuid NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
     template_order integer NOT NULL DEFAULT 0,
     created_at timestamptz NOT NULL DEFAULT NOW()
   )`,
  `ALTER TABLE IF EXISTS batch_templates
     ADD COLUMN IF NOT EXISTS template_order integer NOT NULL DEFAULT 0`,
  `ALTER TABLE IF EXISTS batch_templates
     ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW()`,
  `CREATE TABLE IF NOT EXISTS certificate_templates (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
     name text NOT NULL,
     background_upload_id uuid NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
     field_config jsonb NOT NULL DEFAULT '[]'::jsonb,
     issue_date_mode text NOT NULL DEFAULT 'current_date',
     issue_date_value text,
     image_width integer NOT NULL DEFAULT 0,
     image_height integer NOT NULL DEFAULT 0,
     is_active boolean NOT NULL DEFAULT true,
     created_by uuid REFERENCES users(id) ON DELETE SET NULL,
     updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
     created_at timestamptz NOT NULL DEFAULT NOW(),
     updated_at timestamptz NOT NULL DEFAULT NOW()
   )`,
  `ALTER TABLE IF EXISTS certificate_templates
     ADD COLUMN IF NOT EXISTS name text`,
  `ALTER TABLE IF EXISTS certificate_templates
     ADD COLUMN IF NOT EXISTS background_upload_id uuid`,
  `ALTER TABLE IF EXISTS certificate_templates
     ADD COLUMN IF NOT EXISTS field_config jsonb NOT NULL DEFAULT '[]'::jsonb`,
  `ALTER TABLE IF EXISTS certificate_templates
     ADD COLUMN IF NOT EXISTS issue_date_mode text NOT NULL DEFAULT 'current_date'`,
  `ALTER TABLE IF EXISTS certificate_templates
     ADD COLUMN IF NOT EXISTS issue_date_value text`,
  `ALTER TABLE IF EXISTS certificate_templates
     ADD COLUMN IF NOT EXISTS image_width integer NOT NULL DEFAULT 0`,
  `ALTER TABLE IF EXISTS certificate_templates
     ADD COLUMN IF NOT EXISTS image_height integer NOT NULL DEFAULT 0`,
  `ALTER TABLE IF EXISTS certificate_templates
     ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true`,
  `ALTER TABLE IF EXISTS certificate_templates
     ADD COLUMN IF NOT EXISTS created_by uuid`,
  `ALTER TABLE IF EXISTS certificate_templates
     ADD COLUMN IF NOT EXISTS updated_by uuid`,
  `ALTER TABLE IF EXISTS certificate_templates
     ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW()`,
  `ALTER TABLE IF EXISTS certificate_templates
     ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW()`,
  `ALTER TYPE upload_kind ADD VALUE IF NOT EXISTS 'image'`,
  `ALTER TYPE upload_kind ADD VALUE IF NOT EXISTS 'pdf'`,
  `ALTER TABLE IF EXISTS batches
     DROP CONSTRAINT IF EXISTS batches_certificate_template_id_fkey`,
  `ALTER TABLE IF EXISTS batches
     ADD CONSTRAINT batches_certificate_template_id_fkey FOREIGN KEY (certificate_template_id) REFERENCES certificate_templates(id) ON DELETE SET NULL`,
  `ALTER TABLE IF EXISTS company_discounts
     DROP CONSTRAINT IF EXISTS company_discounts_discount_percent_check`,
  `ALTER TABLE IF EXISTS company_discounts
     ADD CONSTRAINT company_discounts_discount_percent_check CHECK (discount_percent IN (0, 5, 10, 15, 20))`,
  `CREATE TABLE IF NOT EXISTS pricing_plans (
     plan_key text PRIMARY KEY,
     name text NOT NULL,
     description text NOT NULL,
     credits integer NOT NULL,
     amount_inr numeric(10, 2) NOT NULL,
     recommended boolean NOT NULL DEFAULT false,
     features jsonb NOT NULL DEFAULT '[]'::jsonb,
     display_order integer NOT NULL DEFAULT 0,
     updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
     created_at timestamptz NOT NULL DEFAULT NOW(),
     updated_at timestamptz NOT NULL DEFAULT NOW()
   )`,
  `ALTER TABLE IF EXISTS pricing_plans
     ADD COLUMN IF NOT EXISTS name text`,
  `ALTER TABLE IF EXISTS pricing_plans
     ADD COLUMN IF NOT EXISTS description text`,
  `ALTER TABLE IF EXISTS pricing_plans
     ADD COLUMN IF NOT EXISTS credits integer`,
  `ALTER TABLE IF EXISTS pricing_plans
     ADD COLUMN IF NOT EXISTS amount_inr numeric(10, 2) NOT NULL DEFAULT 0`,
  `ALTER TABLE IF EXISTS pricing_plans
     ADD COLUMN IF NOT EXISTS recommended boolean NOT NULL DEFAULT false`,
  `ALTER TABLE IF EXISTS pricing_plans
     ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb`,
  `ALTER TABLE IF EXISTS pricing_plans
     ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0`,
  `ALTER TABLE IF EXISTS pricing_plans
     ADD COLUMN IF NOT EXISTS updated_by uuid`,
  `ALTER TABLE IF EXISTS pricing_plans
     ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW()`,
  `ALTER TABLE IF EXISTS pricing_plans
     ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW()`,
  `CREATE TABLE IF NOT EXISTS password_resets (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     email text NOT NULL,
     otp text NOT NULL,
     expires_at timestamptz NOT NULL,
     used boolean NOT NULL DEFAULT false,
     created_at timestamptz NOT NULL DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_password_resets_email_otp ON password_resets(email, otp)`
];

export async function migrateDatabaseSchema() {
  await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(421937512)');

    for (const statement of initializationStatements) {
      await client.query(statement);
    }

    for (const statement of migrationStatements) {
      await client.query(statement);
    }

    for (let index = 0; index < DEFAULT_PRICING_PLANS.length; index += 1) {
      const plan = DEFAULT_PRICING_PLANS[index];
      await client.query(
        `INSERT INTO pricing_plans (
           plan_key, name, description, credits, amount_inr, recommended, features, display_order
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
         ON CONFLICT (plan_key) DO NOTHING`,
        [
          plan.key,
          plan.name,
          plan.description,
          plan.credits,
          plan.amountInr,
          Boolean(plan.recommended),
          JSON.stringify(plan.features),
          index
        ]
      );
    }
  });
}
