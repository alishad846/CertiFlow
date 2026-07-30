# Certificate Editor UI — Design Spec

**Date:** 2026-07-27
**Branch:** `editor-ui`
**Status:** Draft for review

## 1. Goal

Replace CertiFlow's current coordinate-based text-field overlay with a **Canva-style
blank-canvas design editor**, so a company can:

1. Pick a **stock template** we provide, **or upload** their own certificate / offer letter /
   notice as a background, **or start from a blank canvas**.
2. Design freely — text, images, shapes, layers — and drop **merge-field placeholders**
   (`{{recipient_name}}`, `{{date}}`, etc.).
3. **Save** the design as a reusable template.
4. Select that template in the existing **batch** flow and send.

The editor is extracted from the open-source `kenvinlu/canva-editor` project
(license: *MIT with No Resale Clause* — commercial use for offering/selling services is
explicitly permitted; only reselling the software itself is forbidden, which we do not do).

## 2. Non-goals (v1)

- Background removal (explicitly dropped by request).
- Real-time collaboration, plugin system (upstream "planned", not needed).
- Guaranteeing screenshots are impossible — **not achievable in a browser**; see §7.

## 2a. Image / stock-design search (ENABLED)

Users can search the sidebar for stock imagery (e.g. "flowers", backgrounds) and get
**Unsplash** results, alongside uploads and the editor's built-in shapes/frames.

- **Server-side proxy:** the Unsplash access key stays on the server. The editor's
  `searchImages` endpoint (`/api/editor/search-images`) proxies the Unsplash Search Photos API
  (env `UNSPLASH_ACCESS_KEY`). Returns `[]` gracefully when no key is configured.
