import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler';
import { pool, withTransaction } from '../db/pool';
import { AppError } from '../lib/errors';
import { env } from '../config/env';
import { requireAuth } from '../middleware/auth';
import {
  rateLimit,
  loginLockRemainingMs,
  recordLoginFailure,
  clearLoginFailures
} from '../lib/rate-limit';
import { getCompanyAccess } from '../services/companies';
import { sendSystemEmail, getOtpEmailHtml, isCompanyEmailConfigured } from '../services/email';
import {
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  verifyTwoFactor
} from '../services/two-factor';

const router = Router();

type LoginUserRow = {
  id: string;
  company_id: string | null;
  role: 'super_admin' | 'company_admin';
  email: string;
  name: string;
  username: string | null;
  password_hash: string;
  token_version: number;
  company_status: 'active' | 'blocked' | null;
  can_create_batches: boolean | null;
  can_request_upi: boolean | null;
  can_view_reports: boolean | null;
  two_factor_enabled: boolean;
};

const LOGIN_USER_SELECT = `
  SELECT u.id, u.company_id, u.role, u.email, u.name, u.username, u.password_hash, u.token_version, u.two_factor_enabled,
         c.status AS company_status, c.can_create_batches, c.can_request_upi, c.can_view_reports
  FROM users u
  LEFT JOIN companies c ON c.id = u.company_id`;

function assertCompanyLoginAllowed(user: LoginUserRow, company: Awaited<ReturnType<typeof getCompanyAccess>> | null) {
  if (!company || company.status !== 'active') {
    throw new AppError('Company access is blocked', 403);
  }
  if (!company.can_create_batches && !company.can_request_upi && !company.can_view_reports) {
    throw new AppError('Company access is blocked', 403);
  }
}

/** Bump session version (company admins), issue the JWT, set the cookie, return the payload. */
async function completeLogin(res: import('express').Response, user: LoginUserRow) {
  const tokenVersion =
    user.role === 'company_admin'
      ? (
          await pool.query<{ token_version: number }>(
            `UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = $1 RETURNING token_version`,
            [user.id]
          )
        ).rows[0]?.token_version ?? user.token_version
      : user.token_version;

  const payload = { ...serializeUser(user), tokenVersion };
  setAuthCookie(res, issueToken(payload));
  return payload;
}

// Usernames: 3-30 chars, letters/numbers/underscore/dot/hyphen. Case-insensitive-unique.
const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Username may only contain letters, numbers, and _ . -');

const registerSchema = z.object({
  name: z.string().min(2),
  username: usernameSchema,
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2)
});

// Login accepts a username OR an email in a single "identifier" field.
const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your username or email'),
  password: z.string().min(1)
});

function issueToken(user: {
  id: string;
  companyId: string | null;
  role: 'super_admin' | 'company_admin';
  email: string;
  name: string;
  tokenVersion: number;
}) {
  const options: jwt.SignOptions = {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
  };

  return jwt.sign(
    {
      companyId: user.companyId,
      role: user.role,
      email: user.email,
      name: user.name,
      tokenVersion: user.tokenVersion
    },
    env.JWT_SECRET,
    options
  );
}

function getCookieSameSite(): 'strict' | 'lax' | 'none' {
  if (env.AUTH_COOKIE_SAME_SITE) {
    return env.AUTH_COOKIE_SAME_SITE;
  }

  return env.NODE_ENV === 'production' ? 'none' : 'strict';
}

function setAuthCookie(res: import('express').Response, token: string) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: getCookieSameSite(),
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 7
  });
}

function serializeUser(user: {
  id: string;
  company_id: string | null;
  role: 'super_admin' | 'company_admin';
  email: string;
  name: string;
  token_version: number;
  company_status?: 'active' | 'blocked' | null;
  can_create_batches?: boolean | null;
  can_request_upi?: boolean | null;
  can_view_reports?: boolean | null;
}) {
  return {
    id: user.id,
    companyId: user.company_id,
    role: user.role,
    email: user.email,
    name: user.name,
    companyStatus: user.company_status ?? null,
    permissions: {
      canCreateBatches: user.can_create_batches ?? true,
      canRequestUpi: user.can_request_upi ?? true,
      canViewReports: user.can_view_reports ?? true
    }
  };
}

