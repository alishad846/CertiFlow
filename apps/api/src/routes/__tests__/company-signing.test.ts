import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import forge from 'node-forge';
import { createApp } from '../../app';
import { env } from '../../config/env';
import { seedTemplateFixture } from '../../services/__tests__/helpers';

function signSessionCookie(user: { id: string; companyId: string | null }) {
  const token = jwt.sign(
    { companyId: user.companyId, role: 'company_admin', email: 'dsc@example.com', name: 'DSC Admin', tokenVersion: 0 },
    env.JWT_SECRET,
    { subject: user.id, expiresIn: '1h' }
  );
  return `token=${token}`;
}

function makeSelfSignedP12(passphrase: string, cn = 'Acme HR'): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);
  cert.setSubject([{ name: 'commonName', value: cn }]);
  cert.setIssuer([{ name: 'commonName', value: cn }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, { algorithm: '3des' });
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary');
}

describe('/company-signing routes', () => {
  const app = createApp();
  let cookie: string;

  beforeAll(async () => {
    const fixture = await seedTemplateFixture();
    cookie = signSessionCookie({ id: fixture.userId, companyId: fixture.companyId });
  });

  it('uploads a DSC, returns metadata (no key bytes), then deletes it', async () => {
    const p12 = makeSelfSignedP12('pw123', 'Northwind HR');
    const put = await request(app)
      .put('/company-signing')
      .set('Cookie', cookie)
      .field('passphrase', 'pw123')
      .field('autoSign', 'true')
      .attach('file', p12, 'company.p12');
    expect(put.status).toBe(201);
    expect(put.body.dsc.subjectCn).toBe('Northwind HR');
    expect(put.body.dsc.enabled).toBe(true);
    expect(JSON.stringify(put.body)).not.toMatch(/ciphertext|p12_/);

    const get = await request(app).get('/company-signing').set('Cookie', cookie);
    expect(get.status).toBe(200);
    expect(get.body.dsc.subjectCn).toBe('Northwind HR');

    const del = await request(app).delete('/company-signing').set('Cookie', cookie);
    expect(del.status).toBe(200);

    const after = await request(app).get('/company-signing').set('Cookie', cookie);
    expect(after.body.dsc).toBeNull();
  });

  it('rejects a wrong passphrase with 400', async () => {
    const p12 = makeSelfSignedP12('correct');
    const put = await request(app)
      .put('/company-signing')
      .set('Cookie', cookie)
      .field('passphrase', 'incorrect')
      .attach('file', p12, 'company.p12');
    expect(put.status).toBe(400);
  });

  it('requires auth (401 without cookie)', async () => {
    const res = await request(app).get('/company-signing');
    expect(res.status).toBe(401);
  });
});