- **Attribution + download tracking** per Unsplash API guidelines are handled in the proxy.
- **Persistence:** when a user places an Unsplash photo, the proxy/pick flow copies the image
  into CertiFlow uploads and rewrites the design to our stored URL, so a signed certificate
  renders identically forever (never depends on Unsplash's CDN staying up).
- **Decorative graphics** (golden borders, ornaments) are transparent elements served by the
  editor's **shapes/frames** datasets — a separate, complementary search path, both kept.

## 3. Source editor — confirmed facts

- The editor is a self-contained workspace package (`canva-editor`, v1.0.71) exporting a single
  React component `CanvaEditor` + `EditorConfig` type.
- Mount contract:
  ```tsx
  const CanvaEditor = dynamic(() => import('@certiflow/canva-editor').then(m => m.CanvaEditor), { ssr: false });
  <CanvaEditor
    data={{ name, editorConfig }}   // saved design JSON
    config={editorConfig}           // apis, logoUrl, fonts, translations
    saving={saving}
    onChanges={(json) => persist(json)}
    onDesignNameChanges={(name) => persistName(name)}
    onRemove={() => ...}
  />
  ```
- **Design data is JSON**, persisted/loaded via our API.
- **All network goes through `config.apis`** — repointed at CertiFlow's API (or stubbed).
- **Export lives in the header** via `downloadPNGCmd` / `downloadPDFCmd` state flags backed by
  `jspdf` + `modern-screenshot`. Removing the header download buttons disables in-app export.
- React 19 + Next.js compatible; mounts client-only (`ssr:false`).
- Uses `@emotion` + `styled-components` (added to `apps/web`; coexist with Tailwind 4).

## 4. Architecture

```
apps/web  (Next.js)                      packages/canva-editor  (forked, frozen)
  /editor/new         ─┐                   <CanvaEditor/>  (drop-in component)
  /editor/[templateId] ├─ mounts ────────►   config.apis ──► apps/web API routes
  template gallery     ┘                      onChanges  ──► save design JSON
        │
        ▼
apps/api  (Express + worker + Postgres)
  certificate_templates.editor_document (jsonb)   ← rich design
  batch send ► worker ► HEADLESS RENDER (Puppeteer)
                          loads editor render-mode + merged recipient data
                          ► high-res PDF ► existing QR stamp ► PAdES sign ► deliver
```

### 4.1 Editor package (`packages/canva-editor`)
Copy `libs/canva-editor` in as a workspace package. Fork-and-freeze (upstream is "active
development, APIs may change"; we own it). Add its runtime deps. Strip export UI (§7).

### 4.2 Editor page (`apps/web`)
- Full-screen route(s): `/editor/new`, `/editor/[templateId]`.
- Gallery buttons **"Edit this template"** / **"Create my own"** navigate here.
- Builds `EditorConfig` pointing `apis` at CertiFlow endpoints; injects auth token, logo,
  bundled fonts, available merge-field list.
- `onChanges` → debounced save of design JSON to the template API.

### 4.3 Data model (`apps/api`)
- Migration: add `certificate_templates.editor_document jsonb NULL`.
- Existing flat `field_config` templates keep rendering via the current path (backward compat).
- New/edited templates store the rich `editor_document`; a `render_engine` discriminator
  (`'legacy' | 'editor'`) selects the render path.

### 4.4 Render pipeline (batch/send) — **headless browser**
1. Worker loads the design JSON.
2. Launches Puppeteer/Chromium, opens the editor in **render mode** (upstream already has a
   `?preview` mode we extend to accept injected data), merges each recipient's fields into the
   `{{...}}` tokens.
3. Captures the page to a **high-resolution PDF**.
4. Runs the **existing** QR verification stamp + PAdES signing on that PDF.
5. Delivers as today.

Fonts used in the editor must be installed/available in the render environment, or the PDF will
mismatch — fonts are **bundled** with the app and loaded both in-editor and in the renderer.

## 5. Placeholders / merge fields
- No merge-field concept exists upstream. We add it as a convention: text layers may contain
  `{{field}}` tokens.
- The editor's left panel exposes an **"Insert field"** list (recipient name, date, course, etc.)
  sourced from `EditorConfig`.
- At render time the existing `renderTemplateString` fills tokens per recipient.
- Live preview in-editor shows sample values.

## 6. Stock templates
- Ship a small starter set (offer letter, certificate of completion, notice) authored as editor
  design JSON, stored as system templates selectable in the gallery.
- v1 target: 3–6 templates. "Start from this" clones the JSON into a company-owned template.

## 7. Export / screenshot lockdown
**Achievable and in scope:**
- Remove header PNG/PDF download buttons; neutralize `downloadPNGCmd` / `downloadPDFCmd`.
- Do not ship `jspdf` / `modern-screenshot`-driven UI to end users.
- Disable right-click/context menu and drag-save of images on the editor route.
- Disable the browser print path (`window.print` / print CSS) on the route.
- Deterrents (no image `src` on original assets where avoidable, etc.).

**NOT achievable (documented, accepted):**
- OS-level screen capture (`Win+Shift+S`, macOS capture, phone camera) cannot be blocked by any
  web application. The above stops in-app export and casual capture only.

## 8. Routes & UX summary
| Action | Route | Result |
|---|---|---|
| "Create my own" | `/editor/new` | Blank canvas (or size picker) |
| "Edit this template" | `/editor/[templateId]` | Loads existing design JSON |
| Pick stock template | gallery → clone → `/editor/[newId]` | Company-owned copy |
| Save | (auto via `onChanges`) | Design JSON persisted |
| Use in batch | existing batch flow | Template selectable as today |

## 9. Phasing
- **Phase 1 — Editor in the app:** package extracted, mounts on `/editor/*`, saves/loads design
  JSON to a new column, export UI stripped. *Exit: a company can design + save a template.*
- **Phase 2 — Placeholders + stock templates:** merge-field insertion + live preview; ship
  starter templates + gallery wiring for "Edit"/"Create".
- **Phase 3 — Headless render + signing:** Puppeteer render mode with data injection → PDF →
  existing QR + PAdES → batch send end-to-end.
- **Phase 4 — Lockdown + polish:** full export/screenshot lockdown, multi-tenant guardrails,
  cross-browser QA.

## 10. Key risks
- **Render parity** (mitigated: same editor code renders via headless browser).
- **Fonts in the render environment** — must be bundled + loaded identically.
- **Chromium in the worker** — heavier deploy footprint; memory/concurrency tuning needed.
- **Frozen fork maintenance** — we own all upstream bugs going forward.
- **`@emotion`/`styled-components` added to a Tailwind app** — verify no style/SSR conflicts.

## 11. Testing / verification
- Phase exits verified by driving the real app (design → save → reload → render → sign),
  not just unit tests.
- Golden-image check: editor preview vs. headless-rendered PDF for a fixed design.
