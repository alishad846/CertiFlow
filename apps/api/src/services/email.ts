import fs from 'fs/promises';
import nodemailer from 'nodemailer';
import axios from 'axios';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { pool } from '../db/pool';

export interface SendEmailParams {
  companyId: string;
  to: string;
  subject: string;
  html: string;
  attachmentPath?: string;
  attachmentName?: string;
  attachments?: Array<{
    path: string;
    filename: string;
  }>;
  recipientName: string;
  batchId: string;
  documentId: string;
  senderEmail?: string;
  senderName?: string;
}

let cachedTransporter: nodemailer.Transporter | null = null;
const companyTransporters = new Map<string, nodemailer.Transporter>();

type CompanyEmailSettings = {
  company_id: string;
  sender_name: string | null;
  sender_email: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean | null;
  smtp_allow_invalid_certs: boolean | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  enabled: boolean | null;
};

type SmtpError = Error & {
  code?: string;
  responseCode?: number;
  response?: string;
};

function shouldAllowInvalidCerts(companySetting?: boolean | null) {
  return Boolean(companySetting ?? env.SMTP_ALLOW_INVALID_CERTS);
}

function buildTlsOptions(allowInvalidCerts: boolean) {
  return allowInvalidCerts ? { rejectUnauthorized: false } : undefined;
}

function isSmtpAuthError(error: unknown) {
  const smtpError = error as SmtpError | undefined;
  return smtpError?.code === 'EAUTH' || smtpError?.responseCode === 535;
}

function isSmtpTlsError(error: unknown) {
  const smtpError = error as SmtpError | undefined;
  const message = smtpError?.message ?? '';
  return (
    smtpError?.code === 'ESOCKET' &&
    /self-signed certificate|unable to verify the first certificate|UNABLE_TO_VERIFY_LEAF_SIGNATURE/i.test(message)
  );
}

function formatSmtpAuthMessage(params: {
  source: string;
  host: string;
  user?: string | null;
}) {
  const userPart = params.user ? ` with username ${params.user}` : '';
  return `SMTP authentication failed for ${params.source} using ${params.host}${userPart}. Check the SMTP username/password and confirm the sender account is allowed to authenticate.`;
}

function formatSmtpTlsMessage(params: {
  source: string;
  host: string;
}) {
  return `SMTP certificate verification failed for ${params.source} using ${params.host}. Enable "Allow invalid SMTP certificates" for this sender or install a trusted certificate on the SMTP server.`;
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (!env.SMTP_HOST) {
    throw new AppError('SMTP_HOST is not configured', 500);
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    tls: buildTlsOptions(shouldAllowInvalidCerts())
  });

  return cachedTransporter;
}

function getReplyTo(params: SendEmailParams) {
  return params.senderEmail
    ? { name: params.senderName ?? 'CertiFlow', address: params.senderEmail }
    : undefined;
}

function getAttachments(params: SendEmailParams) {
  if (params.attachments?.length) {
    return params.attachments;
  }
  if (params.attachmentPath && params.attachmentName) {
    return [{ path: params.attachmentPath, filename: params.attachmentName }];
  }
  return [];
}

async function getCompanyEmailSettings(companyId: string) {
  const result = await pool.query<CompanyEmailSettings>(
    `SELECT company_id, sender_name, sender_email, smtp_host, smtp_port, smtp_secure, smtp_allow_invalid_certs,
            smtp_user, smtp_pass, enabled
     FROM company_email_settings
     WHERE company_id = $1`,
    [companyId]
  );

  return result.rows[0] ?? null;
}

function getCompanyTransporter(settings: CompanyEmailSettings) {
  const cacheKey = [
    settings.company_id,
    settings.smtp_host,
    settings.smtp_port,
    settings.smtp_secure,
    settings.smtp_allow_invalid_certs,
    settings.smtp_user,
    settings.smtp_pass
  ].join('|');

  const cached = companyTransporters.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (!settings.smtp_host) {
    throw new AppError('SMTP host is not configured for this company', 500);
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port ?? 587,
    secure: settings.smtp_secure ?? false,
    auth: settings.smtp_user ? { user: settings.smtp_user, pass: settings.smtp_pass ?? undefined } : undefined,
    tls: buildTlsOptions(shouldAllowInvalidCerts(settings.smtp_allow_invalid_certs))
  });

  companyTransporters.set(cacheKey, transporter);
  return transporter;
}

