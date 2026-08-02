import fs from 'fs/promises';
import nodemailer from 'nodemailer';
import axios from 'axios';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { pool } from '../db/pool';
import { renderTemplateString } from './template-placeholders';

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

const companyTransporters = new Map<string, nodemailer.Transporter>();

type CompanyEmailSettings = {
  company_id: string;
  sender_name: string | null;
  sender_email: string | null;
  reply_to_name: string | null;
  reply_to_email: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean | null;
  smtp_allow_invalid_certs: boolean | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  enabled: boolean | null;
  email_subject_template: string | null;
  email_body_template: string | null;
  brand_logo_url: string | null;
  brand_primary_color: string | null;
};

type EmailTemplateContext = Record<string, string | number | boolean | null | undefined>;

function renderTemplate(template: string, context: EmailTemplateContext) {
  return renderTemplateString(template, context);
}

function buildEmailContext(params: SendEmailParams, settings?: CompanyEmailSettings, companyName?: string) {
  return {
    companyName: companyName ?? settings?.sender_name ?? 'CertiFlow',
    senderName: params.senderName ?? settings?.sender_name ?? 'CertiFlow',
    senderEmail: params.senderEmail ?? settings?.sender_email ?? '',
    replyToName: settings?.reply_to_name ?? params.senderName ?? settings?.sender_name ?? 'CertiFlow',
    replyToEmail: settings?.reply_to_email ?? params.senderEmail ?? '',
    recipientName: params.recipientName,
    recipientEmail: params.to,
    batchId: params.batchId,
    documentId: params.documentId,
    brandLogoUrl: settings?.brand_logo_url ?? '',
    brandPrimaryColor: settings?.brand_primary_color ?? '',
    content: params.html
  } satisfies EmailTemplateContext;
}

function getReplyTo(params: SendEmailParams, settings?: CompanyEmailSettings) {
  const address = settings?.reply_to_email ?? params.senderEmail;
  if (!address) {
    return undefined;
  }

  return {
    name: settings?.reply_to_name ?? params.senderName ?? settings?.sender_name ?? 'CertiFlow',
    address
  };
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeSmtpSecure(port: number, secure: boolean | null | undefined) {
  if (port === 465) {
    return true;
  }
  if (port === 587) {
    return false;
  }
  return secure ?? false;
}

function getSmtpErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  const lower = message.toLowerCase();
  if (lower.includes('incorrect authentication data') || lower.includes('535')) {
    return 'SMTP authentication failed: invalid username or password';
  }
  if (lower.includes('self-signed certificate')) {
    return 'SMTP TLS failed: server certificate is self-signed or untrusted';
  }
  if (lower.includes('wrong version number')) {
    return 'SMTP TLS failed: port and SSL/TLS mode do not match';
  }
  return message || fallback;
}

