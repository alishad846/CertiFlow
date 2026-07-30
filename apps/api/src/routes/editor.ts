import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import express, { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../lib/async-handler';
import { paginateEditorAssets } from '../services/editor-assets';
import { requireAuth } from '../middleware/auth';
import { env } from '../config/env';
import { pool } from '../db/pool';
import { AppError } from '../lib/errors';
import { ensureDir, safeSegment } from '../services/fs';
import { searchUnsplash } from '../services/unsplash';

const router = Router();

/** Static vendored shapes/frames/texts thumbnail + preview images, served host-agnostically (see rewriteImageUrls below). */
router.use(
  '/images',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.resolve(__dirname, '../data/editor/images'))
);

/** Ready-made (stock) template thumbnails for the editor chooser gallery. */
router.use(
  '/stock',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.resolve(__dirname, '../data/editor/stock-templates'))
);

/**
 * Curated self-hosted font set (see apps/api/src/data/editor/fonts.json) — the shared source of
 * truth for both the editor's font picker and the headless certificate renderer (Task 13/14), so
 * signed certificates render identically forever regardless of upstream Google Fonts availability.
 * Cross-origin @font-face requires explicit CORS: the web app fetches these fonts from a different
 * origin (the API host/port), and the static handler must send Access-Control-Allow-Origin itself
 * rather than relying on the global cors() middleware.
 */
router.use(
  '/fonts',
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.resolve(__dirname, '../data/editor/fonts'))
);

function parsePageParams(req: express.Request, defaultPs = 18) {
  const ps = Number(req.query.ps);
  const pi = Number(req.query.pi);
  return {
    ps: Number.isFinite(ps) && ps > 0 ? ps : defaultPs,
    pi: Number.isFinite(pi) && pi >= 0 ? pi : 0
  };
}

/**
 * The vendored datasets hardcode urls against `http://localhost:4000/...`. Our assets are served
 * from this router under `/api/editor/...`, and the web app may reach the API via a different host
 * (e.g. a LAN IP) than the one baked into the dataset. Rewrite per-request against the request's own
 * origin so links always resolve. Deep-clones via JSON stringify/parse so the in-memory dataset is
 * never mutated.
 */
function rewriteHostUrls<T>(req: express.Request, item: T, fromPrefix: string, toSuffix: string): T {
  const base = `${req.protocol}://${req.get('host')}`;
  return JSON.parse(JSON.stringify(item).replaceAll(fromPrefix, `${base}${toSuffix}`));
}

function rewriteImageUrls<T>(req: express.Request, item: T): T {
  return rewriteHostUrls(req, item, 'http://localhost:4000/images/', '/api/editor/images/');
}

/** Fonts are vendored with their final self-hosted url already baked in (see fonts.json); only the host needs rewriting. */
function rewriteFontUrls<T>(req: express.Request, item: T): T {
  return rewriteHostUrls(req, item, 'http://localhost:4000/api/editor/fonts/', '/api/editor/fonts/');
}

router.get(
  '/search-shapes',
  asyncHandler(async (req, res) => {
    const items = paginateEditorAssets('shapes', parsePageParams(req));
    res.json({ data: items.map((item) => rewriteImageUrls(req, item)) });
  })
);

router.get(
  '/search-frames',
  asyncHandler(async (req, res) => {
    const items = paginateEditorAssets('frames', parsePageParams(req));
    res.json({ data: items.map((item) => rewriteImageUrls(req, item)) });
  })
);

router.get(
  '/search-texts',
  asyncHandler(async (req, res) => {
    const items = paginateEditorAssets('texts', parsePageParams(req));
    res.json({ data: items.map((item) => rewriteImageUrls(req, item)) });
  })
);

router.get(
  '/search-fonts',
  asyncHandler(async (req, res) => {
    const items = paginateEditorAssets('fonts', parsePageParams(req, 30));
    res.json({ data: items.map((item) => rewriteFontUrls(req, item)) });
  })
);

// Stock template gallery is a later task (Task 12 ships CertiFlow's own curated templates);
// the mock-api's bundled templates.json/images are intentionally not vendored.
// The editor's content panels read `res.data.data`, so search endpoints must return a { data: [] } envelope.
router.get(
  '/search-templates',
  asyncHandler(async (_req, res) => {
    res.json({ data: [] });
  })
);

// Task 10a: server-side Unsplash proxy feeding the editor's "Collection" image tab. Public
// (unauthenticated) — the client-side unsplash-js tab is intentionally left disabled (empty
// accessKey in editor-config.ts) precisely so the real key never reaches the browser; this route
// is the only place it is used. Degrades to `{ data: [] }` when no key is configured.
router.get(
  '/search-images',
  asyncHandler(async (req, res) => {
    const { ps, pi } = parsePageParams(req);
    const items = await searchUnsplash(String(req.query.kw ?? ''), ps, pi);
    res.json({ data: items });
  })
);

