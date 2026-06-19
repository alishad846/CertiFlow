CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
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
$$;

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status company_status NOT NULL DEFAULT 'active',
  credits_remaining integer NOT NULL DEFAULT 0,
  can_create_batches boolean NOT NULL DEFAULT true,
  can_request_upi boolean NOT NULL DEFAULT true,
  can_view_reports boolean NOT NULL DEFAULT true,
  blocked_reason text,
  blocked_at timestamptz,
  blocked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role user_role NOT NULL,
  token_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  original_name text NOT NULL,
  stored_path text NOT NULL,
  kind upload_kind NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batches (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  template_type text NOT NULL CHECK (template_type IN ('certificate', 'offer_letter')),
  excel_upload_id uuid NOT NULL REFERENCES uploads(id) ON DELETE RESTRICT,
  template_upload_id uuid NOT NULL REFERENCES uploads(id) ON DELETE RESTRICT,
  status batch_status NOT NULL DEFAULT 'queued',
  total_rows integer NOT NULL DEFAULT 0,
  processed_rows integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  recipient_name text NOT NULL,
  recipient_email text NOT NULL,
  course text DEFAULT '',
  role text DEFAULT '',
  joining_date text DEFAULT '',
  completion_date text DEFAULT '',
  roll_number text DEFAULT '',
  source_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_docx_path text,
  generated_pdf_path text,
  status document_status NOT NULL DEFAULT 'pending',
  email_status email_status NOT NULL DEFAULT 'pending',
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status email_status NOT NULL,
  provider_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  change_amount integer NOT NULL,
  reason text NOT NULL,
  reference_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS upi_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  plan_key text NOT NULL,
  plan_name text NOT NULL,
  credits integer NOT NULL,
  base_amount_inr numeric(10, 2) NOT NULL DEFAULT 0,
  discount_percent integer NOT NULL DEFAULT 0,
  discount_amount_inr numeric(10, 2) NOT NULL DEFAULT 0,
  amount_inr numeric(10, 2) NOT NULL,
  status upi_payment_status NOT NULL DEFAULT 'pending',
  customer_name text,
  customer_email text,
  transaction_reference text,
  payment_note text,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  discount_percent integer NOT NULL DEFAULT 0 CHECK (discount_percent IN (0, 5, 10, 15, 20)),
  note text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uploads_company_id ON uploads(company_id);
CREATE INDEX IF NOT EXISTS idx_batches_company_id ON batches(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_batch_id ON documents(batch_id);
CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_company_id ON email_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_upi_payments_company_id ON upi_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_upi_payments_status ON upi_payments(status);
CREATE INDEX IF NOT EXISTS idx_company_discounts_company_id ON company_discounts(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS companies
  ADD COLUMN IF NOT EXISTS status company_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS can_create_batches boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_request_upi boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_view_reports boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_by uuid;

ALTER TABLE IF EXISTS companies
  DROP CONSTRAINT IF EXISTS companies_blocked_by_fkey;

ALTER TABLE IF EXISTS companies
  ADD CONSTRAINT companies_blocked_by_fkey FOREIGN KEY (blocked_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS upi_payments
  ADD COLUMN IF NOT EXISTS base_amount_inr numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount_inr numeric(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS company_discounts
  DROP CONSTRAINT IF EXISTS company_discounts_discount_percent_check,
  ADD CONSTRAINT company_discounts_discount_percent_check CHECK (discount_percent IN (0, 5, 10, 15, 20));
