import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app';
import { env } from '../../config/env';
import { pool } from '../../db/pool';
import { seedTemplateFixture } from '../../services/__tests__/helpers';

function signSessionCookie(user: { id: string; companyId: string | null }) {
  const token = jwt.sign(
    { companyId: user.companyId, role: 'company_admin', email: 'gate@example.com', name: 'Gate Admin', tokenVersion: 0 },
    env.JWT_SECRET,
    { subject: user.id, expiresIn: '1h' }
  );
  return `token=${token}`;
}

describe('POST /batches SMTP onboarding gate', () => {
  const app = createApp();
  let cookie: string;
  let companyId: string;

  beforeAll(async () => {
    const fixture = await seedTemplateFixture();
    companyId = fixture.companyId;
    cookie = signSessionCookie({ id: fixture.userId, companyId });
  });

  it('rejects batch creation when SMTP is not configured', async () => {
    const res = await request(app)
      .post('/batches')
      .set('Cookie', cookie)
      .field('batchName', 'Gate Test')
      .field('templateType', 'certificate')
      .attach('excelFile', Buffer.from('Name,Email\nA,a@example.com\n'), 'recipients.csv');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email sender/i);
  });

  it('does not apply the SMTP gate once email is configured', async () => {
    await pool.query(
      `INSERT INTO company_email_settings (company_id, smtp_host, enabled) VALUES ($1, 'smtp.test', true)
       ON CONFLICT (company_id) DO UPDATE SET smtp_host = 'smtp.test', enabled = true`,
      [companyId]
    );
    const res = await request(app)
      .post('/batches')
      .set('Cookie', cookie)
      .field('batchName', 'Gate Test 2')
      .field('templateType', 'certificate')
      .attach('excelFile', Buffer.from('Name,Email\nA,a@example.com\n'), 'recipients.csv');
    // Past the gate — the SMTP-specific 400 message must no longer appear (any other outcome is fine).
    expect(res.body?.message ?? '').not.toMatch(/email sender/i);
  });
});
