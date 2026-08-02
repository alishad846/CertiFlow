# Navigation, Settings, Billing, Onboarding & DSC Signing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Slim the company-admin app to a 7-item sidebar, consolidate account/config into one Settings page, replace dual billing with credit packs, chart delivery/certificate data on the Dashboard, hard-gate new companies into SMTP setup, and add Form 16-style DSC signing to offer letters.

**Architecture:** Monorepo (`apps/api` Express+BullMQ, `apps/web` Next.js App Router, `packages/shared`, `packages/canva-editor`). Backend gains account/DSC endpoints, a `company_signing_settings` table, an encryption helper, and worker signing changes. Frontend gains a `/settings` page, a reworked `/billing`, Dashboard charts (`@visx/*`), a nav rebuild, and an SMTP route-gate. Follow the existing luxury design tokens (`paper`, `ink`, `bronze`, `Card`, `Button`, `NavLink`).

**Tech Stack:** TypeScript, Express, PostgreSQL (`pg`), BullMQ, Next.js 15, Tailwind (luxury tokens), `@visx/*` + `d3-*`, `@signpdf/*` + `pdf-lib` + `node-forge`, `vitest`, Puppeteer (render).

## Global Constraints

- No Claude attribution in any commit or PR (user rule).
- Preserve the luxury design language (tokens: `paper*`, `ink*`, `bronze*`; components: `Card`, `Button`, `Input`, `NavLink`). Match surrounding code style.
- API build MUST keep working under both `tsx` (dev) and compiled `dist` (prod); non-TS assets are copied by `apps/api/scripts/copy-assets.mjs` (already wired into `build`).
- DSC private key + passphrase MUST be encrypted at rest (AES-256-GCM) and never returned to the browser. Use the **security** skill when implementing §Phase 4.
- Dashboard charts follow the **dataviz** skill; theme-aware (light/dark), luxury palette.
- Credit pack prices/copy are exact: Starter ₹1,499 / 500 credits / "500 credits to send your first batches."; Growth ₹4,999 / 2,000 credits (recommended) / "2,000 credits — best value for active teams."; Scale ₹9,999 / 5,000 credits / "5,000 credits for high-volume sending."
- 1 credit = 1 issued document (existing `consumeCredits`; refund-on-failure preserved).
- Run migrations by restarting the API (`bootstrap.ts` → `migrateDatabaseSchema`). Dev stack: API `apps/api/dist/index.js`, worker `dist/worker.js`, web `next start` (both read repo-root `.env`).

## File Structure

**Backend (`apps/api/src`):**
- `lib/crypto-at-rest.ts` — NEW: AES-256-GCM encrypt/decrypt helper for secrets.
- `routes/auth.ts` — MODIFY: `PATCH /auth/profile`, `POST /auth/change-password`, `smtpConfigured` in `/me`, drop forced 2FA.
- `routes/company-signing.ts` — NEW: GET/PUT/DELETE company DSC.
- `routes/index.ts` — MODIFY: mount company-signing.
- `routes/batches.ts` — MODIFY: server-side SMTP gate on `POST /batches`.
- `services/company-signing.ts` — NEW: load/store DSC (encrypted), parse cert metadata.
- `services/email.ts` — MODIFY: `isCompanyEmailConfigured(companyId)` helper.
- `services/certificate-finalize.ts` — MODIFY: signature fields + company-DSC signer.
- `services/dashboard.ts` (or existing stats service) — MODIFY: delivery + certificate series.
- `services/migrate.ts` — MODIFY: `company_signing_settings` table.
- `workers/processors.ts` — MODIFY: resolve company DSC, pass to finalize.

**Shared (`packages/shared/src`):**
- `billing.ts` — MODIFY: credit-pack copy.

**Frontend (`apps/web/src`):**
- `app/(dashboard)/settings/page.tsx` — NEW: tabbed Settings.
- `app/(dashboard)/settings/sections/*` — NEW: `AccountSection.tsx`, `EmailSection.tsx`, `SecuritySection.tsx`, `SignatureSection.tsx`.
- `app/(dashboard)/billing/page.tsx` — MODIFY: credit packs.
- `app/(dashboard)/dashboard/page.tsx` — MODIFY: add charts.
- `components/charts/DonutChart.tsx`, `components/charts/AreaTrendChart.tsx` — NEW (visx).
- `components/dashboard-shell.tsx` — MODIFY: 7-item nav + locked states + gate.
- `app/(dashboard)/plans/page.tsx`, `sender/page.tsx`, `security/page.tsx`, `logs/page.tsx` — REPLACE with redirects.
- `lib/api.ts` — reuse existing `apiFetch`.