// Keyword-suggestion endpoints (autocomplete-style "related keywords" chips) are not implemented
// yet for any content type; the editor treats an empty array as "no suggestions".
router.get(
  '/template-suggestion',
  asyncHandler(async (_req, res) => {
    res.json([]);
  })
);

router.get(
  '/text-suggestion',
  asyncHandler(async (_req, res) => {
    res.json([]);
  })
);

router.get(
  '/image-suggestion',
  asyncHandler(async (_req, res) => {
    res.json([]);
  })
);

router.get(
  '/shape-suggestion',
  asyncHandler(async (_req, res) => {
    res.json([]);
  })
);

router.get(
  '/frame-suggestion',
  asyncHandler(async (_req, res) => {
    res.json([]);
  })
);

/**
 * "Your uploads" tab (Task 10): AUTHED user-image upload/list/remove, wired to CertiFlow's
 * `uploads` table + `/files` static serving. These three routes are the only authed routes on
 * this router — `requireAuth` is applied per-route (NOT via `router.use`) so the public
 * search/font endpoints above stay unauthenticated.
 *
 * Contract verified against the fork's `UploadContentTab.tsx` + `base-request.ts`: the response
 * interceptor there returns `response.data` (the body), and the tab reads `body.data` as an array
 * for all three operations. Every image item must be
 * `{ id: number, documentId: string, img: { url: <absolute>, mime: string } }`.
 */

type UploadImageRow = { id: string; stored_path: string; created_at: string };

const uploadsDir = () => path.resolve(env.UPLOAD_DIR);

/** Mirrors the private `toFileUrl` in `services/certificate-templates.ts`, but returns an ABSOLUTE
 * url (the editor loads it as `<img crossOrigin="anonymous">`, so a host-relative path won't do). */
function toAbsoluteFileUrl(req: express.Request, storedPath: string) {
  const relative = path.relative(uploadsDir(), path.resolve(storedPath)).split(path.sep).join('/');
  if (relative.startsWith('..')) {
    return '';
  }
  return `${req.protocol}://${req.get('host')}/files/${relative}`;
}

/** The `uploads` table has no mime column; derive a best-effort mime from the stored extension. */
function mimeFromStoredPath(storedPath: string): string {
  switch (path.extname(storedPath).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function toEditorImageItem(req: express.Request, row: UploadImageRow) {
  return {
    id: Date.parse(row.created_at) || Date.now(),
    documentId: row.id,
    img: {
      url: toAbsoluteFileUrl(req, row.stored_path),
      mime: mimeFromStoredPath(row.stored_path)
    }
  };
}

/** Non-super_admin callers are always scoped to their own company; super_admin may pass ?companyId=. */
function resolveUploadsCompanyId(req: express.Request) {
  if (req.user!.role === 'super_admin') {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId.trim() : '';
    if (!companyId) {
      throw new AppError('Company is required', 400);
    }
    return companyId;
  }
  if (!req.user!.companyId) {
    throw new AppError('Company is required', 400);
  }
  return req.user!.companyId;
}

const editorImageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const companyId = req.user?.companyId;
      if (!companyId) {
        cb(new AppError('Company is required', 400), '');
        return;
      }
      const dir = path.join(env.UPLOAD_DIR, `company-${companyId}`, 'editor-images');
      ensureDir(dir)
        .then(() => cb(null, dir))
        .catch((err) => cb(err instanceof Error ? err : new Error(String(err)), dir));
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}-${safeSegment(file.originalname)}`);
    }
  }),
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new AppError('Only image files are allowed', 400));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

router.post(
  '/your-uploads/upload',
  requireAuth,
  editorImageUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError('An image file is required', 400);
    }
    const companyId = req.user!.companyId;
    if (!companyId) {
      throw new AppError('Company is required', 400);
    }

    const result = await pool.query<UploadImageRow>(
      `INSERT INTO uploads (company_id, original_name, stored_path, kind, created_by)
       VALUES ($1, $2, $3, 'image', $4)
       RETURNING id, stored_path, created_at`,
      [companyId, req.file.originalname, req.file.path, req.user!.id]
    );

    res.status(201).json({ data: [toEditorImageItem(req, result.rows[0])] });
  })
);

/** Best-effort extension guess from a Content-Type; falls back to no extension (mime is still
 * recorded/derived at read time via `mimeFromStoredPath`, so a missing extension only affects the
 * cosmetic filename, not correctness). */
const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg'
};

/**
 * Task 10a: authed persistence building block for the Collection (Unsplash) tab. Downloads an
 * arbitrary `url` server-side into CertiFlow's own uploads, so a signed certificate can reference
 * OUR copy of an image rather than an external CDN url that might change or disappear.
 *
 * SSRF note: this endpoint fetches an arbitrary caller-supplied url from the server. It is kept
 * AUTHED (requireAuth; company must be resolvable) and the response Content-Type is required to
 * start with `image/`, which rules out this being used as a generic internal-network probe for
 * anything that doesn't respond with an image body. A full SSRF allowlist/deny-private-ranges
 * check is out of scope for this task and is a follow-up if this endpoint is ever exposed beyond
 * trusted company-admin users.
 *
 * Per Unsplash API terms, picking a photo requires pinging its `download_location` url. The fork
 * does not yet call this route when a Collection image is placed on the canvas (it still drops the
 * external `urls.regular` straight into the design) — wiring that auto-persist behavior into the
 * fork is a deferred follow-up; this route is the ready building block for it.
 */
router.post(
  '/your-uploads/import-url',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    if (!companyId) {
      throw new AppError('Company is required', 400);
    }

    const sourceUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!sourceUrl) {
      throw new AppError('An image url is required', 400);
    }

    let fetchRes: Response;
    try {
      fetchRes = await fetch(sourceUrl);
    } catch {
      throw new AppError('Failed to download image', 400);
    }
    if (!fetchRes.ok) {
      throw new AppError('Failed to download image', 400);
    }

    const contentType = (fetchRes.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!contentType.startsWith('image/')) {
      throw new AppError('URL did not resolve to an image', 400);
    }

    const buffer = Buffer.from(await fetchRes.arrayBuffer());
    const dir = path.join(env.UPLOAD_DIR, `company-${companyId}`, 'editor-images');
    await ensureDir(dir);
    const ext = CONTENT_TYPE_EXTENSIONS[contentType] ?? '';
    const storedPath = path.join(dir, `${randomUUID()}${ext}`);
    await fs.promises.writeFile(storedPath, buffer);

    const originalName = safeSegment(path.basename(new URL(sourceUrl).pathname)) || 'imported-image';

    const result = await pool.query<UploadImageRow>(
      `INSERT INTO uploads (company_id, original_name, stored_path, kind, created_by)
       VALUES ($1, $2, $3, 'image', $4)
       RETURNING id, stored_path, created_at`,
      [companyId, originalName, storedPath, req.user!.id]
    );

    // Best-effort Unsplash download ping (API terms require this on photo selection). Never
    // blocks or fails the import — fire-and-forget, errors swallowed.
    const downloadLocationUrl =
      typeof req.body?.downloadLocationUrl === 'string' ? req.body.downloadLocationUrl : '';
    if (downloadLocationUrl && env.UNSPLASH_ACCESS_KEY) {
      fetch(downloadLocationUrl, {
        headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` }
      }).catch(() => undefined);
    }

    res.status(201).json({ data: [toEditorImageItem(req, result.rows[0])] });
  })
);