router.post(
  '/register',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: 'Too many registration attempts.'
  }),
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.parse(req.body);
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [parsed.email]);
    if (existing.rows[0]) {
      throw new AppError('Email already exists', 409);
    }
    const usernameTaken = await pool.query('SELECT id FROM users WHERE lower(username) = lower($1)', [parsed.username]);
    if (usernameTaken.rows[0]) {
      throw new AppError('Username already taken', 409, 'username_taken');
    }

    const result = await withTransaction(async (client) => {
      const company = await client.query<{ id: string }>(
        `INSERT INTO companies (id, name, credits_remaining)
         VALUES (gen_random_uuid(), $1, $2)
         RETURNING id`,
        [parsed.companyName, env.DEFAULT_COMPANY_CREDITS]
      );

      const passwordHash = await bcrypt.hash(parsed.password, 12);
      const user = await client.query<{
        id: string;
        company_id: string | null;
        role: 'super_admin' | 'company_admin';
        email: string;
        name: string;
        token_version: number;
        company_status: 'active' | 'blocked' | null;
        can_create_batches: boolean | null;
        can_request_upi: boolean | null;
        can_view_reports: boolean | null;
      }>(
        `INSERT INTO users (id, company_id, name, username, email, password_hash, role)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'company_admin')
         ON CONFLICT (email) DO NOTHING
         RETURNING id, company_id, role, email, name, token_version`,
        [company.rows[0].id, parsed.name, parsed.username, parsed.email, passwordHash]
      );

      if (!user.rows[0]) {
        throw new AppError('Email already exists', 409);
      }

      return user.rows[0];
    });

    const token = issueToken({ ...serializeUser(result), tokenVersion: result.token_version });
    setAuthCookie(res, token);
    res.status(201).json({ user: serializeUser(result) });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.parse(req.body);
    const identifier = parsed.identifier.toLowerCase();
    const loginKey = `${req.ip}:${identifier}`;

    // Only failed attempts count; 10 failures locks this account+ip for 10 minutes.
    if (loginLockRemainingMs(loginKey) > 0) {
      throw new AppError('Too many login attempts.', 429);
    }

    // Match on either username or email (both compared case-insensitively).
    const result = await pool.query<LoginUserRow>(
      `${LOGIN_USER_SELECT} WHERE lower(u.email) = $1 OR lower(u.username) = $1`,
      [identifier]
    );

    const user = result.rows[0];
    if (!user) {
      // No such account — signal the client to offer "create an account" (code: account_not_found).
      // NOTE: this intentionally reveals whether an identifier exists (user-requested UX); the
      // login-failure throttle still applies to blunt username enumeration + brute force.
      recordLoginFailure(loginKey);
      throw new AppError('No account found. Please create an account first.', 404, 'account_not_found');
    }

    const passwordOk = await bcrypt.compare(parsed.password, user.password_hash);
    if (!passwordOk) {
      recordLoginFailure(loginKey);
      throw new AppError('Incorrect password. Please try again.', 401, 'incorrect_password');
    }

    // Credentials verified — clear any accumulated failures for this key.
    clearLoginFailures(loginKey);

    if (user.role === 'company_admin') {
      const company = user.company_id ? await getCompanyAccess(user.company_id) : null;
      assertCompanyLoginAllowed(user, company);
    }

    // If 2FA is on, don't issue a session yet — return a short-lived ticket and
    // require the second factor via /auth/2fa/verify.
    if (user.two_factor_enabled) {
      const ticket = jwt.sign({ twofa: true }, env.JWT_SECRET, {
        subject: user.id,
        audience: '2fa-pending',
        expiresIn: '10m'
      });
      res.json({ twoFactorRequired: true, ticket });
      return;
    }

    const payload = await completeLogin(res, user);
    res.json({ user: payload });
  })
);

// Step 2 of login: exchange a 2FA ticket + TOTP/backup code for a real session.
router.post(
  '/2fa/verify',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many verification attempts.',
    keyGenerator: (req) => `2fa:${req.ip}`
  }),
  asyncHandler(async (req, res) => {
    const { ticket, token } = z
      .object({ ticket: z.string().min(10), token: z.string().trim().min(4).max(20) })
      .parse(req.body);

    let userId: string;
    try {
      userId = (jwt.verify(ticket, env.JWT_SECRET, { audience: '2fa-pending' }) as { sub: string }).sub;
    } catch {
      throw new AppError('Your login session expired. Please sign in again.', 401);
    }

    const ok = await verifyTwoFactor(userId, token);
    if (!ok) {
      throw new AppError('Incorrect authentication code.', 401);
    }

    const result = await pool.query<LoginUserRow>(`${LOGIN_USER_SELECT} WHERE u.id = $1`, [userId]);
    const user = result.rows[0];
    if (!user) {
      throw new AppError('Account not found.', 401);
    }
    if (user.role === 'company_admin') {
      const company = user.company_id ? await getCompanyAccess(user.company_id) : null;
      assertCompanyLoginAllowed(user, company);
    }

    const payload = await completeLogin(res, user);
    res.json({ user: payload });
  })
);

// Begin 2FA enrollment — returns a provisioning QR + secret (not yet enabled).
router.post(
  '/2fa/setup',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = await setupTwoFactor(req.user!.id, req.user!.email);
    res.json(data);
  })
);

// Confirm enrollment with a code from the authenticator app; returns backup codes once.
router.post(
  '/2fa/enable',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().trim().min(6).max(10) }).parse(req.body);
    const backupCodes = await enableTwoFactor(req.user!.id, token);
    res.json({ ok: true, backupCodes });
  })
);