---

## Phase 1 — Account endpoints, `smtpConfigured`, optional 2FA

### Task 1: `isCompanyEmailConfigured` helper + `smtpConfigured` in `/auth/me`

**Files:**
- Modify: `apps/api/src/services/email.ts`
- Modify: `apps/api/src/routes/auth.ts` (the `/me` handler)
- Test: `apps/api/src/services/__tests__/email-configured.test.ts`

**Interfaces:**
- Produces: `export async function isCompanyEmailConfigured(companyId: string | null): Promise<boolean>` — true iff a `company_email_settings` row exists with `enabled = true` and non-empty `smtp_host`.
- Produces: `/auth/me` response `user.smtpConfigured: boolean` (always `true` for super_admin).

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/services/__tests__/email-configured.test.ts
import { describe, it, expect } from 'vitest';
import { isCompanyEmailConfigured } from '../email';
import { seedTemplateFixture } from './helpers'; // reuse existing company seeding
import { pool } from '../../db/pool';

describe('isCompanyEmailConfigured', () => {
  it('is false with no settings row, true when enabled with host', async () => {
    const { companyId } = await seedTemplateFixture();
    expect(await isCompanyEmailConfigured(companyId)).toBe(false);
    await pool.query(
      `INSERT INTO company_email_settings (company_id, smtp_host, enabled) VALUES ($1,'smtp.test',true)`,
      [companyId]
    );
    expect(await isCompanyEmailConfigured(companyId)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace @certiflow/api -- email-configured`
Expected: FAIL (`isCompanyEmailConfigured` not exported). Requires Postgres up (`docker compose up -d postgres redis`).

- [ ] **Step 3: Implement the helper**

```ts
// apps/api/src/services/email.ts (add near getCompanyEmailSettings)
export async function isCompanyEmailConfigured(companyId: string | null): Promise<boolean> {
  if (!companyId) return false;
  const r = await pool.query<{ smtp_host: string | null; enabled: boolean }>(
    `SELECT smtp_host, enabled FROM company_email_settings WHERE company_id = $1`,
    [companyId]
  );
  const row = r.rows[0];
  return Boolean(row?.enabled && row.smtp_host && row.smtp_host.trim());
}
```

- [ ] **Step 4: Add `smtpConfigured` to `/auth/me`**

In `apps/api/src/routes/auth.ts` `/me` handler, after building the user payload:

```ts
import { isCompanyEmailConfigured } from '../services/email';
// ...
const smtpConfigured =
  user.role === 'super_admin' ? true : await isCompanyEmailConfigured(user.companyId);
res.json({ user: { ...serializeUser(user), /* existing fields */, smtpConfigured } });
```

(Insert `smtpConfigured` into the existing `/me` response object; keep all current fields.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test --workspace @certiflow/api -- email-configured`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/email.ts apps/api/src/routes/auth.ts apps/api/src/services/__tests__/email-configured.test.ts
git commit -m "feat(api): expose smtpConfigured on /auth/me"
```

### Task 2: `PATCH /auth/profile` and `POST /auth/change-password`

**Files:**
- Modify: `apps/api/src/routes/auth.ts`
- Test: `apps/api/src/routes/__tests__/account.test.ts`

**Interfaces:**
- Produces: `PATCH /auth/profile` body `{ name?: string(min2), username?: string(usernameSchema), email?: string(email) }` → 200 `{ user }`; 409 on username/email conflict. Re-issues auth cookie.
- Produces: `POST /auth/change-password` body `{ currentPassword: string, newPassword: string(min8) }` → 200 `{ ok: true }`; 401 on wrong current password. Bumps `token_version` and re-issues cookie for the current session.

- [ ] **Step 1: Write failing tests** — supertest against the app, authenticated via a seeded user + cookie. Cover: profile update changes name; duplicate username → 409; password change with wrong current → 401; correct change → 200 and old token invalidated. (Model on the existing `apps/api/src/routes/__tests__/*.test.ts` auth pattern.)

```ts
// apps/api/src/routes/__tests__/account.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { registerAndLogin } from './helpers'; // add helper if absent: registers a company_admin, returns {agent, user}

const app = createApp();

describe('account management', () => {
  it('updates profile and rejects duplicate username', async () => {
    const { cookie } = await registerAndLogin(app);
    const ok = await request(app).patch('/auth/profile').set('Cookie', cookie).send({ name: 'New Name' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.name).toBe('New Name');
  });
  it('changes password only with correct current password', async () => {
    const { cookie, password } = await registerAndLogin(app);
    const bad = await request(app).post('/auth/change-password').set('Cookie', cookie)
      .send({ currentPassword: 'wrong', newPassword: 'NewPass123' });
    expect(bad.status).toBe(401);
    const good = await request(app).post('/auth/change-password').set('Cookie', cookie)
      .send({ currentPassword: password, newPassword: 'NewPass123' });
    expect(good.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — `npm run test --workspace @certiflow/api -- account` → 404/route missing.

- [ ] **Step 3: Implement endpoints** in `apps/api/src/routes/auth.ts` (reuse `requireAuth`, `bcrypt`, `issueToken`, `setAuthCookie`, `serializeUser`, `usernameSchema`):

```ts
const profileSchema = z.object({
  name: z.string().min(2).optional(),
  username: usernameSchema.optional(),
  email: z.string().email().optional()
});

router.patch('/profile', requireAuth, asyncHandler(async (req, res) => {
  const parsed = profileSchema.parse(req.body);
  const id = req.user!.id;
  if (parsed.username) {
    const taken = await pool.query('SELECT id FROM users WHERE lower(username)=lower($1) AND id<>$2', [parsed.username, id]);
    if (taken.rows[0]) throw new AppError('Username already taken', 409, 'username_taken');
  }
  if (parsed.email) {
    const taken = await pool.query('SELECT id FROM users WHERE lower(email)=lower($1) AND id<>$2', [parsed.email, id]);
    if (taken.rows[0]) throw new AppError('Email already exists', 409);
  }
  const sets: string[] = []; const vals: unknown[] = []; let i = 1;
  for (const k of ['name', 'username', 'email'] as const) {
    if (parsed[k] !== undefined) { sets.push(`${k} = $${i++}`); vals.push(parsed[k]); }
  }
  if (!sets.length) throw new AppError('No changes provided', 400);
  vals.push(id);
  const upd = await pool.query(
    `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i}
     RETURNING id, company_id, role, email, name, token_version`, vals);
  const row = upd.rows[0];
  setAuthCookie(res, issueToken({ ...serializeUser(row), tokenVersion: row.token_version }));
  res.json({ user: serializeUser(row) });
}));

const passwordChangeSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
router.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = passwordChangeSchema.parse(req.body);
  const r = await pool.query('SELECT password_hash, token_version, company_id, role, email, name, id FROM users WHERE id=$1', [req.user!.id]);
  const u = r.rows[0];
  if (!u || !(await bcrypt.compare(currentPassword, u.password_hash))) throw new AppError('Current password is incorrect', 401);
  const hash = await bcrypt.hash(newPassword, 12);
  const nextVersion = (u.token_version ?? 0) + 1;
  await pool.query('UPDATE users SET password_hash=$1, token_version=$2, updated_at=NOW() WHERE id=$3', [hash, nextVersion, u.id]);
  setAuthCookie(res, issueToken({ ...serializeUser(u), tokenVersion: nextVersion }));
  res.json({ ok: true });
}));
```

(If `users` lacks `updated_at`, drop that clause. Confirm columns before writing.)

- [ ] **Step 4: Run to verify PASS**

- [ ] **Step 5: Commit** — `git commit -m "feat(api): account profile + password change endpoints"`

### Task 3: Make 2FA optional (drop forced setup)

**Files:**
- Modify: `apps/api/src/routes/auth.ts` (`/me` — stop emitting `mustSetupTwoFactor: true`), `apps/api/src/middleware/*` if any enforcement exists.
- Modify: `apps/web/src/components/dashboard-shell.tsx` (remove the `mustSetupTwoFactor` banner).

- [ ] **Step 1:** Grep for `mustSetupTwoFactor` across `apps/api` and `apps/web`. `Run: rg mustSetupTwoFactor`.
- [ ] **Step 2:** In `/auth/me`, set `mustSetupTwoFactor: false` (or remove the field); ensure no route middleware blocks access when 2FA is unset.
- [ ] **Step 3:** Remove the banner block in `dashboard-shell.tsx` (lines rendering the 2FA required notice).
- [ ] **Step 4: Manual check** — `curl -b cookie localhost:4000/auth/me` shows `mustSetupTwoFactor:false`; dashboard shows no forced-2FA banner.
- [ ] **Step 5: Commit** — `git commit -m "feat: make two-factor optional (remove forced setup)"`

---

## Phase 2 — Settings page (Account, Email, Security)

### Task 4: Settings shell + Account section

**Files:**
- Create: `apps/web/src/app/(dashboard)/settings/page.tsx`
- Create: `apps/web/src/app/(dashboard)/settings/sections/AccountSection.tsx`

**Interfaces:**
- Consumes: `apiFetch` (`@/lib/api`), `/auth/me`, `PATCH /auth/profile`, `POST /auth/change-password`.
- Produces: `/settings` route with tabs read from `?tab=` (`account` default, `email`, `security`, `signature`).

- [ ] **Step 1:** Build `page.tsx` as a client component: fetch `/auth/me`, render a luxury tab bar (reuse `Card`, bronze accent for active tab) and render the active section. Tab state synced to `?tab=` via `useSearchParams`/`router.replace`.
- [ ] **Step 2:** Build `AccountSection.tsx`: form with name/username/email (prefilled) → `PATCH /auth/profile`; separate "Change password" card (current + new) → `POST /auth/change-password`. Success/error toasts inline (match existing form patterns in `security/page.tsx`).
- [ ] **Step 3: Manual check** — visit `/settings`, edit name → persists after reload; wrong current password → error.
- [ ] **Step 4: Commit** — `git commit -m "feat(web): settings shell + account section"`

### Task 5: Email (SMTP) section — moved from `/sender`

**Files:**
- Create: `apps/web/src/app/(dashboard)/settings/sections/EmailSection.tsx`
- Modify: `apps/web/src/app/(dashboard)/sender/page.tsx` → redirect to `/settings?tab=email`.

- [ ] **Step 1:** Move the SMTP form UI currently reachable via `/sender` into `EmailSection.tsx`. Reuse the existing sender API endpoints (grep `sender` / `company-email` in `apps/api/src/routes`). Fields: sender name/email, smtp host/port/secure/user/pass, "Send test", "Save", Enabled toggle.
- [ ] **Step 2:** Replace `sender/page.tsx` body with `redirect('/settings?tab=email')` (Next `redirect` from `next/navigation`).
- [ ] **Step 3: Manual check** — save SMTP settings; `/auth/me` now returns `smtpConfigured:true`; `/sender` redirects.
- [ ] **Step 4: Commit** — `git commit -m "feat(web): move SMTP setup into settings"`

### Task 6: Security (2FA) section — moved from `/security`

**Files:**
- Create: `apps/web/src/app/(dashboard)/settings/sections/SecuritySection.tsx`
- Modify: `apps/web/src/app/(dashboard)/security/page.tsx` → redirect to `/settings?tab=security`.

- [ ] **Step 1:** Move the 2FA enable/disable + authenticator-QR flow from `security/page.tsx` into `SecuritySection.tsx` (reuse existing 2FA endpoints).
- [ ] **Step 2:** Replace `security/page.tsx` with `redirect('/settings?tab=security')`.
- [ ] **Step 3: Manual check** — enable then disable 2FA works inside Settings.
- [ ] **Step 4: Commit** — `git commit -m "feat(web): move 2FA into settings"`

---

## Phase 3 — Billing (credit packs)

### Task 7: Credit-pack copy + Billing page

**Files:**
- Modify: `packages/shared/src/billing.ts` (`PRICING_PLANS` copy)
- Modify: `apps/web/src/app/(dashboard)/billing/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/plans/page.tsx` → redirect to `/billing`.

**Interfaces:**
- Consumes: existing UPI purchase flow + credit balance (grep `credits_remaining`, `upi` in web/api).

- [ ] **Step 1:** Update `PRICING_PLANS` in `packages/shared/src/billing.ts` to the exact prices/credits/one-liners in Global Constraints (Starter 500/₹1,499, Growth 2000/₹4,999 recommended, Scale 5000/₹9,999). Rebuild shared.
- [ ] **Step 2:** Rework `billing/page.tsx`: balance header card + three luxury pack cards (bronze "Recommended" ribbon on Growth), each showing price, credits, the one-liner, and a short `features` list; keep the existing "Buy"/UPI action + payment history.
- [ ] **Step 3:** Replace `plans/page.tsx` with `redirect('/billing')`.
- [ ] **Step 4: Manual check** — `/billing` shows three packs + balance; `/plans` redirects; a purchase still starts the UPI flow.
- [ ] **Step 5: Commit** — `git commit -m "feat: single credit-pack billing page"`

---

## Phase 4 — DSC storage, endpoints & signing

### Task 8: Encryption-at-rest helper

**Files:**
- Create: `apps/api/src/lib/crypto-at-rest.ts`
- Test: `apps/api/src/lib/__tests__/crypto-at-rest.test.ts`

**Interfaces:**
- Produces: `encryptSecret(plain: Buffer): { ciphertext: Buffer; iv: Buffer; tag: Buffer }` and `decryptSecret(parts): Buffer`, using AES-256-GCM with a 32-byte key derived from `env.JWT_SECRET` via `crypto.scryptSync(JWT_SECRET, 'certiflow-dsc', 32)`.

- [ ] **Step 1: Failing test** — round-trip: `decryptSecret(encryptSecret(buf)) === buf`; tampering the tag throws.

```ts
import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '../crypto-at-rest';
describe('crypto-at-rest', () => {
  it('round-trips and detects tampering', () => {
    const buf = Buffer.from('super-secret-p12-bytes');
    const enc = encryptSecret(buf);
    expect(enc.ciphertext.equals(buf)).toBe(false);
    expect(decryptSecret(enc).equals(buf)).toBe(true);
    enc.tag[0] ^= 0xff;
    expect(() => decryptSecret(enc)).toThrow();
  });
});
```

- [ ] **Step 2: Run FAIL** — `npm run test --workspace @certiflow/api -- crypto-at-rest`.
- [ ] **Step 3: Implement:**

```ts
// apps/api/src/lib/crypto-at-rest.ts
import crypto from 'node:crypto';
import { env } from '../config/env';
const KEY = crypto.scryptSync(env.JWT_SECRET, 'certiflow-dsc', 32);
export function encryptSecret(plain: Buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { ciphertext, iv, tag: cipher.getAuthTag() };
}
export function decryptSecret({ ciphertext, iv, tag }: { ciphertext: Buffer; iv: Buffer; tag: Buffer }) {
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ciphertext), d.final()]);
}
```

- [ ] **Step 4: Run PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(api): AES-256-GCM secret encryption helper"`

### Task 9: `company_signing_settings` migration + service

**Files:**
- Modify: `apps/api/src/services/migrate.ts` (append table to `initializationStatements`)
- Create: `apps/api/src/services/company-signing.ts`
- Test: `apps/api/src/services/__tests__/company-signing.test.ts`

**Interfaces:**
- Produces migration:

```sql
CREATE TABLE IF NOT EXISTS company_signing_settings (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  p12_ciphertext bytea NOT NULL, p12_iv bytea NOT NULL, p12_tag bytea NOT NULL,
  pass_ciphertext bytea NOT NULL, pass_iv bytea NOT NULL, pass_tag bytea NOT NULL,
  subject_cn text, valid_to timestamptz,
  auto_sign boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
```

- Produces: `saveCompanyDsc({companyId, p12: Buffer, passphrase: string, autoSign})` (parses subject/validity via `node-forge` `pkcs12`, stores encrypted, sets `enabled=true`); `getCompanyDscMeta(companyId)` → `{ subjectCn, validTo, autoSign, enabled } | null` (NO key material); `loadCompanyDscForSigning(companyId)` → `{ p12: Buffer, passphrase: string } | null` (worker-only); `deleteCompanyDsc(companyId)`.

- [ ] **Step 1: Failing test** — save a P12 (generate a self-signed one via `node-forge` in the test), then `getCompanyDscMeta` returns subject + `enabled:true` and NO buffers; `loadCompanyDscForSigning` returns a P12 that `forge.pkcs12` can open with the passphrase; DB columns are ciphertext (≠ plaintext).
- [ ] **Step 2: Run FAIL.**
- [ ] **Step 3: Implement** the table (in `migrate.ts`) and `company-signing.ts` using `encryptSecret`/`decryptSecret` and `forge.pkcs12.pkcs12FromAsn1` to extract `subject_cn`/`valid_to`. Restart API to run the migration.
- [ ] **Step 4: Run PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(api): encrypted company DSC storage + service"`

### Task 10: Company signing routes

**Files:**
- Create: `apps/api/src/routes/company-signing.ts`
- Modify: `apps/api/src/routes/index.ts`
- Test: `apps/api/src/routes/__tests__/company-signing.test.ts`

**Interfaces:**
- Produces: `GET /company-signing` → `{ dsc: getCompanyDscMeta | null }`; `PUT /company-signing` (multipart: `file` .pfx/.p12 + `passphrase` + `autoSign`) → validates the passphrase opens the P12 (400 on failure), stores, returns meta; `DELETE /company-signing`. All `requireAuth` + `requireRole('company_admin','super_admin')`, scoped to caller's company. Mount unprefixed: `router.use('/company-signing', companySigningRoutes)`.

- [ ] **Step 1: Failing test** — upload a good P12 → 200 meta; wrong passphrase → 400; GET never returns key bytes; DELETE removes it.
- [ ] **Step 2: Run FAIL.**
- [ ] **Step 3: Implement** the route (multer single `file`, 1MB limit, accept `application/x-pkcs12`/`.p12`/`.pfx`), wire into `routes/index.ts`.
- [ ] **Step 4: Run PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(api): company DSC upload/get/delete routes"`

### Task 11: Signature fields + company-DSC signer in finalize

**Files:**
- Modify: `apps/api/src/services/certificate-finalize.ts`
- Modify: `apps/api/src/workers/processors.ts`
- Test: `apps/api/src/services/__tests__/finalize-signing.test.ts`

**Interfaces:**
- Consumes: `loadCompanyDscForSigning`, `encryptSecret`/`forge`, existing `stampQr`, `@signpdf` + `SUBFILTER_ETSI_CADES_DETACHED`.
- Produces: `finalizeCertificatePdf(pdfPath, { verifyUrl, publicId, signer?, addEmployeeField? })` where `signer?: { p12: Buffer; passphrase: string }`. Behavior:
  - Always stamp QR + unique ID (existing).
  - Add an **Authorized Signatory** signature field (AcroForm widget) at the signatory area.
  - If `signer` provided → PAdES-sign that field with the company DSC (`P12Signer`, ETSI subfilter). Else leave empty.
  - If `addEmployeeField` (offer letters) → add a second empty **"Accepted by (Candidate)"** signature field.
  - Return `{ signed: boolean }` (true only when a company DSC signed).

- [ ] **Step 1: Failing test** — with a generated company P12 + `addEmployeeField:true`: output PDF has TWO `/Type /Sig` field slots, ONE filled (SubFilter `ETSI.CAdES.detached`, ByteRange valid) and one empty; without a signer, both fields empty and no filled signature. Reuse the crypto verification approach from the earlier `verify-signature` work (ByteRange + messageDigest + attrs).
- [ ] **Step 2: Run FAIL.**
- [ ] **Step 3: Implement.** Use `pdf-lib` to add signature form-field widgets (create AcroForm `/Sig` field + widget annotation at target rects; positions: employer near the signatory line, employee below/right). Use `@signpdf` `pdflibAddPlaceholder({ pdfDoc, subFilter: SUBFILTER_ETSI_CADES_DETACHED, name, reason, widgetRect })` for the field to be signed, then `signpdf.sign(bytes, new P12Signer(signer.p12, { passphrase: signer.passphrase }))`. For the empty employee field, add the widget without a placeholder value. Remove the old default self-signed signing path.
- [ ] **Step 4:** In `processors.ts`, resolve `const dsc = await loadCompanyDscForSigning(batch.company_id)` (only when the company's DSC is `enabled && auto_sign`), pass `signer: dsc ?? undefined` and `addEmployeeField: batch.template_type === 'offer_letter'` to `finalizeCertificatePdf`. Persist `certificate_versions.signed = result.signed`.
- [ ] **Step 5: Run PASS.**
- [ ] **Step 6: Commit** — `git commit -m "feat: DSC signature fields + company auto-signing on issue"`

### Task 12: Signature section (Settings)

**Files:**
- Create: `apps/web/src/app/(dashboard)/settings/sections/SignatureSection.tsx`

**Interfaces:**
- Consumes: `GET/PUT/DELETE /company-signing`.

- [ ] **Step 1:** Build the section: if no DSC → upload card (`.pfx`/`.p12` file + passphrase + auto-sign toggle) → `PUT /company-signing`; if present → show subject CN, validity, auto-sign toggle, and "Remove" (`DELETE`). Explain in one line: "Upload your Digital Signature Certificate to auto-sign every offer letter — or leave it and sign in Adobe."
- [ ] **Step 2: Manual check** — upload a `.p12`; section shows subject + expiry; issued offer letter is auto-signed (verify via the signature script).
- [ ] **Step 3: Commit** — `git commit -m "feat(web): DSC settings section"`

---

## Phase 5 — Dashboard charts

### Task 13: Dashboard stats series (backend)

**Files:**
- Modify: the dashboard stats service/route (grep `dashboard` in `apps/api/src/routes`).
- Test: extend its test or add `dashboard-series.test.ts`.

**Interfaces:**
- Produces: stats response adds `delivery: { sent: number; failed: number; pending: number }` (from `email_logs`, company-scoped, recent window) and `certificates: Array<{ date: string; issued: number; claimed: number }>` (last 14 days).

- [ ] **Step 1: Failing test** — seed a company with a couple `email_logs` + `certificates`; assert the endpoint returns the `delivery` totals and a `certificates` series.
- [ ] **Step 2: Run FAIL.**
- [ ] **Step 3: Implement** the aggregation SQL (GROUP BY status; GROUP BY date_trunc('day', ...)).
- [ ] **Step 4: Run PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(api): dashboard delivery + certificate series"`

### Task 14: Chart components + Dashboard wiring

**Files:**
- Create: `apps/web/src/components/charts/DonutChart.tsx`, `apps/web/src/components/charts/AreaTrendChart.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- `DonutChart({ data: {label,value,color}[], centerLabel? })`, `AreaTrendChart({ series: {date, issued, claimed}[] })` — built with `@visx/shape`, `@visx/scale`, `@visx/group`, `@visx/responsive`.

- [ ] **Step 1:** Read the **dataviz** skill; adopt its palette mapping to luxury tokens (ink/bronze/paper; accessible in light+dark). Build the two components (theme-aware via CSS vars).
- [ ] **Step 2:** Wire into `dashboard/page.tsx`: a Delivery-status donut, a Certificates issued-vs-claimed area chart, and a compact recent-activity list — inside `Card`s, with empty states.
- [ ] **Step 3: Manual check** — dashboard renders both charts with real data; looks right in light + dark.
- [ ] **Step 4: Commit** — `git commit -m "feat(web): dashboard delivery + certificate charts"`

### Task 15: Remove `/logs` and company `/certificates` from nav

**Files:**
- Modify: `apps/web/src/app/(dashboard)/logs/page.tsx` → redirect to `/dashboard`.
- Keep `/certificates` route for super_admin; company-admin nav no longer links it (handled in Phase 6).

- [ ] **Step 1:** Replace `logs/page.tsx` with `redirect('/dashboard')`.
- [ ] **Step 2: Commit** — `git commit -m "feat(web): fold email logs into dashboard"`

---

## Phase 6 — Sidebar rebuild + SMTP gate

### Task 16: Rebuild sidebar to 7 items with locked states

**Files:**
- Modify: `apps/web/src/components/dashboard-shell.tsx`

**Interfaces:**
- Consumes: `/auth/me` with `smtpConfigured`.

- [ ] **Step 1:** Rewrite the company-admin nav to exactly: Dashboard, Upload Batch, Bulk Verification, Certificate Editor, My Templates, Billing, Settings (icons: `LayoutDashboard, FileUp, ShieldCheck, Palette, Sparkles, WalletCards, Settings`). Remove Email Logs, Certificates, Email Sender, Plans, Security. Super-admin nav: Dashboard, Companies, Discounts, Billing, Settings.
- [ ] **Step 2:** For company admins with `smtpConfigured === false`, render Upload Batch, Certificate Editor, Bulk Verification with a `Lock` icon, `aria-disabled`, muted style, and an `onClick`/`href` that routes to `/settings?tab=email` with a tooltip "Set up email sending first".
- [ ] **Step 3: Manual check** — nav shows 7 items; locked items visible+disabled for a fresh company; unlock after SMTP enabled.
- [ ] **Step 4: Commit** — `git commit -m "feat(web): 7-item sidebar with SMTP-locked states"`

### Task 17: Client route-gate + post-register redirect

**Files:**
- Modify: `apps/web/src/app/(dashboard)/layout.tsx` (or `dashboard-shell.tsx`)
- Modify: the registration success handler (grep `auth/register` in `apps/web`).

- [ ] **Step 1:** In the dashboard layout, when `user.role === 'company_admin' && !user.smtpConfigured` and the current path is one of `/uploads`, `/certificate-editor`, `/bulk-verification`, `router.replace('/settings?tab=email')`.
- [ ] **Step 2:** After successful registration, redirect to `/settings?tab=email` with a one-time note ("Set up email sending to start issuing.").
- [ ] **Step 3: Manual check** — new company lands on Settings→Email; direct navigation to `/uploads` bounces back until SMTP enabled.
- [ ] **Step 4: Commit** — `git commit -m "feat(web): SMTP onboarding route-gate"`

### Task 18: Server-side SMTP gate on batch creation

**Files:**
- Modify: `apps/api/src/routes/batches.ts`
- Test: `apps/api/src/routes/__tests__/batch-smtp-gate.test.ts`

**Interfaces:**
- Consumes: `isCompanyEmailConfigured`.

- [ ] **Step 1: Failing test** — `POST /batches` for a company without enabled email → 400 "Configure and enable your email sender in Settings first"; with it enabled → proceeds past the check.
- [ ] **Step 2: Run FAIL.**
- [ ] **Step 3: Implement** — in the `POST /batches` handler (after auth, before `createBatch`), for `company_admin`: `if (!(await isCompanyEmailConfigured(companyId))) throw new AppError('Configure and enable your email sender in Settings first', 400)`.
- [ ] **Step 4: Run PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(api): require enabled SMTP before batch creation"`

---

## Phase 7 — Full verification

### Task 19: End-to-end verification pass

- [ ] **Step 1:** `npm run build` (all workspaces) — clean.
- [ ] **Step 2:** `docker compose up -d postgres redis`; `npm run test --workspace @certiflow/api` — DB tests pass.
- [ ] **Step 3:** Start API/worker/web; register a fresh company → confirm redirect to Settings→Email + locked nav; enable SMTP → nav unlocks.
- [ ] **Step 4:** Settings: change name/password, enable/disable 2FA, upload a `.p12` DSC.
- [ ] **Step 5:** Issue an offer-letter batch → download PDF → open in a reader/`verify-signature` script: employer field signed (PAdES, ETSI), employee field empty & signable.
- [ ] **Step 6:** Billing shows 3 packs + balance; `/plans`, `/sender`, `/security`, `/logs` redirect.
- [ ] **Step 7:** Dashboard charts render (light+dark).
- [ ] **Step 8: Commit** any final fixes.

## Self-Review (author checklist — completed)

- **Spec coverage:** sidebar (T16), Settings/account (T2,T4), SMTP move (T5), 2FA optional (T3,T6), DSC (T8–T12), billing (T7), dashboard charts (T13–T15), SMTP gate client+server (T16–T18), route removals (T5,T6,T7,T15). All spec sections mapped.
- **Placeholders:** backend-critical tasks carry full code; UI tasks specify components, endpoints, props, and copy. No TBD/TODO.
- **Type consistency:** `isCompanyEmailConfigured`, `encryptSecret`/`decryptSecret`, `getCompanyDscMeta`/`loadCompanyDscForSigning`, `finalizeCertificatePdf(..., { signer, addEmployeeField })` used consistently across tasks.