async function sendWithCompanySettings(params: SendEmailParams, settings: CompanyEmailSettings) {
  if (!settings.enabled) {
    return false;
  }
  if (!settings.sender_email || !settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
    throw new AppError('Company email sender is not fully configured', 500);
  }

  const transporter = getCompanyTransporter(settings);
  try {
    await transporter.sendMail({
      from: {
        name: settings.sender_name ?? 'CertiFlow',
        address: settings.sender_email
      },
      replyTo: getReplyTo(params),
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: getAttachments(params).map((attachment) => ({
        filename: attachment.filename,
        path: attachment.path
      }))
    });
  } catch (error) {
    if (isSmtpAuthError(error)) {
      throw new AppError(
        formatSmtpAuthMessage({
          source: `company sender ${settings.sender_email ?? settings.company_id}`,
          host: settings.smtp_host ?? 'SMTP host',
          user: settings.smtp_user
        }),
        401
      );
    }
    if (isSmtpTlsError(error)) {
      throw new AppError(
        formatSmtpTlsMessage({
          source: `company sender ${settings.sender_email ?? settings.company_id}`,
          host: settings.smtp_host ?? 'SMTP host'
        }),
        502
      );
    }
    throw error;
  }
  return true;
}

async function sendWithN8n(params: SendEmailParams) {
  if (!env.N8N_WEBHOOK_URL) {
    throw new AppError('N8N_WEBHOOK_URL is not configured', 500);
  }

  const attachments = getAttachments(params);
  const serializedAttachments = await Promise.all(
    attachments.map(async (attachment) => ({
      filename: attachment.filename,
      content: (await fs.readFile(attachment.path)).toString('base64')
    }))
  );
  await axios.post(env.N8N_WEBHOOK_URL, {
    from: env.MAIL_FROM,
    replyTo: params.senderEmail ?? undefined,
    replyToName: params.senderName ?? undefined,
    to: params.to,
    subject: params.subject,
    html: params.html,
    recipientName: params.recipientName,
    batchId: params.batchId,
    documentId: params.documentId,
    attachments: serializedAttachments
  });
}

async function sendWithResend(params: SendEmailParams) {
  if (!env.RESEND_API_KEY) {
    throw new AppError('RESEND_API_KEY is not configured', 500);
  }

  const attachments = getAttachments(params);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      reply_to: params.senderEmail ?? undefined,
      attachments: await Promise.all(
        attachments.map(async (attachment) => ({
          filename: attachment.filename,
          content: (await fs.readFile(attachment.path)).toString('base64')
        }))
      )
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new AppError(payload?.message ?? 'Resend request failed', response.status);
  }
}

async function sendWithNodemailer(params: SendEmailParams) {
  const transporter = getTransporter();
  try {
    await transporter.sendMail({
      from: env.MAIL_FROM,
      replyTo: getReplyTo(params),
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: getAttachments(params).map((attachment) => ({
        filename: attachment.filename,
        path: attachment.path
      }))
    });
  } catch (error) {
    if (isSmtpAuthError(error)) {
      throw new AppError(
        formatSmtpAuthMessage({
          source: 'global SMTP settings',
          host: env.SMTP_HOST || 'SMTP host',
          user: env.SMTP_USER || null
        }),
        401
      );
    }
    if (isSmtpTlsError(error)) {
      throw new AppError(
        formatSmtpTlsMessage({
          source: 'global SMTP settings',
          host: env.SMTP_HOST || 'SMTP host'
        }),
        502
      );
    }
    throw error;
  }
}

export async function sendEmail(params: SendEmailParams) {
  const companySettings = await getCompanyEmailSettings(params.companyId);
  if (companySettings?.enabled) {
    await sendWithCompanySettings(params, companySettings);
    return;
  }

  if (env.EMAIL_PROVIDER === 'n8n') {
    return sendWithN8n(params);
  }
  if (env.EMAIL_PROVIDER === 'resend') {
    return sendWithResend(params);
  }
  return sendWithNodemailer(params);
}