// Certificate-template BACKGROUND images are inserted into this same `uploads` table with
// `kind = 'image'` too (see certificate-templates.ts), and `certificate_templates.background_upload_id`
// is `NOT NULL REFERENCES uploads(id) ON DELETE CASCADE`. Without discriminating by path, the
// editor's "Your Uploads" gallery would list live certificate backgrounds, and DELETE would
// cascade-delete the owning certificate_templates row. Editor uploads are stored under
// `.../company-<id>/editor-images/...` (see editorImageUpload above) while certificate backgrounds
// live under `.../company-<id>/certificate-templates/...`, so a `stored_path` filter cleanly scopes
// these routes to editor-owned uploads only. Bound as a parameter (never string-interpolated) and
// separator-agnostic so it matches regardless of `/` vs `\` path separators.
const EDITOR_IMAGES_PATH_FILTER = '%editor-images%';

router.get(
  '/your-uploads/get-user-images',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = resolveUploadsCompanyId(req);
    const result = await pool.query<UploadImageRow>(
      `SELECT id, stored_path, created_at
       FROM uploads
       WHERE company_id = $1 AND kind = 'image' AND stored_path LIKE $2
       ORDER BY created_at DESC`,
      [companyId, EDITOR_IMAGES_PATH_FILTER]
    );

    res.json({ data: result.rows.map((row) => toEditorImageItem(req, row)) });
  })
);

router.delete(
  '/your-uploads/remove/:documentId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const documentId = String(req.params.documentId);
    const existing = await pool.query<{ id: string; company_id: string; stored_path: string }>(
      `SELECT id, company_id, stored_path FROM uploads WHERE id = $1 AND kind = 'image' AND stored_path LIKE $2`,
      [documentId, EDITOR_IMAGES_PATH_FILTER]
    );
    const row = existing.rows[0];
    if (!row || (req.user!.role !== 'super_admin' && row.company_id !== req.user!.companyId)) {
      throw new AppError('Upload not found', 404);
    }

    await pool.query(`DELETE FROM uploads WHERE id = $1`, [row.id]);
    await fs.promises.unlink(row.stored_path).catch(() => undefined);

    res.status(200).json({ ok: true });
  })
);

export default router;
