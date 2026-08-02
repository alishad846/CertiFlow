# CertiFlow — Navigation, Settings, Billing, Onboarding & DSC Signing

**Date:** 2026-08-02
**Branch:** editor-ui
**Status:** Approved design (pending spec review)

## 1. Goal

Streamline the company-admin experience and add employer/employee digital-signature
(DSC) support to offer letters:

1. Reduce the sidebar to seven items; remove redundant/duplicate entries.
2. Consolidate all account/config controls into a single **Settings** page.
3. Replace the dual billing systems with one **credit-pack** Billing page whose plans
   explain — in one line — what a company gets.
4. Surface the removed "Email Logs" and "Certificates" data as **charts on the Dashboard**.
5. **Hard-gate** new companies into SMTP setup before they can use core features.
6. Add **Form 16-style DSC signing**: employer signs (auto via uploaded DSC or in Adobe);
   the employee counter-signs in Adobe after verification.
7. Preserve the existing **luxury design language** throughout.

## 2. Sidebar

**Company admin — exactly seven items, in order:**
Dashboard · Upload Batch · Bulk Verification · Certificate Editor · My Templates · Billing · Settings.

**Super admin:** Dashboard · Companies · Discounts · Billing · Settings (unchanged admin
tools + new Settings). Super admins are not SMTP-gated and have no Upload/Editor items.

**Removed from nav and folded elsewhere:**
- Email Logs, Certificates → Dashboard charts (§5)
- Email Sender (SMTP) → Settings › Email (§3)
- Security (2FA) → Settings › Security (§3)
- Plans (subscriptions) → merged into Billing as credit packs (§4)

**Locked state (SMTP gate, company admin only):** while `smtpConfigured` is false, the
Upload Batch, Certificate Editor and Bulk Verification items render with a lock icon,
`aria-disabled`, and a tooltip ("Set up email sending first"); clicking routes to
`/settings?tab=email`. Dashboard, Billing and Settings stay active.

Routes `/plans`, `/sender`, `/security`, `/logs`, and the company-facing `/certificates`
list are removed from nav. Their route files are replaced with a redirect to the new
home (`/settings` or `/dashboard`) so old links/bookmarks don't 404.

## 3. Settings (`/settings`) — new consolidated page

One page, luxury cards/tabs, sections scaled to content. Tabs: `account`, `email`,
`security`, `signature` (deep-linkable via `?tab=`).

### 3.1 Account
- Edit **name**, **username**, **email**; **change password**.
- New backend endpoints (all `requireAuth`, self-only):
  - `PATCH /auth/profile` — `{ name?, username?, email? }`; enforces username/email
    uniqueness (case-insensitive), re-issues the auth cookie if identity fields change.
  - `POST /auth/change-password` — `{ currentPassword, newPassword(min 8) }`; verifies
    current hash, bumps `token_version` to invalidate other sessions.

### 3.2 Email (SMTP) — the onboarding-critical section
- Company SMTP profile form (host, port, secure, user, pass, sender name/email),
  "Send test email", "Save", and an **Enabled** toggle. Content moved from `/sender`.
- Reuses the existing `company_email_settings` table + `testCompanyEmailSettings`.
- "Configured" for the gate = a row with `enabled = true` and a non-empty `smtp_host`.

### 3.3 Security (2FA)
- 2FA **enable/disable** with the authenticator QR + verify step. Content moved from
  `/security`.
- **Behavior change:** 2FA becomes optional. The forced `mustSetupTwoFactor` requirement
  and the dashboard banner are removed; the endpoints and enable/disable UI remain.

### 3.4 Digital Signature (DSC) — new
- Upload a company **DSC** (`.pfx`/`.p12`) + passphrase; shows the parsed certificate
  subject/expiry once stored. Toggle: **Auto-sign issued documents with our DSC**.
- The P12 bytes and passphrase are **encrypted at rest** (AES-256-GCM with a key derived
  from a server secret); decrypted only in the worker at signing time. The private key is
  never returned to the browser. Handled per the **security** skill.
- Storage: new table `company_signing_settings`
  `(company_id PK/FK, p12_ciphertext bytea, p12_iv bytea, p12_tag bytea,
    passphrase_ciphertext bytea, passphrase_iv bytea, passphrase_tag bytea,
    subject_cn text, valid_to timestamptz, auto_sign boolean default true,
    enabled boolean default false, created_at, updated_at)`.
- Endpoints: `PUT /company-signing` (upload/replace), `GET /company-signing` (metadata
  only — never the key), `DELETE /company-signing`.

## 4. Billing (`/billing`) — credit packs only

- Header: prominent **current credit balance**.
- Three luxury pack cards, each with a **one-line value** + short feature list, using the
  existing UPI purchase flow and payment-history table:
  - **Starter — ₹1,499** · 500 credits · "500 credits to send your first batches."
  - **Growth — ₹4,999** *(recommended)* · 2,000 credits · "2,000 credits — best value for active teams."
  - **Scale — ₹9,999** · 5,000 credits · "5,000 credits for high-volume sending."
