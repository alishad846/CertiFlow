import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app';
import { env } from '../../config/env';
import { pool } from '../../db/pool';
import { seedTemplateFixture } from '../../services/__tests__/helpers';

function signSessionCookie(user: { id: string; companyId: string | null }) {
  const token = jwt.sign(
    { companyId: user.companyId, role: 'company_admin', email: 'dash@example.com', name: 'Dash Admin', tokenVersion: 0 },
    env.JWT_SECRET,
    { subject: user.id, expiresIn: '1h' }
  );
  return `token=${token}`;
}

describe('GET /dashboard/stats series', () => {
  const app = createApp();
  let cookie: string;

  beforeAll(async () => {
    const fixture = await seedTemplateFixture();
    cookie = signSessionCookie({ id: fixture.userId, companyId: fixture.companyId });
    // A certificate issued today so today's series point has issued >= 1.
    await pool.query(
      `INSERT INTO certificates (public_id, company_id, recipient_name, recipient_email)
       VALUES ($1, $2, 'Test Recipient', 'r@example.com')`,
      [`CF-DASH-${Math.floor(Math.random() * 1e6)}`, fixture.companyId]
    );
  });

  it('returns delivery breakdown and a 14-day certificate series', async () => {
    const res = await request(app).get('/dashboard/stats').set('Cookie', cookie);
    expect(res.status).toBe(200);

    expect(res.body.delivery).toBeTruthy();
    expect(typeof res.body.delivery.sent).toBe('number');
    expect(typeof res.body.delivery.failed).toBe('number');
    expect(typeof res.body.delivery.pending).toBe('number');

    expect(Array.isArray(res.body.certificates)).toBe(true);
    expect(res.body.certificates).toHaveLength(14);
    const last = res.body.certificates[res.body.certificates.length - 1];
    expect(last).toHaveProperty('date');
    expect(last).toHaveProperty('issued');
    expect(last).toHaveProperty('claimed');
    expect(last.issued).toBeGreaterThanOrEqual(1);
  });
});
