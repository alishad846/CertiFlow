# CertiFlow

CertiFlow is a simple MVP SaaS for EdTech companies and HR teams that generates bulk certificates and offer letters from an Excel sheet plus a DOCX template.

## What it does

- Login and register with JWT authentication
- Super admin and company admin roles
- Upload Excel + DOCX in one flow
- Replace DOCX placeholders without changing layout
- Convert generated DOCX files to PDF
- Send PDFs by email in batches of 50
- Track sent, pending, and failed delivery status
- Show basic dashboard stats and email logs
- Deduct credits per generated document

## Project Structure

- `apps/web` - Next.js frontend
- `apps/api` - Express backend and BullMQ workers
- `packages/shared` - Shared types and constants
- `n8n` - Optional email automation workflow
- `docker` - Database bootstrap files

## Local Setup

1. Copy `.env.example` to `.env` and fill in values.
2. Install dependencies:

```bash
npm install
```

3. Start PostgreSQL and Redis:

```bash
docker compose up -d postgres redis
```

4. Start the API, worker, and frontend:

```bash
npm run dev
```

## Config Split

- Keep shared infrastructure values in `.env`:
  - `DATABASE_URL`
  - `REDIS_URL`
  - `JWT_SECRET`
  - `RESEND_*` and `N8N_WEBHOOK_URL` if you use those providers
- Keep tenant-specific values in the database:
  - `company_email_settings` for sender, reply-to, branding, and email templates
  - `companies` for credits, status, and permissions
  - `company_discounts` and `credit_ledger` for per-company billing rules and usage

## API

The backend runs on `http://localhost:4000`.

Main endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /batches`
- `GET /dashboard/stats`
- `GET /batches`
- `GET /batches/:id`
- `GET /logs/email`

## DOCX Placeholder Rules

The DOCX template is treated as a design file. CertiFlow only replaces placeholders like:

- `{{name}}`
- `{{course}}`
- `{{role}}`
- `{{date}}`
- `{{email}}`
- `{{roll_number}}`

It does not modify fonts, spacing, logos, borders, alignment, or layout.

## PDF Placeholder Rules

PDF templates also support placeholders like `{{name}}`, but only when the PDF contains selectable text in the text layer.

- Placeholders must be part of the actual PDF text, not a flattened scan or image.
- The PDF can be used as a batch template or as an attachment template.
- If the PDF is image-only, CertiFlow can still overlay text, but it cannot rewrite the original text inside the PDF.

## Queue Flow

1. Admin uploads Excel and DOCX.
2. API parses rows, stores the batch, and enqueues a BullMQ job.
3. Worker renders a docx for each row using `docxtemplater`.
4. Worker converts docx to PDF with LibreOffice headless mode.
5. Worker sends emails in chunks of 50 with a delay between chunks.
6. Status is written to the documents table and email logs.

## n8n Workflow

The `n8n/certiflow-email-workflow.json` file contains a minimal webhook-based email workflow.
Import it into n8n, connect your SMTP credentials, and set `N8N_WEBHOOK_URL` if you want CertiFlow to post email requests into n8n instead of sending directly.

## Docker

Run the whole stack:

```bash
docker compose up --build
```

Services:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- n8n: `http://localhost:5678`

## Deployment

### Frontend

- Deploy `apps/web` to Vercel.
- Set `NEXT_PUBLIC_API_URL` to your backend HTTPS URL.

### Backend

- The best free backend host for this app is an Oracle Cloud Always Free VM with Docker Compose.
- Use [`docker-compose.oracle.yml`](docker-compose.oracle.yml) to run the API, worker, and HTTPS reverse proxy together.
- Set `API_DOMAIN` to a real DNS name for the API, for example `api.<your-ip>.nip.io`, so Caddy can mint a TLS certificate.
- Set `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, SMTP or Resend credentials, and `UPLOAD_DIR`.
- If the frontend and backend are on different domains, set `AUTH_COOKIE_SAME_SITE=none` and keep `secure=true` in production.
- Oracle is a better fit than a free web host here because CertiFlow needs persistent uploaded files and a long-running worker.

### Free Split Stack

For a low-traffic demo, a practical split stack is:

- Vercel for `apps/web`
- Supabase Free for PostgreSQL
- Upstash Free for Redis
- Oracle Cloud Always Free for the API, worker, and upload storage on a small VM

This keeps the browser app, database, queue, and backend process separate without paying for a full production platform on day one.

### Database

- Use PostgreSQL 14+.
- Apply `docker/postgres-init/001_schema.sql` or run the same schema during provisioning.

### Redis

- Required for BullMQ queues and delayed email batches.

### LibreOffice

- Install LibreOffice on the backend host so PDF conversion works.

### Production Env

- Start from [`.env.production.example`](.env.production.example) for the Oracle VM and backend service values.
- Set `NEXT_PUBLIC_API_URL` in Vercel to the deployed API URL.
- Set `WEB_ORIGIN` in the backend env to your Vercel frontend URL.

## Notes

- This MVP intentionally avoids AI features, workflow builders, WhatsApp, white labeling, and advanced analytics.
- The codebase is structured so the bulk generation pipeline can be extended later without rewriting the API.
- If LibreOffice is installed in a non-standard location, set `SOFFICE_PATH` in `.env`.
- Set `EMAIL_PROVIDER` to `nodemailer`, `resend`, or `n8n` depending on your mail setup.
