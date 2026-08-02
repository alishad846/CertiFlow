import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { createApp } from '../../app';
import { env } from '../../config/env';
import { pool } from '../../db/pool';
import { seedTemplateFixture } from '../../services/__tests__/helpers';

// Forge the same httpOnly `token` cookie shape `issueToken` produces (see editor-uploads.test.ts).
function signSessionCookie(user: {
  id: string;
  companyId: string | null;
  role: 'company_admin' | 'super_admin';
  email: string;
  name: string;
}) {
  const token = jwt.sign(
    { companyId: user.companyId, role: user.role, email: user.email, name: user.name, tokenVersion: 0 },
    env.JWT_SECRET,
    { subject: user.id, expiresIn: '1h' }
  );
  return `token=${token}`;
}

describe('account management', () => {
  const app = createApp();
  let userId: string;
  let companyId: string;
  let cookie: string;
  const email = `acct-${randomUUID()}@example.com`;
  const password = 'KnownPass123';
  const extraUserIds: string[] = [];

  beforeAll(async () => {
    const fixture = await seedTemplateFixture();
    companyId = fixture.companyId;
    userId = fixture.userId;
    // Give the fixture user a real password + email/username we control.
    await pool.query(
      `UPDATE users SET password_hash = $1, email = $2, username = $3 WHERE id = $4`,
      [await bcrypt.hash(password, 12), email, `acctuser-${randomUUID().slice(0, 8)}`, userId]
    );
    cookie = signSessionCookie({ id: userId, companyId, role: 'company_admin', email, name: 'Test Admin' });
  });

  afterAll(async () => {
    if (extraUserIds.length) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [extraUserIds]);
    }
  });

  it('updates the profile name', async () => {
    const res = await request(app).patch('/auth/profile').set('Cookie', cookie).send({ name: 'Renamed Admin' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Renamed Admin');
  });

  it('rejects a username already taken by another user (409)', async () => {
    const takenUsername = `taken-${randomUUID().slice(0, 8)}`;
    const other = await pool.query<{ id: string }>(
      `INSERT INTO users (company_id, name, email, username, password_hash, role)
       VALUES ($1, 'Other', $2, $3, 'x', 'company_admin') RETURNING id`,
      [companyId, `other-${randomUUID()}@example.com`, takenUsername]
    );
    extraUserIds.push(other.rows[0].id);

    const res = await request(app).patch('/auth/profile').set('Cookie', cookie).send({ username: takenUsername });
    expect(res.status).toBe(409);
  });

  it('changes the password only with the correct current password', async () => {
    const bad = await request(app)
      .post('/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'wrong-password', newPassword: 'BrandNew123' });
    expect(bad.status).toBe(401);

    const good = await request(app)
      .post('/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: password, newPassword: 'BrandNew123' });
    expect(good.status).toBe(200);
    expect(good.body.ok).toBe(true);
  });
});
