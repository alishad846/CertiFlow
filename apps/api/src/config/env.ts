import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

function findEnvFile() {
  let dir = process.cwd();

  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return undefined;
}

dotenv.config({
  path: findEnvFile()
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  AUTH_COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).optional(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  DEFAULT_COMPANY_CREDITS: z.coerce.number().default(100),
  SUPER_ADMIN_EMAIL: z.string().email(),
  SUPER_ADMIN_PASSWORD: z.string().min(8),
  SUPER_ADMIN_NAME: z.string().default('Super Admin'),
  UPLOAD_DIR: z.string().default('./uploads'),
  UPI_VPA: z.string().optional().default(''),
  UPI_PAYEE_NAME: z.string().default('CertiFlow'),
  UPI_CURRENCY: z.string().default('INR'),
  EMAIL_PROVIDER: z.enum(['nodemailer', 'resend', 'n8n']).default('nodemailer'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_ALLOW_INVALID_CERTS: z.coerce.boolean().default(false),
  MAIL_FROM: z.string().default('CertiFlow <no-reply@certiflow.local>'),
  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_FROM: z.string().default('no-reply@certiflow.local'),
  N8N_WEBHOOK_URL: z.string().optional().default(''),
  EMAIL_BATCH_DELAY_MS: z.coerce.number().default(30000),
  SOFFICE_PATH: z.string().default('soffice'),

  // Public web origin used to build claim/verify links inside emails.
  APP_URL: z.string().default('http://localhost:3000'),
  // Certificate PDFs are stored here, OUTSIDE the publicly-served UPLOAD_DIR.
  // They are streamed only through the claim-verified download endpoint.
  CERT_STORE_DIR: z.string().default('./secure-certificates'),
  CLAIM_TOKEN_TTL_DAYS: z.coerce.number().default(180),
  CLAIM_OTP_TTL_MINUTES: z.coerce.number().default(10),
  CLAIM_SESSION_TTL_MINUTES: z.coerce.number().default(30),
  CLAIM_MAX_OTP_ATTEMPTS: z.coerce.number().default(5),

  // Worker tuning — keep heavy work off the API process and throttle SMTP.
  BATCH_WORKER_CONCURRENCY: z.coerce.number().default(1),
  EMAIL_WORKER_CONCURRENCY: z.coerce.number().default(3),
  EMAIL_RATE_MAX: z.coerce.number().default(20),
  EMAIL_RATE_DURATION_MS: z.coerce.number().default(1000),

  // Tamper-proofing: stamp a QR (→ verify page) and digitally sign each PDF.
  // In production, point CERT_SIGNING_P12_PATH at a real (CA-issued) code-signing
  // cert. If unset, a self-signed dev P12 is auto-generated under CERT_STORE_DIR.
  CERT_SIGNING_ENABLED: z.coerce.boolean().default(true),
  CERT_SIGNING_P12_PATH: z.string().optional().default(''),
  CERT_SIGNING_P12_PASSPHRASE: z.string().default('certiflow')
});

export const env = envSchema.parse(process.env);
