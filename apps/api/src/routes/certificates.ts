import fs from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler';
import { AppError } from '../lib/errors';
import { rateLimit } from '../lib/rate-limit';
import { requireAuth } from '../middleware/auth';
import {
  getVerification,
  getCurrentVersionPdfPath,
  getCurrentVersionPreviewPath,
  checkFileIntegrity,
  logCertificateEvent,
  listCompanyCertificates,
  revokeCertificate
} from '../services/certificates';
import { getClaimContext, requestClaimOtp, verifyClaimOtp, verifyClaimSession } from '../services/claims';
import type { Request } from 'express';

const router = Router();

/** Company scope for authed cert routes: own company, or ?companyId= for super admin. */
function resolveScopedCompanyId(req: Request): string {
  if (req.user?.role === 'super_admin') {
    const q = typeof req.query.companyId === 'string' ? req.query.companyId.trim() : '';
    if (!q) {
      throw new AppError('companyId query parameter is required for super admin.', 400);
    }
    return q;
  }
  if (!req.user?.companyId) {
    throw new AppError('No company associated with this account.', 403);
  }
  return req.user.companyId;
}

const publicIdSchema = z.string().trim().regex(/^CF-[0-9A-Z]{4,8}-[0-9A-Z]{2,6}$/i, 'Invalid certificate id');
const tokenSchema = z.string().trim().min(20).max(200);
const emailSchema = z.string().trim().email().max(320);
const otpSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6 digit code');

function clientIp(req: { ip?: string }) {
  return req.ip ?? null;
}

const integrityUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    if (!ok) {
      cb(new AppError('Upload the certificate PDF to check it.', 400));
      return;
    }
    cb(null, true);
  }
});

// -------- Public verification (source of truth) --------
router.get(
  '/verify/:publicId',
  rateLimit({ windowMs: 60_000, max: 60, message: 'Too many verification requests.' }),
  asyncHandler(async (req, res) => {
    const parsed = publicIdSchema.safeParse(req.params.publicId);
    if (!parsed.success) {
      res.json({ found: false });
      return;
    }
    const { certificateId, ...result } = await getVerification(parsed.data.toUpperCase());
    if (result.found && certificateId) {
      await logCertificateEvent(certificateId, 'verified', {
        ip: clientIp(req),
        userAgent: req.headers['user-agent'] ?? null
      }).catch(() => undefined);
    }
    res.json(result);
  })
);

// -------- Public file integrity check: does THIS exact file match what we issued? --------
// A public-id/QR match only proves an id was issued — it says nothing about a file someone is
// holding, which may have been edited after signing. This compares its SHA-256 against every
// version we ever stored for the id, so edits (in any tool — Word, Photoshop, a PDF editor, a
// scan-and-reprint) are caught even though the id/QR printed on the page still reads correctly.
router.post(
  '/verify/:publicId/check-file',
  rateLimit({ windowMs: 60_000, max: 20, message: 'Too many file checks.' }),
  integrityUpload.single('file'),
  asyncHandler(async (req, res) => {
    const parsed = publicIdSchema.safeParse(req.params.publicId);
    if (!parsed.success || !req.file) {
      throw new AppError('A certificate id and PDF file are required.', 400);
    }
    const { certificateId, ...result } = await checkFileIntegrity(parsed.data.toUpperCase(), req.file.buffer);
    if (result.found && certificateId) {
      await logCertificateEvent(certificateId, 'integrity_check', {
        ip: clientIp(req),
        userAgent: req.headers['user-agent'] ?? null,
        detail: { matches: result.matches, matchesCurrentVersion: result.matchesCurrentVersion }
      }).catch(() => undefined);
    }
    res.json(result);
  })
);

// -------- Claim page context (masked) --------
router.get(
  '/claim/:token',
  rateLimit({ windowMs: 60_000, max: 60, message: 'Too many requests.' }),
  asyncHandler(async (req, res) => {
    const token = tokenSchema.parse(req.params.token);
    const context = await getClaimContext(token);
    res.json(context);
  })
);

