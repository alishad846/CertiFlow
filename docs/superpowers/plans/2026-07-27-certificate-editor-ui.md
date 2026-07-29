# Certificate Editor UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CertiFlow's coordinate-based certificate editor with an embedded Canva-style editor (forked from `kenvinlu/canva-editor`) whose designs are saved as JSON templates, rendered server-side via headless Chromium, and QR-stamped + PAdES-signed by the existing pipeline — with all in-app export/screenshot affordances removed.

**Architecture:** The editor ships as a frozen, prebuilt workspace package `packages/canva-editor` (Vite lib build, consumed by `apps/web` via `ssr:false` dynamic import). It saves design JSON to a new `editor_document` column on `certificate_templates`. Its data/asset needs are served by a new `/api/editor` router in `apps/api` (ported from the repo's `mock-api`) plus self-hosted static assets. At batch time the worker loads the design JSON in a headless "render mode" page, injects merged recipient data, captures a high-res PDF, and runs the existing QR + signing.

**Tech Stack:** Next.js 15 / React 19, Express + node worker, Postgres (`pg` pool), Vite (editor lib build), `@emotion/react` + `styled-components` (editor styling), Puppeteer (headless render), Zod (validation), existing `pdf-lib` + `@napi-rs/canvas` + signing pipeline.

## Global Constraints

- Package manager: **npm workspaces** (NOT pnpm). Workspaces: `apps/*`, `packages/*`. Node `>=20`.
- React `^19.1.1`, Next `^15.4.6`. Editor peer-deps say React 18 but runs on 19 (upstream overrides React to 19).
- API is **Express** with a `pg` `pool` (`apps/api/src/db/pool.ts`), `withTransaction` helper, `asyncHandler`, `AppError`, `requireAuth` / `requireRole` middleware. Auth roles: `super_admin`, `company_admin`. Company scoping via `req.user.companyId`.
- All template writes are `company_admin` or `super_admin` and must enforce company ownership (mirror existing `certificate-templates.ts` checks).
- The editor package is **fork-and-frozen** — we own it; no upstream tracking.
- **Fonts are a single shared source of truth** used identically by the editor and the headless renderer, or signed PDFs will mismatch.
- **Image search via Unsplash is ENABLED**, proxied server-side (`/api/editor/search-images`, env `UNSPLASH_ACCESS_KEY`); returns `[]` when no key set. Uploads + editor shapes/frames also available. Picked Unsplash images are persisted into CertiFlow uploads so signed certs render identically forever.
- **No in-app export**: remove PNG/PDF download UI and the `downloadPNGCmd`/`downloadPDFCmd` paths. OS-level screenshots are out of scope (documented, not blockable).
- Commits: conventional-commit style; **no Claude/AI attribution** in commit messages.
- Reference copy of the source editor is at the session scratchpad: `…/scratchpad/canva-editor` (`libs/canva-editor`, `apps/mock-api`).

---

## File Structure

**New workspace package**
- `packages/canva-editor/` — frozen fork of `libs/canva-editor` (Vite lib build → `dist/`).

**apps/web (Next.js)**
- `apps/web/src/app/(dashboard)/editor/new/page.tsx` — blank-canvas entry.
- `apps/web/src/app/(dashboard)/editor/[id]/page.tsx` — edit existing design.
- `apps/web/src/components/editor/CertificateEditor.tsx` — client wrapper mounting `CanvaEditor`.
- `apps/web/src/components/editor/editor-config.ts` — builds `EditorConfig` (apis, assets, fields).
- `apps/web/src/components/editor/lockdown.ts` — context-menu/print/drag-save disabling.
- `apps/web/src/lib/editor-templates.ts` — client API calls for design JSON + clone.
- Modify: `apps/web/src/app/(dashboard)/templates/page.tsx` — "Edit this template" / "Create my own" buttons.

**apps/api (Express + worker)**
- `apps/api/src/routes/editor.ts` — `/api/editor/*` router (fonts, shapes, frames, texts, templates, user images, suggestions).
- `apps/api/src/services/editor-assets.ts` — loads curated JSON datasets.
- `apps/api/src/services/editor-render.ts` — Puppeteer JSON→PDF renderer.
- `apps/api/src/data/editor/*.json` — curated fonts/shapes/frames/texts/stock-templates (ported).
- `apps/api/src/data/editor/fonts/**` — bundled font files + CSS (shared with renderer).
- Modify: `apps/api/src/services/certificate-templates.ts` — `editorDocument` + `renderEngine` columns.
- Modify: `apps/api/src/routes/certificate-templates.ts` — endpoints to read/write design JSON.
- Modify: `apps/api/src/services/batches.ts` (+ worker path) — route `renderEngine==='editor'` to headless render.
- Migration script under `apps/api/src/scripts/` or the repo's migration location (see Task 3).

**Static assets**
- `apps/web/public/editor-assets/**` — cursors, text-effect assets (self-hosted `editorAssetsUrl`).

---

## PHASE 0 — Editor package extraction & build

### Task 1: Extract `canva-editor` as a frozen workspace package

**Files:**
- Create: `packages/canva-editor/**` (copied from scratchpad `libs/canva-editor`)
- Modify: `package.json` (root workspaces already include `packages/*`)

**Interfaces:**
- Produces: package `@certiflow/canva-editor` exporting `CanvaEditor` (default + named) and type `EditorConfig`; built ESM at `packages/canva-editor/dist/canva-editor.es.js`, types at `dist/src/index.d.ts`.

- [ ] **Step 1: Copy the editor source into the monorepo**

```bash
cp -r "/c/Users/sahil/AppData/Local/Temp/claude/C--Users-sahil-OneDrive-Desktop-CertiFlow/8355f07c-4f05-43bb-bdba-a0c39b9e1124/scratchpad/canva-editor/libs/canva-editor" "packages/canva-editor"
rm -rf packages/canva-editor/node_modules packages/canva-editor/dist
ls packages/canva-editor/src/index.ts
```
Expected: `packages/canva-editor/src/index.ts` exists.

- [ ] **Step 2: Rename the package and pin for the monorepo**

Edit `packages/canva-editor/package.json`: set `"name": "@certiflow/canva-editor"`, keep `"version"`, keep `"main"/"module"/"types"/"exports"` as-is. Leave `peerDependencies` (react, react-dom, @emotion/react, @emotion/styled, styled-components). Confirm `"private": false` → set to `true` (never published).

- [ ] **Step 3: Install workspace deps from repo root**

Run: `npm install`
Expected: completes; `packages/canva-editor` is linked as `@certiflow/canva-editor`.

- [ ] **Step 4: Build the editor package**

Run: `npm run build --workspace @certiflow/canva-editor`
Expected: emits `packages/canva-editor/dist/canva-editor.es.js` and `dist/src/index.d.ts`. If the build fails on TS path aliases, ensure `packages/canva-editor/tsconfig.json` + `vite.config.ts` (copied from source) resolve `canva-editor/*` self-imports; fix by keeping the source's `vite-tsconfig-paths` plugin and `baseUrl: "src"`.

- [ ] **Step 5: Add a root build hook so the editor builds before web**

Edit root `package.json` `"build"` script to prepend the editor build:
```json
"build": "npm run build --workspace @certiflow/canva-editor && npm run build --workspace @certiflow/shared && npm run build --workspace @certiflow/api && npm run build --workspace @certiflow/web",
```
Also add to `"predev"`:
```json
"predev": "npm run build --workspace @certiflow/canva-editor && npm run build --workspace @certiflow/shared && npm run build --workspace @certiflow/api",
```

- [ ] **Step 6: Commit**

```bash
git add packages/canva-editor package.json package-lock.json
git commit -m "chore: vendor canva-editor as frozen workspace package"
```

### Task 2: Mount a smoke-test editor route in `apps/web`

**Files:**
- Modify: `apps/web/package.json` (add editor peer deps)
- Create: `apps/web/src/components/editor/CertificateEditor.tsx`
- Create: `apps/web/src/app/(dashboard)/editor/smoke/page.tsx` (temporary)

**Interfaces:**
- Produces: `CertificateEditor` React client component that renders the editor with a minimal config and an in-memory `onChanges` logger.

- [ ] **Step 1: Add editor runtime peer deps to web**

Run:
```bash
npm install --workspace @certiflow/web @emotion/react@^11.14.0 @emotion/styled@^11.11.0 styled-components@^6.1.17
```
Expected: installs without peer conflicts (React 19).

- [ ] **Step 2: Create the client wrapper**

Create `apps/web/src/components/editor/CertificateEditor.tsx`:
```tsx
'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

const CanvaEditor = dynamic(
  () => import('@certiflow/canva-editor').then((m) => m.CanvaEditor as ComponentType<any>),
  { ssr: false }
);

export type CertificateEditorProps = {
  name: string;
  design: unknown;                       // saved editor_document JSON (or undefined for blank)
  config: any;                           // EditorConfig from editor-config.ts
  saving: boolean;
  onChanges: (design: unknown) => void;
  onNameChange: (name: string) => void;
  onRemove: () => void;
};

export default function CertificateEditor(props: CertificateEditorProps) {
  return (
    <CanvaEditor
      data={{ name: props.name, editorConfig: props.design }}
      config={props.config}
      saving={props.saving}
      onChanges={props.onChanges}
      onDesignNameChanges={props.onNameChange}
      onRemove={props.onRemove}
    />
  );
}
```

- [ ] **Step 3: Create a temporary smoke page**

Create `apps/web/src/app/(dashboard)/editor/smoke/page.tsx`:
```tsx
'use client';

import CertificateEditor from '@/components/editor/CertificateEditor';

const smokeConfig = {
  apis: { url: '/api/editor', userToken: '', searchFonts: '/search-fonts', searchTemplates: '/search-templates', searchTexts: '/search-texts', searchImages: '/search-images', searchShapes: '/search-shapes', searchFrames: '/search-frames', fetchUserImages: '/your-uploads/get-user-images', uploadUserImage: '/your-uploads/upload', removeUserImage: '/your-uploads/remove', templateKeywordSuggestion: '/template-suggestion', textKeywordSuggestion: '/text-suggestion', imageKeywordSuggestion: '/image-suggestion', shapeKeywordSuggestion: '/shape-suggestion', frameKeywordSuggestion: '/frame-suggestion' },
  unsplash: { accessKey: '', pageSize: 30 },
  editorAssetsUrl: '/editor-assets',
};

export default function EditorSmokePage() {
  return (
    <CertificateEditor
      name="Smoke test"
      design={undefined}
      config={smokeConfig}
      saving={false}
      onChanges={(d) => console.log('changes', d)}
      onNameChange={(n) => console.log('name', n)}
      onRemove={() => console.log('remove')}
    />
  );
}
```

- [ ] **Step 4: Verify by driving the app**

Run: `npm run dev:web` and open `http://localhost:3000/editor/smoke`.
Expected: the editor canvas + toolbar render (asset/data 404s are OK at this stage — Phases 1–2 wire the backend). No React/emotion crash. If styled-components SSR warns, confirm `apps/web` renders the wrapper client-only (`ssr:false`) — it does.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/src/components/editor/CertificateEditor.tsx apps/web/src/app/\(dashboard\)/editor/smoke/page.tsx package-lock.json
git commit -m "feat: mount canva-editor smoke route in web app"
```

---

## PHASE 1 — Editor saves & loads real templates

### Task 3: Migrate `certificate_templates` for rich designs

**Files:**
- Create: migration in the project's DB migration location. If none exists, create `apps/api/src/scripts/migrate-editor-document.ts` following the pattern of `apps/api/src/scripts/reset-db.ts`.
- Test: `apps/api/src/scripts/__tests__/migrate-editor-document.test.ts` (or manual verify — see Step 4).

**Interfaces:**
- Produces: columns `certificate_templates.editor_document jsonb NULL`, `certificate_templates.render_engine text NOT NULL DEFAULT 'legacy'`.

- [ ] **Step 1: Write the migration**

Create `apps/api/src/scripts/migrate-editor-document.ts`:
```ts
import { pool } from '../db/pool';

async function run() {
  await pool.query(`
    ALTER TABLE certificate_templates
      ADD COLUMN IF NOT EXISTS editor_document jsonb,
      ADD COLUMN IF NOT EXISTS render_engine text NOT NULL DEFAULT 'legacy';
  `);
  await pool.query(`
    ALTER TABLE certificate_templates
      ADD CONSTRAINT certificate_templates_render_engine_chk
      CHECK (render_engine IN ('legacy','editor')) NOT VALID;
  `).catch(() => undefined); // ignore if already present
  console.log('editor_document migration complete');
  await pool.end();
}

run().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run the migration**

Run: `npx tsx apps/api/src/scripts/migrate-editor-document.ts` (use the repo's existing script runner if different — check how `reset-db.ts` is invoked).
Expected: prints `editor_document migration complete`.

- [ ] **Step 3: Verify columns exist**

Run:
```bash
npx tsx -e "import{pool}from'./apps/api/src/db/pool';pool.query(\"select column_name from information_schema.columns where table_name='certificate_templates' and column_name in ('editor_document','render_engine')\").then(r=>{console.log(r.rows);return pool.end()})"
```
Expected: two rows: `editor_document`, `render_engine`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/scripts/migrate-editor-document.ts
git commit -m "feat: add editor_document and render_engine to certificate_templates"
```

### Task 4: Persist & load design JSON via the template service + API

**Files:**
- Modify: `apps/api/src/services/certificate-templates.ts`
- Modify: `apps/api/src/routes/certificate-templates.ts`
- Test: `apps/api/src/services/__tests__/certificate-templates.editor.test.ts`

**Interfaces:**
- Consumes: `pool`, `withTransaction`, `getCertificateTemplateById` (existing).
- Produces:
  - Service: `updateCertificateTemplateDesign(params: { templateId: string; companyId: string; updatedBy: string; name?: string; editorDocument: unknown }): Promise<MappedTemplate>` — sets `editor_document` and `render_engine='editor'`.
  - Mapped template now includes `editorDocument: unknown | null` and `renderEngine: 'legacy' | 'editor'`.
  - Route: `PUT /certificate-templates/:id/design` (body `{ name?: string; editorDocument: unknown }`), `GET /certificate-templates/:id` returns `editorDocument` + `renderEngine`.

- [ ] **Step 1: Write the failing service test**

Create `apps/api/src/services/__tests__/certificate-templates.editor.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { updateCertificateTemplateDesign, getCertificateTemplateById } from '../certificate-templates';
// Assumes a test company + template fixture helper exists; if not, create one mirroring existing service tests.
import { seedTemplateFixture } from './helpers';

describe('updateCertificateTemplateDesign', () => {
  it('stores editor_document and flips render_engine to editor', async () => {
    const { templateId, companyId, userId } = await seedTemplateFixture();
    const design = { pages: [{ layers: [{ type: 'Text', text: 'Hello {{recipient_name}}' }] }] };
    const updated = await updateCertificateTemplateDesign({ templateId, companyId, updatedBy: userId, editorDocument: design });
    expect(updated.renderEngine).toBe('editor');
    const reloaded = await getCertificateTemplateById(templateId, companyId);
    expect(reloaded?.editorDocument).toEqual(design);
  });
});
```
(If the repo has no vitest setup for `apps/api`, add `vitest` as a dev dep and a minimal `vitest.config.ts`; otherwise follow the existing test runner. If no fixture helper exists, write `helpers.ts` that inserts a company + a legacy template via the existing `createCertificateTemplate`.)

- [ ] **Step 2: Run the test — expect failure**

Run: `npx vitest run apps/api/src/services/__tests__/certificate-templates.editor.test.ts`
Expected: FAIL — `updateCertificateTemplateDesign is not a function`.

- [ ] **Step 3: Extend the mapper and add the service function**

In `apps/api/src/services/certificate-templates.ts`, add to `CertificateTemplateRow` type: `editor_document: unknown | null; render_engine: string;`. In `mapTemplateRow`, add: `editorDocument: row.editor_document ?? null, renderEngine: row.render_engine === 'editor' ? 'editor' : 'legacy',`. Add `editor_document, render_engine` to every `SELECT` list in this file. Then append:
```ts
export async function updateCertificateTemplateDesign(params: {
  templateId: string;
  companyId: string;
  updatedBy: string;
  name?: string;
  editorDocument: unknown;
}) {
  const current = await getCertificateTemplateById(params.templateId, params.companyId);
  if (!current) {
    throw new AppError('Certificate template not found', 404);
  }
  const result = await pool.query<CertificateTemplateRow>(
    `UPDATE certificate_templates
       SET name = COALESCE($3, name),
           editor_document = $4::jsonb,
           render_engine = 'editor',
           updated_by = $5,
           updated_at = NOW()
     WHERE id = $1 AND company_id = $2
     RETURNING id, company_id, name, background_upload_id, field_config, issue_date_mode,
               issue_date_value, image_width, image_height, is_active, created_at, updated_at,
               editor_document, render_engine`,
    [params.templateId, params.companyId, params.name ?? null, JSON.stringify(params.editorDocument ?? {}), params.updatedBy]
  );
  const updated = result.rows[0];
  if (!updated) throw new AppError('Certificate template not found', 404);
  return mapTemplateRow({
    ...updated,
    background_original_name: current.backgroundOriginalName,
    background_stored_path: current.backgroundStoredPath
  });
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npx vitest run apps/api/src/services/__tests__/certificate-templates.editor.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the route**

In `apps/api/src/routes/certificate-templates.ts`, import `updateCertificateTemplateDesign` and add before `export default router;`:
```ts
router.put(
  '/:id/design',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const template = await getCertificateTemplateById(String(req.params.id));
    if (!template) throw new AppError('Certificate template not found', 404);
    if (req.user?.role !== 'super_admin' && template.companyId !== req.user?.companyId) {
      throw new AppError('Forbidden', 403);
    }
    const body = z.object({
      name: z.string().min(1).optional(),
      editorDocument: z.unknown()
    }).parse(req.body);
    const updated = await updateCertificateTemplateDesign({
      templateId: String(req.params.id),
      companyId: template.companyId,
      updatedBy: req.user!.id,
      name: body.name,
      editorDocument: body.editorDocument
    });
    res.json({ template: updated });
  })
);
```

- [ ] **Step 6: Verify the route end-to-end**

Run the API, then:
```bash
curl -s -X PUT http://localhost:4000/certificate-templates/<ID>/design -H 'Content-Type: application/json' -H 'Cookie: <auth>' -d '{"editorDocument":{"pages":[]}}' | head
```
Expected: JSON `{ "template": { ..., "renderEngine": "editor", "editorDocument": {"pages":[]} } }`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/certificate-templates.ts apps/api/src/routes/certificate-templates.ts apps/api/src/services/__tests__/
git commit -m "feat: persist and load canva-editor design json on templates"
```

### Task 5: Real `EditorConfig` builder (data + assets + merge fields)

**Files:**
- Create: `apps/web/src/components/editor/editor-config.ts`
- Create: `apps/web/src/lib/editor-templates.ts`

**Interfaces:**
- Produces:
  - `buildEditorConfig(opts: { token: string; fields: string[] }): EditorConfigLike` — `apis.url = "/api/editor"`, all endpoints per the upstream shape, `unsplash.accessKey = ""` (disabled), `editorAssetsUrl = "/editor-assets"`, `translations = {}`.
  - `saveDesign(templateId: string, payload: { name?: string; editorDocument: unknown }): Promise<void>`, `getTemplate(templateId: string): Promise<Template>`, `cloneTemplate(templateId: string): Promise<Template>`.

- [ ] **Step 1: Create the config builder**

Create `apps/web/src/components/editor/editor-config.ts`:
```ts
export type EditorConfigLike = ReturnType<typeof buildEditorConfig>;

export function buildEditorConfig(opts: { token: string; fields: string[] }) {
  return {
    apis: {
      url: '/api/editor',
      userToken: opts.token,
      searchFonts: '/search-fonts',
      searchTemplates: '/search-templates',
      searchTexts: '/search-texts',
      searchImages: '/search-images',
      searchShapes: '/search-shapes',
      searchFrames: '/search-frames',
      fetchUserImages: '/your-uploads/get-user-images',
      uploadUserImage: '/your-uploads/upload',
      removeUserImage: '/your-uploads/remove',
      templateKeywordSuggestion: '/template-suggestion',
      textKeywordSuggestion: '/text-suggestion',
      imageKeywordSuggestion: '/image-suggestion',
      shapeKeywordSuggestion: '/shape-suggestion',
      frameKeywordSuggestion: '/frame-suggestion',
    },
    unsplash: { accessKey: '', pageSize: 30 },   // disabled
    editorAssetsUrl: '/editor-assets',
    mergeFields: opts.fields,                     // consumed by Task 11
    translations: {},
  };
}
```

- [ ] **Step 2: Create the client API helpers**

Create `apps/web/src/lib/editor-templates.ts` using the existing `apps/web/src/lib/api.ts` client:
```ts
import { api } from './api';

export function getTemplate(id: string) {
  return api.get(`/certificate-templates/${id}`).then((r) => r.template);
}
export function saveDesign(id: string, payload: { name?: string; editorDocument: unknown }) {
  return api.put(`/certificate-templates/${id}/design`, payload);
}
export function cloneTemplate(id: string) {
  return api.post(`/certificate-templates/${id}/duplicate`, {}).then((r) => r.template);
}
```
(Adjust method names to match `apps/web/src/lib/api.ts`'s actual interface — inspect it first.)

- [ ] **Step 3: Typecheck**

Run: `npm run build --workspace @certiflow/web` (or `tsc --noEmit` in web).
Expected: no type errors in the new files.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/editor/editor-config.ts apps/web/src/lib/editor-templates.ts
git commit -m "feat: add editor config builder and template api helpers"
```

### Task 6: `/editor/[id]` and `/editor/new` pages with autosave

**Files:**
- Create: `apps/web/src/app/(dashboard)/editor/[id]/page.tsx`
- Create: `apps/web/src/app/(dashboard)/editor/[id]/editor-client.tsx`
- Create: `apps/web/src/app/(dashboard)/editor/new/page.tsx`
- Delete: `apps/web/src/app/(dashboard)/editor/smoke/page.tsx`

**Interfaces:**
- Consumes: `CertificateEditor`, `buildEditorConfig`, `getTemplate`, `saveDesign`.
- Produces: routes that load a template's `editorDocument`, mount the editor, and debounce-save on `onChanges`.

- [ ] **Step 1: Create the editor client component with debounced save**

Create `apps/web/src/app/(dashboard)/editor/[id]/editor-client.tsx`:
```tsx
'use client';

import { useCallback, useRef, useState } from 'react';
import CertificateEditor from '@/components/editor/CertificateEditor';
import { buildEditorConfig } from '@/components/editor/editor-config';
import { saveDesign } from '@/lib/editor-templates';
import { useEditorLockdown } from '@/components/editor/lockdown'; // added in Task 17 (no-op stub until then)

const MERGE_FIELDS = ['recipient_name', 'issue_date', 'course', 'certificate_id'];

export default function EditorClient({ templateId, name, design, token }: {
  templateId: string; name: string; design: unknown; token: string;
}) {
  useEditorLockdown();
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const config = buildEditorConfig({ token, fields: MERGE_FIELDS });

  const onChanges = useCallback((next: unknown) => {
    if (timer.current) clearTimeout(timer.current);
    setSaving(true);
    timer.current = setTimeout(() => {
      saveDesign(templateId, { editorDocument: next }).finally(() => setSaving(false));
    }, 800);
  }, [templateId]);

  const onNameChange = useCallback((n: string) => { saveDesign(templateId, { name: n, editorDocument: design }); }, [templateId, design]);

  return (
    <CertificateEditor
      name={name}
      design={design}
      config={config}
      saving={saving}
      onChanges={onChanges}
      onNameChange={onNameChange}
      onRemove={() => history.back()}
    />
  );
}
```
(Provide a temporary no-op `useEditorLockdown` in `lockdown.ts` now: `export function useEditorLockdown() {}` — Task 17 fills it in.)

- [ ] **Step 2: Create the server page that loads the template**

Create `apps/web/src/app/(dashboard)/editor/[id]/page.tsx`:
```tsx
import EditorClient from './editor-client';
import { getTemplate } from '@/lib/editor-templates';
import { getServerAuthToken } from '@/lib/api'; // use the app's existing server-side token accessor

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await getTemplate(id);
  const token = await getServerAuthToken();
  return (
    <EditorClient
      templateId={id}
      name={template.name}
      design={template.editorDocument ?? undefined}
      token={token}
    />
  );
}
```
(Match the app's real auth-token retrieval; inspect `(dashboard)/layout.tsx` and `lib/api.ts` for the pattern.)

- [ ] **Step 3: Create `/editor/new` (create-then-redirect)**

Create `apps/web/src/app/(dashboard)/editor/new/page.tsx` that: creates a blank `certificate_templates` row (reuse the existing create endpoint or add a lightweight `POST /certificate-templates/blank` that inserts a name + empty `editor_document` with `render_engine='editor'`), then `redirect(`/editor/${id}`)`. If adding the endpoint, mirror ownership checks from Task 4.

- [ ] **Step 4: Remove the smoke page**

```bash
git rm apps/web/src/app/\(dashboard\)/editor/smoke/page.tsx
```

- [ ] **Step 5: Verify by driving the app**

Run full stack (`npm run dev`), open `/editor/<existing-id>`, add a text box, wait ~1s, reload the page.
Expected: the text box persists (design JSON round-tripped through `PUT /:id/design` → `editor_document`). Network tab shows the debounced PUT.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/editor package-lock.json
git commit -m "feat: certificate editor pages with autosave to editor_document"
```

---

## PHASE 2 — Editor backend, assets, fonts, uploads, fields, stock templates

### Task 7: Self-host editor static assets (`editorAssetsUrl`)

**Files:**
- Create: `apps/web/public/editor-assets/**` (cursors + text-effect assets)

**Interfaces:**
- Produces: `/editor-assets/cursors/rotate/*.png`, `/editor-assets/cursors/resize/*.png`, plus any text-effect assets referenced by `getEffectList(editorAssetsUrl)`.

- [ ] **Step 1: Enumerate required asset paths**

Run (in scratchpad):
```bash
grep -rhoE "editorAssetsUrl}[^\`'\")]*" packages/canva-editor/src | sort -u
```
Expected: list like `/cursors/rotate/...`, `/cursors/resize/...`, text-effect asset paths.

- [ ] **Step 2: Fetch the assets from the upstream asset host and vendor them**

The upstream `editorAssetsUrl` is `https://canva-editor-api.vercel.app/editor`. For each path from Step 1, download into `apps/web/public/editor-assets/...` preserving the subpath. Example:
```bash
mkdir -p apps/web/public/editor-assets/cursors/rotate apps/web/public/editor-assets/cursors/resize
# for each cursor file name found in ResizeHandler/RotateHandler/CornerResizeHandler:
curl -s -o apps/web/public/editor-assets/cursors/resize/<file>.png "https://canva-editor-api.vercel.app/editor/cursors/resize/<file>.png"
```
(Cursor filenames are derived from angle indices in `ResizeHandler.tsx`/`RotateHandle.tsx` — read those files for the exact set.)

- [ ] **Step 3: Verify assets serve locally**

Run web dev, open `http://localhost:3000/editor-assets/cursors/resize/<file>.png`.
Expected: image loads (200).

- [ ] **Step 4: Verify cursors render in editor**

Open `/editor/<id>`, select a layer, hover the resize handles.
Expected: custom resize/rotate cursors show (no 404s in console for `/editor-assets/...`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/public/editor-assets
git commit -m "feat: self-host canva-editor cursor and effect assets"
```

### Task 8: Port the editor content backend to `/api/editor`

**Files:**
- Create: `apps/api/src/data/editor/{fonts,shapes,frames,texts,templates}.json` (ported from scratchpad `apps/mock-api/src/json/`)
- Create: `apps/api/src/services/editor-assets.ts`
- Create: `apps/api/src/routes/editor.ts`
- Modify: `apps/api/src/app.ts` (mount router at `/api/editor`)
- Test: `apps/api/src/routes/__tests__/editor.test.ts`

**Interfaces:**
- Consumes: curated JSON datasets.
- Produces: `GET /api/editor/search-fonts`, `/search-shapes`, `/search-frames`, `/search-texts`, `/search-templates` — each accepts `ps` (page size), `pi` (page index), `kw` (keyword) and returns the upstream-shaped array the editor expects. Keyword-suggestion endpoints return `string[]`. `/search-images` returns `[]` (Unsplash disabled).

- [ ] **Step 1: Copy curated datasets**

```bash
mkdir -p apps/api/src/data/editor
cp "…/scratchpad/canva-editor/apps/mock-api/src/json/"{fonts,shapes,frames,texts,templates}.json apps/api/src/data/editor/
```

- [ ] **Step 2: Write the failing route test**

Create `apps/api/src/routes/__tests__/editor.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app';

describe('GET /api/editor/search-shapes', () => {
  it('returns a paged array of shapes', async () => {
    const res = await request(app).get('/api/editor/search-shapes?ps=5&pi=0&kw=');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeLessThanOrEqual(5);
  });
});
describe('GET /api/editor/search-images', () => {
  it('returns empty when UNSPLASH_ACCESS_KEY is unset', async () => {
    // Task 10a implements the Unsplash proxy; with no key configured it must degrade to [].
    const res = await request(app).get('/api/editor/search-images?ps=5&pi=0&kw=x');
    expect(res.body).toEqual([]);
  });
});
```
(Add `supertest` + `vitest` as api dev-deps if absent. Ensure `app.ts` exports `app`.)

- [ ] **Step 3: Run — expect failure**

Run: `npx vitest run apps/api/src/routes/__tests__/editor.test.ts`
Expected: FAIL (404 — router not mounted).

- [ ] **Step 4: Implement the assets service**

Create `apps/api/src/services/editor-assets.ts`:
```ts
import shapes from '../data/editor/shapes.json';
import frames from '../data/editor/frames.json';
import texts from '../data/editor/texts.json';
import templates from '../data/editor/templates.json';
import fonts from '../data/editor/fonts.json';

function page<T>(items: T[], ps: number, pi: number) {
  const size = Number.isFinite(ps) && ps > 0 ? ps : 18;
  const index = Number.isFinite(pi) && pi >= 0 ? pi : 0;
  return items.slice(index * size, index * size + size);
}
export const editorDatasets = { shapes, frames, texts, templates, fonts };
export function searchDataset(key: keyof typeof editorDatasets, ps: number, pi: number, _kw: string) {
  return page(editorDatasets[key] as unknown[], ps, pi);
}
```
(Ensure `tsconfig` has `resolveJsonModule: true` for the api workspace.)

- [ ] **Step 5: Implement the router**

Create `apps/api/src/routes/editor.ts`:
```ts
import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { searchDataset } from '../services/editor-assets';

const router = Router();
const num = (v: unknown, d: number) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

function makeSearch(key: 'shapes' | 'frames' | 'texts' | 'templates') {
  return asyncHandler(async (req, res) => {
    res.json(searchDataset(key, num(req.query.ps, 18), num(req.query.pi, 0), String(req.query.kw ?? '')));
  });
}
router.get('/search-shapes', makeSearch('shapes'));
router.get('/search-frames', makeSearch('frames'));
router.get('/search-texts', makeSearch('texts'));
router.get('/search-templates', makeSearch('templates'));
// /search-images is implemented as an Unsplash proxy in Task 10a (returns [] until then / when no key)
for (const p of ['/template-suggestion','/text-suggestion','/image-suggestion','/shape-suggestion','/frame-suggestion']) {
  router.get(p, asyncHandler(async (_req, res) => res.json([])));
}
export default router;
```

- [ ] **Step 6: Mount the router**

In `apps/api/src/app.ts`, add: `import editorRouter from './routes/editor';` and `app.use('/api/editor', editorRouter);`.

- [ ] **Step 7: Run the test — expect pass**

Run: `npx vitest run apps/api/src/routes/__tests__/editor.test.ts`
Expected: PASS.

- [ ] **Step 8: Verify in the editor**

Open `/editor/<id>`, open the Shapes and Frames sidebar tabs.
Expected: shapes/frames populate; Images tab is empty; no console 404s for these endpoints.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/data/editor apps/api/src/services/editor-assets.ts apps/api/src/routes/editor.ts apps/api/src/app.ts apps/api/src/routes/__tests__/editor.test.ts
git commit -m "feat: serve editor shapes/frames/texts/templates from /api/editor"
```

### Task 9: Bundle fonts (shared editor + renderer source of truth)

**Files:**
- Create: `apps/api/src/data/editor/fonts/**` (font files + css), `apps/api/src/data/editor/fonts.json`
- Modify: `apps/api/src/routes/editor.ts` (add `/search-fonts` + static font serving)

**Interfaces:**
- Produces: `GET /api/editor/search-fonts?...` returning font descriptors (upstream shape from `fonts.json`, with `url` pointing at `/api/editor/fonts/<file>`); `GET /api/editor/fonts/*` serving the woff2/ttf files. **Font family names + files here are the exact set the headless renderer (Task 13) loads.**

- [ ] **Step 1: Vendor the font files + css**

```bash
mkdir -p apps/api/src/data/editor/fonts
cp -r "…/scratchpad/canva-editor/apps/mock-api/public/fonts/"* apps/api/src/data/editor/fonts/
```
Trim to a curated set (e.g. 10–15 families) to keep the render environment light; edit `fonts.json` to match the kept files and rewrite each font `url` to `/api/editor/fonts/<relativepath>`.

- [ ] **Step 2: Add font endpoints to the router**

In `apps/api/src/routes/editor.ts` add:
```ts
import path from 'path';
import express from 'express';
import { editorDatasets } from '../services/editor-assets';

router.get('/search-fonts', asyncHandler(async (req, res) => {
  res.json(searchDataset('fonts', num(req.query.ps, 30), num(req.query.pi, 0), String(req.query.kw ?? '')));
}));
router.use('/fonts', express.static(path.join(__dirname, '..', 'data', 'editor', 'fonts')));
```

- [ ] **Step 3: Verify fonts load in the editor**

Open `/editor/<id>`, open the font-family picker, apply a non-default font to a text box.
Expected: the font list populates from `/api/editor/search-fonts`; applying a font changes the rendered glyphs; no 404 on `/api/editor/fonts/...`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/data/editor/fonts apps/api/src/data/editor/fonts.json apps/api/src/routes/editor.ts
git commit -m "feat: bundle and serve editor fonts as shared render source of truth"
```

### Task 10: User image upload/fetch/remove wired to CertiFlow uploads

**Files:**
- Modify: `apps/api/src/routes/editor.ts` (add `/your-uploads/*`)
- Test: `apps/api/src/routes/__tests__/editor-uploads.test.ts`

**Interfaces:**
- Consumes: existing `uploads` table + `UPLOAD_DIR` + `multer` disk storage pattern (copy from `certificate-templates.ts`), `requireAuth`, `req.user.companyId`.
- Produces (upstream-shaped): `POST /api/editor/your-uploads/upload` (multipart, field `image`) → `{ url, id }`; `GET /api/editor/your-uploads/get-user-images` → array of `{ id, url }` for the company; `DELETE /api/editor/your-uploads/remove/:id` → 204.

- [ ] **Step 1: Write the failing test** (authenticated upload returns a URL). Mirror auth-mocking from existing api route tests.

- [ ] **Step 2: Run — expect failure.**

- [ ] **Step 3: Implement the three handlers** in `editor.ts` using a `multer` disk-storage instance writing under `UPLOAD_DIR/company-<id>/editor-images/`, inserting an `uploads` row (`kind='image'`), and returning `{ id, url: toFileUrl(storedPath) }`. Scope `get-user-images` and `remove` by `req.user.companyId` (super_admin may pass `?companyId=`). Enforce `requireAuth` on all three.

- [ ] **Step 4: Run — expect pass.**

- [ ] **Step 5: Verify in the editor** — Uploads tab: upload a PNG, see it appear, drag it onto the canvas, delete it.

- [ ] **Step 6: Commit** `feat: wire editor user-image uploads to certiflow uploads`.

### Task 10a: Unsplash image search proxy + persistence

**Files:**
- Modify: `apps/api/src/config/env.ts` (add `UNSPLASH_ACCESS_KEY` — optional, default `''`)
- Create: `apps/api/src/services/unsplash.ts`
- Modify: `apps/api/src/routes/editor.ts` (implement `/search-images`; add `/your-uploads/import-url`)
- Modify: `apps/web/src/components/editor/editor-config.ts` (leave `unsplash.accessKey = ''` — the client uses the proxy, not a client-side key)
- Test: `apps/api/src/services/__tests__/unsplash.test.ts`

**Interfaces:**
- Consumes: `UNSPLASH_ACCESS_KEY`, `fetch` (Node 20 global), the uploads insert helper from Task 10.
- Produces:
  - `searchUnsplash(kw: string, ps: number, pi: number): Promise<Array<{ img: string; desc?: string; source: 'unsplash'; downloadLocationUrl?: string }>>` — returns `[]` when no key; maps Unsplash `results[]` to the editor's image shape (`img` = `urls.regular`).
  - Route `GET /api/editor/search-images?ps&pi&kw` → the mapped array.
  - Route `POST /api/editor/your-uploads/import-url` `{ url }` (authed) → downloads the image into CertiFlow uploads and returns `{ id, url }` (used when a user places an Unsplash photo, so the design references our stored copy).

- [ ] **Step 1: Write the failing test** — `searchUnsplash` returns `[]` when `UNSPLASH_ACCESS_KEY` is empty; when a key is present, mock `fetch` to return a fixture Unsplash payload and assert the mapped `img` URLs. 

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('searchUnsplash', () => {
  beforeEach(() => vi.resetModules());
  it('returns [] with no key', async () => {
    vi.doMock('../../config/env', () => ({ env: { UNSPLASH_ACCESS_KEY: '' } }));
    const { searchUnsplash } = await import('../unsplash');
    expect(await searchUnsplash('flowers', 5, 0)).toEqual([]);
  });
  it('maps results when key present', async () => {
    vi.doMock('../../config/env', () => ({ env: { UNSPLASH_ACCESS_KEY: 'k' } }));
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ urls: { regular: 'https://img/1' }, description: 'a flower', links: { download_location: 'https://dl/1' } }] }) }) as any;
    const { searchUnsplash } = await import('../unsplash');
    const out = await searchUnsplash('flowers', 5, 0);
    expect(out[0].img).toBe('https://img/1');
    expect(out[0].source).toBe('unsplash');
  });
});
```

- [ ] **Step 2: Run — expect failure.**

- [ ] **Step 3: Implement `searchUnsplash`** in `apps/api/src/services/unsplash.ts`:
```ts
import { env } from '../config/env';

export async function searchUnsplash(kw: string, ps: number, pi: number) {
  if (!env.UNSPLASH_ACCESS_KEY) return [];
  const q = encodeURIComponent(kw || 'background');
  const url = `https://api.unsplash.com/search/photos?query=${q}&per_page=${ps || 18}&page=${(pi || 0) + 1}`;
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []).map((r: any) => ({
    img: r.urls?.regular,
    desc: r.description ?? r.alt_description ?? undefined,
    source: 'unsplash' as const,
    downloadLocationUrl: r.links?.download_location
  }));
}
```

- [ ] **Step 4: Run — expect pass.**

- [ ] **Step 5: Wire the route** — replace the `/search-images` placeholder in `editor.ts` with `res.json(await searchUnsplash(String(req.query.kw ?? ''), num(req.query.ps,18), num(req.query.pi,0)))`. Add the authed `POST /your-uploads/import-url` handler that fetches `url`, streams it to `UPLOAD_DIR/company-<id>/editor-images/`, inserts an `uploads` row, and returns `{ id, url }`. (Also fire the Unsplash `download_location` ping per their API terms when importing, if `downloadLocationUrl` is provided.)

- [ ] **Step 6: Verify in the editor** — set `UNSPLASH_ACCESS_KEY` in `apps/api/.env`, open `/editor/<id>`, search "flowers" in the Images sidebar → Unsplash photos appear; drop one on the canvas; confirm (network) it is imported to our uploads and the design references our URL. Also confirm searching "golden border" in the **Shapes/Frames** tab surfaces decorative graphics.

- [ ] **Step 7: Commit** `feat: unsplash image search proxy with upload persistence`.

### Task 11: Merge-field placeholders ("Insert field") + live preview

**Files:**
- Modify: `packages/canva-editor/src/layout/sidebar/**` (add an "Insert field" panel/menu) — minimal, localized change to the frozen fork.
- Modify: `apps/web/src/app/(dashboard)/editor/[id]/editor-client.tsx` (pass `mergeFields` + sample values)
- Test: `apps/api/src/services/__tests__/editor-render-merge.test.ts` (token merge unit — the merge fn is reused by Task 14)

**Interfaces:**
- Produces: `mergeEditorDocument(design: unknown, context: Record<string, string>): unknown` in `apps/api/src/services/editor-render.ts` — deep-clones the design and replaces `{{token}}` occurrences in every text layer's string using the existing `renderTemplateString`.

- [ ] **Step 1: Write the failing merge test**

```ts
import { describe, it, expect } from 'vitest';
import { mergeEditorDocument } from '../editor-render';

it('replaces tokens in text layers', () => {
  const design = { pages: [{ layers: { a: { type: 'Text', props: { text: 'Hi {{recipient_name}}' } } } }] };
  const out: any = mergeEditorDocument(design, { recipient_name: 'Asha' });
  expect(out.pages[0].layers.a.props.text).toBe('Hi Asha');
});
```
(Confirm the exact text-layer shape from a real saved `editor_document` — capture one from Task 6 and adjust the path the merge walks. The editor stores layers keyed by id with a `type` and `props`; verify against a saved sample before finalizing the walker.)

- [ ] **Step 2: Run — expect failure.**

- [ ] **Step 3: Implement `mergeEditorDocument`** in `apps/api/src/services/editor-render.ts` — recursive walk that, for any object with `type === 'Text'`, runs `renderTemplateString` (from `template-placeholders.ts`) over its text prop(s). Import `renderTemplateString`.

- [ ] **Step 4: Run — expect pass.**

- [ ] **Step 5: Add the "Insert field" UI in the fork** — add a small sidebar section (or a button in the text toolbar) that inserts a text layer containing the chosen `{{field}}`; source the field list from `config.mergeFields`. Keep the change minimal and self-contained.

- [ ] **Step 6: Verify in the editor** — insert `{{recipient_name}}`, save, reload; confirm token persists in `editor_document`.

- [ ] **Step 7: Commit** `feat: merge-field placeholders and document token merge`.

### Task 12: Stock templates + gallery "Edit this template" / "Create my own"

**Files:**
- Create: `apps/api/src/data/editor/stock-templates/*.json` (3–6 authored designs)
- Modify: `apps/api/src/routes/editor.ts` or `certificate-templates.ts` (list stock templates; clone-into-company)
- Modify: `apps/web/src/app/(dashboard)/templates/page.tsx` (buttons)

**Interfaces:**
- Produces: `GET /certificate-templates/stock` → `[{ id, name, thumbnailUrl }]`; `POST /certificate-templates/from-stock` `{ stockId }` → creates a company-owned `certificate_templates` row with the stock design as `editor_document`, `render_engine='editor'`, returns `{ template }`.

- [ ] **Step 1: Author stock designs** — build 3 in the running editor (offer letter, certificate of completion, notice), capture each `editor_document` JSON (from the save PUT payload), save as `stock-templates/*.json` with a `name` and a pre-rendered `thumbnail` (generate via Task 14 renderer once available, or a placeholder PNG initially).

- [ ] **Step 2: Add stock list + clone endpoints** (mirror ownership + company-active checks from existing create route).

- [ ] **Step 3: Wire gallery buttons** — on `templates/page.tsx`, each template card gets **"Edit this template"** → `router.push('/editor/'+id)`; a **"Create my own"** button → `/editor/new`; a stock-template section whose cards call `POST /from-stock` then push to `/editor/<newId>`.

- [ ] **Step 4: Verify by driving the app** — from the gallery: "Create my own" opens a blank editor; "Edit this template" opens an existing design; picking a stock template clones it and opens the copy.

- [ ] **Step 5: Commit** `feat: stock templates and gallery edit/create entry points`.

---

## PHASE 3 — Headless render + signing

### Task 13: Headless render-mode page + Puppeteer bootstrap

**Files:**
- Create: `apps/web/src/app/(render)/render/[id]/page.tsx` — a chromeless page that loads a design + injected data and renders the pages read-only (reuse the editor's existing `?preview` mode / `Preview` component).
- Modify: `apps/api/package.json` (add `puppeteer`)
- Create: `apps/api/src/services/editor-render.ts` (Puppeteer launch already partly present from Task 11 — extend)

**Interfaces:**
- Produces: a render URL `GET /render/[id]?token=...` that renders the merged design full-bleed, sets `window.__RENDER_READY__ = true` when fonts + images are loaded, and exposes page pixel dimensions via a DOM attribute for PDF sizing.

- [ ] **Step 1: Build the chromeless render page** using the editor's `Preview`/`isPreview` path so the same layout code renders the design (parity). It fetches the design (or receives it via query/session) and the merged context, applies fonts from `/api/editor/fonts`, and signals readiness.

- [ ] **Step 2: Add Puppeteer** `npm install --workspace @certiflow/api puppeteer`. Document the Chromium download in the worker deploy notes.

- [ ] **Step 3: Verify manually** — open `/render/<id>?...` in a browser: the design renders with no toolbar/sidebar, fonts correct, at the template's page size.

- [ ] **Step 4: Commit** `feat: chromeless render-mode page and puppeteer dependency`.

### Task 14: JSON → high-res PDF renderer with golden-image parity test

**Files:**
- Modify: `apps/api/src/services/editor-render.ts`
- Test: `apps/api/src/services/__tests__/editor-render.golden.test.ts`

**Interfaces:**
- Consumes: `mergeEditorDocument`, the `/render/[id]` page, the bundled fonts.
- Produces: `renderEditorPdf(params: { editorDocument: unknown; context: Record<string, string>; baseUrl: string }): Promise<Buffer>` — launches Chromium, opens the render page with the merged design, waits for `__RENDER_READY__`, prints to PDF at the design's exact page size, returns the PDF buffer.

- [ ] **Step 1: Write the golden test** — render a fixed design + fixed context to PDF, rasterize page 1 (via the existing pdfjs+canvas path), and assert it matches a committed golden PNG within a small pixel-diff tolerance. Commit the golden after first manual visual approval.

- [ ] **Step 2: Run — expect failure** (function missing).

- [ ] **Step 3: Implement `renderEditorPdf`** — `puppeteer.launch({ args: ['--no-sandbox'] })`, `page.setViewport` to design size, `page.goto(renderUrl, { waitUntil: 'networkidle0' })`, `page.waitForFunction('window.__RENDER_READY__ === true')`, `page.pdf({ width, height, printBackground: true, pageRanges })`. Reuse a single browser instance across recipients in a batch (pass the `browser` in from the worker).

- [ ] **Step 4: Run — expect pass** (after approving the golden).

- [ ] **Step 5: Commit** `feat: headless json-to-pdf certificate renderer with golden test`.

### Task 15: Route the batch worker through the headless renderer + signing

**Files:**
- Modify: `apps/api/src/services/batches.ts` and the worker render step (locate where `renderCertificatePdf` is currently called for a batch).
- Test: `apps/api/src/services/__tests__/batch-render-engine.test.ts`

**Interfaces:**
- Consumes: `renderEditorPdf`, template `renderEngine`, existing QR-stamp + PAdES-signing functions.
- Produces: batch rendering that, when `template.renderEngine === 'editor'`, calls `renderEditorPdf` per recipient (shared browser), then runs the **existing** QR + signing on the resulting PDF; otherwise falls back to the legacy `renderCertificatePdf`.

- [ ] **Step 1: Write the failing test** — a batch whose template is `render_engine='editor'` produces a signed PDF via the editor path (mock `renderEditorPdf`, assert it's called and its output is passed to the signing step). A legacy template still uses `renderCertificatePdf`.

- [ ] **Step 2: Run — expect failure.**

- [ ] **Step 3: Implement the branch** in the batch render loop: launch one Chromium per batch, iterate recipients calling `renderEditorPdf({ editorDocument, context: buildTemplateContext(recipient) + issue_date, baseUrl })`, feed each buffer into the existing QR + PAdES path, close the browser in `finally`.

- [ ] **Step 4: Run — expect pass.**

- [ ] **Step 5: Verify end-to-end** — design a template in the editor, save, create a small batch (2 recipients), run it; open the delivered PDFs.
Expected: each PDF matches the design with per-recipient merged fields, carries the QR stamp, and verifies as PAdES-signed via the existing `/verify` flow.

- [ ] **Step 6: Commit** `feat: render editor templates via headless pipeline and sign`.

---

## PHASE 4 — Export/screenshot lockdown & polish

### Task 16: Remove in-app export affordances from the fork

**Files:**
- Modify: `packages/canva-editor/src/layout/HeaderLayout*.tsx` (remove PNG/PDF download buttons)
- Modify: the components that set `downloadPNGCmd` / `downloadPDFCmd` (grep the fork)
- Rebuild: `packages/canva-editor`

**Interfaces:**
- Produces: an editor build with no download/export UI and no reachable `jspdf` / `modern-screenshot` invocation from the header.

- [ ] **Step 1: Locate export triggers**

Run: `grep -rniE "downloadPNGCmd|downloadPDFCmd|jspdf|modern-screenshot" packages/canva-editor/src`

- [ ] **Step 2: Remove the download buttons** from the header layout and delete/short-circuit the effect(s) that act on `downloadPNGCmd`/`downloadPDFCmd`. Leave the state fields to avoid type churn, but never set them from UI.

- [ ] **Step 3: Rebuild + verify** `npm run build --workspace @certiflow/canva-editor`; open `/editor/<id>` — no download/export button anywhere in the header or menus.

- [ ] **Step 4: Commit** `feat: remove in-app export/download from editor`.

### Task 17: Editor-route capture deterrents

**Files:**
- Modify: `apps/web/src/components/editor/lockdown.ts` (replace the no-op)

**Interfaces:**
- Produces: `useEditorLockdown()` hook that, on mount, disables `contextmenu`, image drag-save, and the print path on the editor route, and cleans up on unmount.

- [ ] **Step 1: Implement the hook**

```ts
'use client';
import { useEffect } from 'react';

export function useEditorLockdown() {
  useEffect(() => {
    const onCtx = (e: MouseEvent) => e.preventDefault();
    const onDrag = (e: DragEvent) => { if ((e.target as HTMLElement)?.tagName === 'IMG') e.preventDefault(); };
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') e.preventDefault(); };
    const style = document.createElement('style');
    style.textContent = '@media print { body { display: none !important; } }';
    document.addEventListener('contextmenu', onCtx);
    document.addEventListener('dragstart', onDrag);
    document.addEventListener('keydown', onKey);
    document.head.appendChild(style);
    return () => {
      document.removeEventListener('contextmenu', onCtx);
      document.removeEventListener('dragstart', onDrag);
      document.removeEventListener('keydown', onKey);
      style.remove();
    };
  }, []);
}
```

- [ ] **Step 2: Verify** — on `/editor/<id>`: right-click is suppressed, `Ctrl/Cmd+P` does not open a usable print dialog of the design, dragging a canvas image does not save it. Document in the PR that OS-level capture is not blockable.

- [ ] **Step 3: Commit** `feat: capture deterrents on editor route`.

### Task 18: Multi-tenant guardrails, quotas, and cross-browser QA

**Files:**
- Modify: editor pages (empty/error/loading states), batch quota tie-in (reuse existing subscription/quota checks used by `certificate-templates` create).

- [ ] **Step 1:** Enforce the same company-active + `can_create_batches`/quota checks on `/editor/new`, `from-stock`, and `PUT /:id/design` that the legacy create route enforces.
- [ ] **Step 2:** Add loading + error + not-found states to `/editor/[id]`.
- [ ] **Step 3:** QA matrix — Chrome, Edge, Firefox, Safari: create/edit/save, fonts, uploads, render+sign one batch each. Log issues as follow-up tasks.
- [ ] **Step 4: Commit** `feat: editor multi-tenant guardrails and states`.

---

## Self-Review Notes (author)

- **Spec coverage:** §3 editor facts → Tasks 1–2, 5; §4.2 pages → Task 6; §4.3 data model → Tasks 3–4; §4.4 headless render → Tasks 13–15; §5 placeholders → Task 11; §6 stock templates → Task 12; §7 lockdown → Tasks 16–17; editor backend (implied by §4.1/§3 `config.apis`) → Tasks 7–10; §10 risks (fonts parity) → Task 9 + Task 14 golden test. All covered.
- **Open assumptions to confirm during execution (do not skip):** exact saved `editor_document` layer shape (Task 11 Step 1 — capture a real sample first); the app's real server-side auth-token accessor (Task 6); the batch render call site (Task 15); presence of a vitest/supertest setup in `apps/api` (add if missing before Task 4).
- **Deferred by request:** background removal; Unsplash image search (disabled, not removed from fork).