// Disable 2FA (requires password re-authentication).
router.post(
  '/2fa/disable',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
    const row = await pool.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [
      req.user!.id
    ]);
    const ok = row.rows[0] && (await bcrypt.compare(password, row.rows[0].password_hash));
    if (!ok) {
      throw new AppError('Incorrect password.', 401);
    }
    await disableTwoFactor(req.user!.id);
    res.json({ ok: true });
  })
);

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(8)
});

router.post(
  '/forgot-password',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many password reset requests.'
  }),
  asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const userResult = await pool.query<{ id: string; name: string }>('SELECT id, name FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];
    if (!user) {
      throw new AppError('No account found with this email address', 404);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await pool.query(
      `INSERT INTO password_resets (email, otp, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
      [email, otp]
    );

    const html = getOtpEmailHtml(otp, user.name);
    await sendSystemEmail({
      to: email,
      subject: 'CertiFlow - Password Reset Code',
      html,
      recipientName: user.name
    });

    res.json({ ok: true, message: 'OTP sent to registered email' });
  })
);

router.post(
  '/reset-password',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many password reset attempts.'
  }),
  asyncHandler(async (req, res) => {
    const { email, otp, newPassword } = resetPasswordSchema.parse(req.body);

    const resetResult = await pool.query<{ id: string }>(
      `SELECT id FROM password_resets
       WHERE email = $1 AND otp = $2 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email, otp]
    );

    const resetRecord = resetResult.rows[0];
    if (!resetRecord) {
      throw new AppError('Invalid or expired verification code', 400);
    }

    await pool.query('UPDATE password_resets SET used = true WHERE id = $1', [resetRecord.id]);

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const userResult = await pool.query<{ id: string }>(
      `UPDATE users
       SET password_hash = $1, token_version = token_version + 1, updated_at = NOW()
       WHERE email = $2
       RETURNING id`,
      [passwordHash, email]
    );

    if (!userResult.rows[0]) {
      throw new AppError('User account no longer exists', 404);
    }

    res.json({ ok: true, message: 'Password reset successfully' });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) {
      throw new AppError('Not authenticated', 401);
    }
    const tf = await pool.query<{ two_factor_enabled: boolean }>(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [user.id]
    );
    const twoFactorEnabled = Boolean(tf.rows[0]?.two_factor_enabled);
    // Super admins must protect the platform with 2FA.
    const mustSetupTwoFactor = user.role === 'super_admin' && !twoFactorEnabled;
    // Onboarding gate: company admins must configure an email sender before issuing.
    const smtpConfigured =
      user.role === 'super_admin' ? true : await isCompanyEmailConfigured(user.companyId ?? null);
    res.json({ user: { ...user, twoFactorEnabled, mustSetupTwoFactor, smtpConfigured } });
  })
);

const profileSchema = z.object({
  name: z.string().min(2).optional(),
  username: usernameSchema.optional(),
  email: z.string().email().optional()
});

// Update the signed-in user's own name / username / email. Enforces case-insensitive uniqueness
// and re-issues the auth cookie so identity changes take effect immediately.
router.patch(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = profileSchema.parse(req.body);
    const id = req.user!.id;

    if (parsed.username) {
      const taken = await pool.query('SELECT id FROM users WHERE lower(username) = lower($1) AND id <> $2', [
        parsed.username,
        id
      ]);
      if (taken.rows[0]) throw new AppError('Username already taken', 409, 'username_taken');
    }
    if (parsed.email) {
      const taken = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2', [
        parsed.email,
        id
      ]);
      if (taken.rows[0]) throw new AppError('Email already exists', 409);
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const key of ['name', 'username', 'email'] as const) {
      if (parsed[key] !== undefined) {
        sets.push(`${key} = $${i}`);
        values.push(parsed[key]);
        i += 1;
      }
    }
    if (!sets.length) throw new AppError('No changes provided', 400);
    values.push(id);

    const updated = await pool.query(
      `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i}
       RETURNING id, company_id, role, email, name, token_version`,
      values
    );
    const row = updated.rows[0];
    setAuthCookie(res, issueToken({ ...serializeUser(row), tokenVersion: row.token_version }));
    res.json({ user: serializeUser(row) });
  })
);

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

// Change the signed-in user's password. Verifies the current password, then bumps token_version to
// invalidate every other session and re-issues this session's cookie.
router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = passwordChangeSchema.parse(req.body);
    const result = await pool.query(
      'SELECT id, company_id, role, email, name, token_version, password_hash FROM users WHERE id = $1',
      [req.user!.id]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      throw new AppError('Current password is incorrect', 401);
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const nextVersion = (user.token_version ?? 0) + 1;
    await pool.query('UPDATE users SET password_hash = $1, token_version = $2, updated_at = NOW() WHERE id = $3', [
      passwordHash,
      nextVersion,
      user.id
    ]);
    setAuthCookie(res, issueToken({ ...serializeUser(user), tokenVersion: nextVersion }));
    res.json({ ok: true });
  })
);

router.post('/logout', (_req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: getCookieSameSite(),
    secure: env.NODE_ENV === 'production',
    path: '/'
  });
  res.json({ ok: true });
});

export default router;