// -------- Request OTP (hard rate-limited) --------
router.post(
  '/claim/:token/request-otp',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many verification code requests.',
    keyGenerator: (req) => `otp-req:${req.ip}:${req.params.token}`
  }),
  asyncHandler(async (req, res) => {
    const token = tokenSchema.parse(req.params.token);
    const email = emailSchema.parse(req.body?.email);
    const result = await requestClaimOtp(token, email, clientIp(req));
    res.json({ ok: true, maskedEmail: result.maskedEmail });
  })
);

// -------- Verify OTP -> claim session --------
router.post(
  '/claim/:token/verify-otp',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 12,
    message: 'Too many verification attempts.',
    keyGenerator: (req) => `otp-verify:${req.ip}:${req.params.token}`
  }),
  asyncHandler(async (req, res) => {
    const token = tokenSchema.parse(req.params.token);
    const email = emailSchema.parse(req.body?.email);
    const otp = otpSchema.parse(req.body?.otp);
    const { claimSession } = await verifyClaimOtp(token, email, otp, clientIp(req));
    res.json({ ok: true, claimSession });
  })
);

function extractClaimBearer(req: Request): string | undefined {
  return req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : typeof req.query.session === 'string'
      ? req.query.session
      : undefined;
}

// -------- Gated preview (claim session required) — the page-1 raster pre-rendered at issuance,
// never the raw stored PDF --------
router.get(
  '/claim/:token/preview',
  rateLimit({ windowMs: 60_000, max: 30, message: 'Too many preview requests.' }),
  asyncHandler(async (req, res) => {
    const bearer = extractClaimBearer(req);
    if (!bearer) {
      throw new AppError('A verified claim session is required.', 401);
    }

    const { certificateId } = verifyClaimSession(bearer);
    const info = await getCurrentVersionPreviewPath(certificateId);
    if (!info || !fs.existsSync(info.previewPath)) {
      throw new AppError('Preview not available for this document.', 404);
    }
    if (info.status === 'revoked') {
      throw new AppError('This certificate has been revoked and can no longer be previewed.', 403);
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, no-store');
    fs.createReadStream(info.previewPath).pipe(res);
  })
);

// -------- Gated download (claim session required) --------
router.get(
  '/claim/:token/download',
  rateLimit({ windowMs: 60_000, max: 20, message: 'Too many downloads.' }),
  asyncHandler(async (req, res) => {
    const bearer = extractClaimBearer(req);
    if (!bearer) {
      throw new AppError('A verified claim session is required.', 401);
    }

    const { certificateId } = verifyClaimSession(bearer);
    const info = await getCurrentVersionPdfPath(certificateId);
    if (!info || !fs.existsSync(info.pdfPath)) {
      throw new AppError('Certificate file not found.', 404);
    }
    if (info.status === 'revoked') {
      throw new AppError('This certificate has been revoked and can no longer be downloaded.', 403);
    }

    await logCertificateEvent(certificateId, 'downloaded', {
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] ?? null
    }).catch(() => undefined);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="certificate.pdf"');
    res.setHeader('Cache-Control', 'private, no-store');
    fs.createReadStream(info.pdfPath).pipe(res);
  })
);

// -------- Authed: company's issued certificates --------
router.get(
  '/certificates/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = resolveScopedCompanyId(req);
    const before = typeof req.query.before === 'string' ? req.query.before : null;
    const limit = Number(req.query.limit) || 25;
    const certificates = await listCompanyCertificates(companyId, { limit, before });
    res.json({ certificates });
  })
);

// -------- Authed: revoke a certificate --------
router.post(
  '/certificates/:id/revoke',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = resolveScopedCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) || null : null;
    const ok = await revokeCertificate(id, companyId, reason, req.user?.id ?? null);
    if (!ok) {
      throw new AppError('Certificate not found or already revoked.', 404);
    }
    res.json({ ok: true });
  })
);

export default router;
