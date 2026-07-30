import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app';
import { env } from '../../config/env';
import { pool } from '../../db/pool';
import { seedTemplateFixture } from '../../services/__tests__/helpers';

// Authed round-trip against the real CertiFlow session cookie: sign a JWT with the exact payload
// shape `issueToken` (apps/api/src/routes/auth.ts) produces, send it as the httpOnly `token`
// cookie `requireAuth` reads, and drive upload -> list -> remove through supertest + a real Postgres
// row (via the Task-4 `seedTemplateFixture` company+user fixture). This exercises the full stack
// (multer disk storage, the `uploads` insert, the `{ data: [...] }` envelope, and `/files` url
// shape) rather than just the pure mapping helper.
function signSessionCookie(user: { id: string; companyId: string | null; role: 'company_admin' | 'super_admin'; email: string; name: string }) {
  const token = jwt.sign(
    {
      companyId: user.companyId,
      role: user.role,
      email: user.email,
      name: user.name,
      tokenVersion: 0
    },
    env.JWT_SECRET,
    { subject: user.id, expiresIn: '1h' }
  );
  return `token=${token}`;
}

describe('AUTHED /api/editor/your-uploads/*', () => {
  const app = createApp();
  let companyId: string;
  let userId: string;
  let cookie: string;

  beforeAll(async () => {
    const fixture = await seedTemplateFixture();
    companyId = fixture.companyId;
    userId = fixture.userId;
    cookie = signSessionCookie({ id: userId, companyId, role: 'company_admin', email: 'test@example.com', name: 'Test Admin' });
  });

  it('rejects all three routes without a session cookie (401)', async () => {
    const upload = await request(app).post('/api/editor/your-uploads/upload').attach('file', Buffer.from('x'), 'x.png');
    expect(upload.status).toBe(401);

    const list = await request(app).get('/api/editor/your-uploads/get-user-images');
    expect(list.status).toBe(401);

    const remove = await request(app).delete('/api/editor/your-uploads/remove/00000000-0000-0000-0000-000000000000');
    expect(remove.status).toBe(401);
  });

  it('uploads, lists, and removes a user image, matching the fork\'s expected { data: [...] } shape', async () => {
    // 1x1 transparent PNG
    const pngBuffer = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082',
      'hex'
    );

    const uploadRes = await request(app)
      .post('/api/editor/your-uploads/upload')
      .set('Cookie', cookie)
      .attach('file', pngBuffer, { filename: 'pixel.png', contentType: 'image/png' });

    expect(uploadRes.status).toBe(201);
    expect(Array.isArray(uploadRes.body.data)).toBe(true);
    expect(uploadRes.body.data).toHaveLength(1);

    const item = uploadRes.body.data[0];
    expect(typeof item.id).toBe('number');
    expect(typeof item.documentId).toBe('string');
    expect(item.img.url).toMatch(/^https?:\/\/127\.0\.0\.1:\d+\/files\//);
    expect(item.img.url).toContain(`company-${companyId}/editor-images/`);
    expect(item.img.mime).toBe('image/png');

    const documentId = item.documentId as string;

    // The uploads row exists with the right company/kind.
    const row = await pool.query<{ company_id: string; kind: string }>(
      'SELECT company_id, kind FROM uploads WHERE id = $1',
      [documentId]
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].company_id).toBe(companyId);
    expect(row.rows[0].kind).toBe('image');

    // Listing surfaces the uploaded image for this company.
    const listRes = await request(app).get('/api/editor/your-uploads/get-user-images').set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data.some((i: { documentId: string }) => i.documentId === documentId)).toBe(true);

    // Removing deletes the row.
    const removeRes = await request(app).delete(`/api/editor/your-uploads/remove/${documentId}`).set('Cookie', cookie);
    expect(removeRes.status).toBe(200);
    expect(removeRes.body).toEqual({ ok: true });

    const afterRemove = await pool.query('SELECT id FROM uploads WHERE id = $1', [documentId]);
    expect(afterRemove.rows).toHaveLength(0);
  });

  it('rejects import-url without a session cookie (401)', async () => {
    const res = await request(app)
      .post('/api/editor/your-uploads/import-url')
      .send({ url: 'https://images.example.com/photo.png' });
    expect(res.status).toBe(401);
  });

  // Task 10a: authed persistence building block for the Collection (Unsplash) tab — downloads a
  // url server-side into CertiFlow's own uploads. Mocks global.fetch (both the "download the
  // image" call and the Unsplash download_location ping) rather than hitting the network, so this
  // stays a deterministic, offline contract test of the download -> store -> insert -> respond path
  // and the fire-and-forget ping. Live Unsplash wiring is exercised manually (curl) per the task report.
  it('imports an image from a url into uploads, matching the fork\'s expected { data: [...] } shape', async () => {
    const pngBuffer = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082',
      'hex'
    );
    const pngArrayBuffer = new Uint8Array(pngBuffer).buffer;
    const originalFetch = global.fetch;
    const pingCalls: string[] = [];

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://dl.example.com/download-ping') {
        pingCalls.push(url);
        return { ok: true } as Response;
      }
      return {
        ok: true,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () => pngArrayBuffer
      } as unknown as Response;
    }) as unknown as typeof fetch;

    try {
      const res = await request(app)
        .post('/api/editor/your-uploads/import-url')
        .set('Cookie', cookie)
        .send({
          url: 'https://images.example.com/photo.png',
          downloadLocationUrl: 'https://dl.example.com/download-ping'
        });

      expect(res.status).toBe(201);
      expect(Array.isArray(res.body.data)).toBe(true);
      const item = res.body.data[0];
      expect(typeof item.id).toBe('number');
      expect(typeof item.documentId).toBe('string');
      expect(item.img.url).toContain(`company-${companyId}/editor-images/`);
      expect(item.img.mime).toBe('image/png');

      const row = await pool.query<{ company_id: string; kind: string }>(
        'SELECT company_id, kind FROM uploads WHERE id = $1',
        [item.documentId]
      );
      expect(row.rows).toHaveLength(1);
      expect(row.rows[0].company_id).toBe(companyId);
      expect(row.rows[0].kind).toBe('image');

      // The download ping is fire-and-forget; give the unawaited promise a tick to run.
      await new Promise((resolve) => setImmediate(resolve));
      expect(pingCalls).toContain('https://dl.example.com/download-ping');

      await pool.query('DELETE FROM uploads WHERE id = $1', [item.documentId]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('rejects import-url when the fetched url is not an image (400)', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => ({
      ok: true,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/html' : null) },
      arrayBuffer: async () => new ArrayBuffer(0)
    })) as unknown as typeof fetch;

    try {
      const res = await request(app)
        .post('/api/editor/your-uploads/import-url')
        .set('Cookie', cookie)
        .send({ url: 'https://example.com/not-an-image' });
      expect(res.status).toBe(400);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('refuses to remove an upload belonging to another company (404)', async () => {
    // seedTemplateFixture's own fixture upload (background.png) belongs to `companyId`;
    // create a second, unrelated company+upload and ensure our user cannot delete it.
    const other = await seedTemplateFixture();
    const otherUpload = await pool.query<{ id: string }>(
      `INSERT INTO uploads (company_id, original_name, stored_path, kind, created_by)
       VALUES ($1, 'other.png', '/tmp/fixtures/other.png', 'image', $2)
       RETURNING id`,
      [other.companyId, other.userId]
    );
    const otherDocumentId = otherUpload.rows[0].id;

    const res = await request(app).delete(`/api/editor/your-uploads/remove/${otherDocumentId}`).set('Cookie', cookie);
    expect(res.status).toBe(404);

    const stillThere = await pool.query('SELECT id FROM uploads WHERE id = $1', [otherDocumentId]);
    expect(stillThere.rows).toHaveLength(1);
  });

  // CRITICAL regression (Task 10 code review): certificate-template BACKGROUND images are also
  // `uploads` rows with `kind = 'image'`, and `certificate_templates.background_upload_id` is
  // `NOT NULL REFERENCES uploads(id) ON DELETE CASCADE`. Before the fix, the editor's own-company
  // "Your Uploads" endpoints matched on `company_id + kind='image'` alone, so a template's
  // background was (a) listed in the editor gallery and (b) deletable there — and deleting it
  // would cascade-delete the entire certificate_templates row, silently destroying a live template.
  // This proves both endpoints now scope to editor uploads (stored under `editor-images/`) only,
  // and a certificate template's background can never be nuked through this surface.
  it('never lists or lets a same-company caller delete a certificate template\'s background upload (no cascade delete)', async () => {
    const fixture = await seedTemplateFixture();
    const templateOwnerCookie = signSessionCookie({
      id: fixture.userId,
      companyId: fixture.companyId,
      role: 'company_admin',
      email: 'template-owner@example.com',
      name: 'Template Owner'
    });

    const templateRow = await pool.query<{ background_upload_id: string }>(
      'SELECT background_upload_id FROM certificate_templates WHERE id = $1',
      [fixture.templateId]
    );
    expect(templateRow.rows).toHaveLength(1);
    const backgroundUploadId = templateRow.rows[0].background_upload_id;

    // 1. The background upload must never appear in the editor's "Your Uploads" gallery.
    const listRes = await request(app)
      .get('/api/editor/your-uploads/get-user-images')
      .set('Cookie', templateOwnerCookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((i: { documentId: string }) => i.documentId === backgroundUploadId)).toBe(false);

    // 2. Attempting to remove it (as the SAME company that owns the template) must 404, not delete.
    const removeRes = await request(app)
      .delete(`/api/editor/your-uploads/remove/${backgroundUploadId}`)
      .set('Cookie', templateOwnerCookie);
    expect(removeRes.status).toBe(404);

    // 3. Load-bearing: the certificate_templates row must still exist — proving the uploads row
    // (and thus the ON DELETE CASCADE) was never touched.
    const templateStillThere = await pool.query('SELECT id FROM certificate_templates WHERE id = $1', [
      fixture.templateId
    ]);
    expect(templateStillThere.rows).toHaveLength(1);

    // ...and the uploads row backing it is untouched too.
    const uploadStillThere = await pool.query('SELECT id FROM uploads WHERE id = $1', [backgroundUploadId]);
    expect(uploadStillThere.rows).toHaveLength(1);
  });
});
