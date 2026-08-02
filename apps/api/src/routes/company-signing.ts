import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../lib/errors';
import {
  saveCompanyDsc,
  getCompanyDscMeta,
  deleteCompanyDsc
} from '../services/company-signing';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 }, // DSC files are small; 1MB is generous
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const ok =
      ext === '.pfx' ||
      ext === '.p12' ||
      file.mimetype === 'application/x-pkcs12' ||
      file.mimetype === 'application/pkcs12' ||
      file.mimetype === 'application/octet-stream';
    if (!ok) {
      cb(new AppError('Upload a .pfx or .p12 certificate file', 400));
      return;
    }
    cb(null, true);
  }
});

function resolveCompanyId(req: import('express').Request): string {
  const companyId = req.user?.companyId;
  if (!companyId) {
    throw new AppError('A company is required to manage a signing certificate', 400);
  }
  return companyId;
}

router.get(
  '/',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const companyId = resolveCompanyId(req);
    res.json({ dsc: await getCompanyDscMeta(companyId) });
  })
);

router.put(
  '/',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const companyId = resolveCompanyId(req);
    if (!req.file) {
      throw new AppError('A .pfx or .p12 certificate file is required', 400);
    }
    const passphrase = String(req.body?.passphrase ?? '');
    if (!passphrase) {
      throw new AppError('The certificate passphrase is required', 400);
    }
    const autoSign = String(req.body?.autoSign ?? 'true') !== 'false';
    const dsc = await saveCompanyDsc({ companyId, p12: req.file.buffer, passphrase, autoSign });
    res.status(201).json({ dsc });
  })
);

router.delete(
  '/',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const companyId = resolveCompanyId(req);
    await deleteCompanyDsc(companyId);
    res.json({ ok: true });
  })
);

export default router;
