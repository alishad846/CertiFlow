import fs from 'node:fs';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler';
import { AppError } from '../lib/errors';
import { rateLimit } from '../lib/rate-limit';
import { getVerification, getCurrentVersionPdfPath, logCertificateEvent } from '../services/certificates';
import { getClaimContext, requestClaimOtp, verifyClaimOtp, verifyClaimSession } from '../services/claims';

const router = Router();

const publicIdSchema = z.string().trim().regex(/^CF-[0-9A-Z]{4,8}-[0-9A-Z]{2,6}$/i, 'Invalid certificate id');
const tokenSchema = z.string().trim().min(20).max(200);
const emailSchema = z.string().trim().email().max(320);
const otpSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6 digit code');

function clientIp(req: { ip?: string }) {
  return req.ip ?? null;
}

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

// -------- Gated download (claim session required) --------
router.get(
  '/claim/:token/download',
  rateLimit({ windowMs: 60_000, max: 20, message: 'Too many downloads.' }),
  asyncHandler(async (req, res) => {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : typeof req.query.session === 'string'
        ? req.query.session
        : undefined;
    if (!bearer) {
      throw new AppError('A verified claim session is required.', 401);
    }

    const { certificateId } = verifyClaimSession(bearer);
    const pdfPath = await getCurrentVersionPdfPath(certificateId);
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      throw new AppError('Certificate file not found.', 404);
    }

    await logCertificateEvent(certificateId, 'downloaded', {
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] ?? null
    }).catch(() => undefined);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="certificate.pdf"');
    res.setHeader('Cache-Control', 'private, no-store');
    fs.createReadStream(pdfPath).pipe(res);
  })
);

export default router;