- Source of truth: the existing credits-based `PRICING_PLANS` (`packages/shared/src/billing.ts`);
  refine the `description`/`features` copy to the one-liners above.
- `/plans` (subscriptions) and the `SUBSCRIPTION_TIERS` UI are removed from the product.
  1 credit = 1 issued document (existing `consumeCredits`, refund-on-failure preserved).

## 5. Dashboard (`/dashboard`) — visx charts

Built with the already-installed `@visx/*` + `d3-*`, following the **dataviz** skill and
the luxury palette (ink / bronze / paper). Replaces the removed nav pages:
- **Delivery status** — donut of sent / failed / pending from `email_logs` (recent window).
- **Certificates** — issued vs claimed over time (area or grouped bars) from `certificates`.
- **Recent activity** — compact list of latest batches/issues with status chips.
- Keeps existing headline stat tiles. Data via a dashboard stats endpoint (extend the
  current one to include the delivery + certificate series).

## 6. SMTP onboarding gate

- `/auth/me` gains `smtpConfigured: boolean` (company admins; always true for super admin).
- **After registration:** redirect to `/settings?tab=email` with a one-time onboarding note.
- **Client guard:** in the dashboard layout/shell, a company admin with
  `smtpConfigured === false` who navigates to `/uploads`, `/certificate-editor`, or
  `/bulk-verification` is redirected to `/settings?tab=email`.
- **Server guard:** `POST /batches` (and preview/editor issue paths) reject with a clear
  400 ("Configure and enable your email sender in Settings first") when the company's
  `company_email_settings` is not enabled. The global-SMTP fallback (already implemented)
  stays as a safety net for edge cases but does not bypass this onboarding requirement.

## 7. DSC signing — issue-time behavior

Per **offer-letter** issue (worker `finalizeCertificatePdf`, extended):
1. Always: stamp QR (→ `/verify/{publicId}`) + printed/embedded unique ID; store SHA-256.
2. Add two Adobe-recognized AcroForm **signature fields**:
   - **Authorized Signatory** (employer) — near the signatory line.
   - **Accepted by (Candidate)** (employee) — a second field for counter-signing.
3. If the company has an **enabled DSC with `auto_sign`**: server-side PAdES-sign the
   *employer* field with the company DSC (`@signpdf` + `@signpdf/signer-p12`,
   `SUBFILTER_ETSI_CADES_DETACHED`). Otherwise leave it empty.
4. The **employee** field is always left empty.
5. Result delivered through the existing gated-download flow. The recipient verifies
   (email + OTP), downloads, and signs the employee field in Adobe / a DSC utility
   (supports USB-token DSCs). **Deliver-only** — CertiFlow does not require re-upload or
   track the counter-signature.

**Certificates** (non-offer-letter) get the employer DSC signature if configured, and no
counter-sign field.

**Superseded:** the earlier "make CertiFlow's self-signed signature universal" idea is
dropped. The legal signature now comes from the company DSC or the human in Adobe; the
self-signed dev cert is no longer applied as the document's signature. CertiFlow-level
tamper evidence is provided by the QR + `/verify` page + stored hash.

## 8. Backend change summary

- `auth.ts`: `PATCH /auth/profile`, `POST /auth/change-password`; add `smtpConfigured`
  to `/auth/me`; stop forcing `mustSetupTwoFactor`.
- New `company-signing` route + `company_signing_settings` table + `migrate.ts` entry.
- `certificate-finalize.ts`: accept a signer (company DSC vs none); add the two signature
  fields; drop the default self-signed auto-signature.
- `processors.ts`: resolve the company DSC, pass it to finalize; gate offer/cert send on
  enabled email settings.
- `batches.ts` route: server-side SMTP gate.
- `billing.ts`: refine credit-pack copy.
- Dashboard stats service: add delivery + certificate series.
- Encryption helper for the DSC P12/passphrase (security skill).

## 9. Non-goals (YAGNI)

- No re-upload / verification of the employee's counter-signature (deliver-only).
- No USB-token server integration (impossible; that's the manual-Adobe path).
- No subscription tiers / seats / API-tier gating (credits only).
- No changes to the editor rendering pipeline beyond signature-field placement.

## 10. Verification plan

- Sidebar shows exactly the seven items; locked states behave; super-admin nav intact.
- Settings: each section saves; profile/password endpoints enforce uniqueness/auth; 2FA
  enable/disable works; DSC upload stores encrypted (verify ciphertext ≠ plaintext in DB).
- Billing: balance shows; a credit purchase flows through UPI; `/plans` gone.
- Dashboard: charts render with real data in light/dark; empty states handled.
- SMTP gate: fresh company is redirected and blocked until SMTP enabled; batch POST
  rejects pre-config.
- DSC: offer-letter PDF opens in Adobe with a valid employer signature (when DSC set) and
  a fillable empty employee field; verify-signature script confirms PAdES validity; the
  employee field is signable.