async function getCompanyEmailSettings(companyId: string) {
  const result = await pool.query<CompanyEmailSettings>(
    `SELECT company_id, sender_name, sender_email, reply_to_name, reply_to_email, smtp_host, smtp_port, smtp_secure,
            smtp_allow_invalid_certs, smtp_user, smtp_pass, enabled, email_subject_template, email_body_template,
            brand_logo_url, brand_primary_color
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

  const port = settings.smtp_port ?? 587;
  const secure = normalizeSmtpSecure(port, settings.smtp_secure);

  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port,
    secure,
    tls: settings.smtp_allow_invalid_certs ? { rejectUnauthorized: false } : undefined,
    auth: settings.smtp_user ? { user: settings.smtp_user, pass: settings.smtp_pass ?? undefined } : undefined
  });

  companyTransporters.set(cacheKey, transporter);
  return transporter;
}

async function verifyCompanyTransporter(settings: CompanyEmailSettings) {
  const transporter = getCompanyTransporter(settings);
  try {
    await transporter.verify();
  } catch (error) {
    throw new AppError(getSmtpErrorMessage(error, 'SMTP verification failed'), 400);
  }
}

export async function testCompanyEmailSettings(companyId: string) {
  const settings = await getCompanyEmailSettings(companyId);
  if (!settings) {
    throw new AppError('Email sender is not configured for this company', 400);
  }
  if (!settings.enabled) {
    throw new AppError('Email sender is disabled for this company', 400);
  }

  await verifyCompanyTransporter(settings);
  return true;
}

async function sendWithCompanySettings(params: SendEmailParams, settings: CompanyEmailSettings) {
  if (!settings.enabled) {
    return false;
  }
  if (!settings.sender_email || !settings.smtp_host) {
    throw new AppError('Company email sender is not fully configured', 500);
  }

  const transporter = getCompanyTransporter(settings);
  const company = await pool.query<{ name: string }>('SELECT name FROM companies WHERE id = $1', [settings.company_id]);
  const displayName = settings.sender_name ?? company.rows[0]?.name ?? 'CertiFlow';
  const context = buildEmailContext(params, settings, company.rows[0]?.name);
  const subject = settings.email_subject_template ? renderTemplate(settings.email_subject_template, context) : params.subject;
  const html = settings.email_body_template ? renderTemplate(settings.email_body_template, context) : params.html;

  try {
    await transporter.sendMail({
      from: {
        name: displayName,
        address: settings.sender_email
      },
      replyTo: getReplyTo(params, settings),
      to: params.to,
      subject,
      html,
      attachments: getAttachments(params).map((attachment) => ({
        filename: attachment.filename,
        path: attachment.path
      }))
    });
  } catch (error) {
    throw new AppError(getSmtpErrorMessage(error, 'Email send failed'), 400);
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
    from: params.senderEmail ? `${params.senderName ?? ''} <${params.senderEmail}>` : env.MAIL_FROM,
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
      from: params.senderEmail ? `${params.senderName ?? ''} <${params.senderEmail}>` : env.RESEND_FROM,
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

/**
 * Fallback sender for companies that have NOT configured a custom SMTP profile: send through the
 * platform's global SMTP (env.SMTP_*), the same transport sendSystemEmail uses. We send AS the
 * platform (MAIL_FROM, which is the authenticated mailbox — Gmail et al. reject an unverified From)
 * and set Reply-To to the company's own sender so replies still reach them.
 */
async function sendWithSystemSmtp(params: SendEmailParams) {
  if (!env.SMTP_HOST) {
    throw new AppError('System SMTP host is not configured in .env', 500);
  }
  const port = env.SMTP_PORT;
  const secure = port === 465 ? true : port === 587 ? false : env.SMTP_SECURE;
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure,
    tls: env.SMTP_ALLOW_INVALID_CERTS ? { rejectUnauthorized: false } : undefined,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
  });
  try {
    await transporter.sendMail({
      from: env.MAIL_FROM,
      replyTo: params.senderEmail ?? undefined,
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: getAttachments(params).map((attachment) => ({
        filename: attachment.filename,
        path: attachment.path
      }))
    });
  } catch (error) {
    throw new AppError(getSmtpErrorMessage(error, 'Email send failed'), 400);
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

  // nodemailer provider + no company SMTP profile: fall back to the platform's global SMTP so
  // batches/claims still send. (Previously this threw "not configured", blocking every send for
  // companies that never set up a custom sender.)
  if (env.EMAIL_PROVIDER === 'nodemailer' && env.SMTP_HOST) {
    return sendWithSystemSmtp(params);
  }

  if (!companySettings) {
    throw new AppError('Email sender is not configured for this company', 400);
  }

  if (!companySettings.enabled) {
    throw new AppError('Email sender is disabled for this company', 400);
  }

  throw new AppError('Email sender configuration is invalid for this company', 500);
}

export async function sendSystemEmail(params: { to: string; subject: string; html: string; recipientName?: string }) {
  if (env.EMAIL_PROVIDER === 'n8n' && env.N8N_WEBHOOK_URL) {
    await axios.post(env.N8N_WEBHOOK_URL, {
      from: env.MAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      recipientName: params.recipientName ?? ''
    });
    return;
  }
  if (env.EMAIL_PROVIDER === 'resend' && env.RESEND_API_KEY) {
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
        html: params.html
      })
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new AppError(payload?.message ?? 'Resend request failed', response.status);
    }
    return;
  }

  if (!env.SMTP_HOST) {
    throw new AppError('System SMTP host is not configured in .env', 500);
  }

  const port = env.SMTP_PORT;
  const secure = port === 465 ? true : port === 587 ? false : env.SMTP_SECURE;

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure,
    tls: env.SMTP_ALLOW_INVALID_CERTS ? { rejectUnauthorized: false } : undefined,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
  });

  try {
    await transporter.sendMail({
      from: env.MAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html
    });
  } catch (error) {
    throw new AppError(getSmtpErrorMessage(error, 'Failed to send email via SMTP'), 500);
  }
}

export function getOtpEmailHtml(otp: string, userName: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1f56a8; margin: 0; font-size: 24px;">CertiFlow</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Password Reset Request</p>
      </div>
      <p style="color: #334155; font-size: 16px; line-height: 1.5;">Hello ${userName},</p>
      <p style="color: #334155; font-size: 16px; line-height: 1.5;">We received a request to reset your password. Use the verification code below to complete the process:</p>
      <div style="margin: 32px 0; text-align: center;">
        <div style="display: inline-block; padding: 16px 32px; background-color: #f1f5f9; border-radius: 12px; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a; border: 2px dashed #cbd5e1;">
          ${otp}
        </div>
      </div>
      <p style="color: #64748b; font-size: 14px; line-height: 1.5;">This verification code will expire in <strong>15 minutes</strong>. If you did not request a password reset, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">&copy; ${new Date().getFullYear()} CertiFlow. All rights reserved.</p>
    </div>
  `;
}
