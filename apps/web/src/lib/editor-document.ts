import { apiUrl } from './api';

/**
 * The Canva editor stores each page's background as the ROOT layer's `image` prop
 * (see packages/canva-editor RootLayer/ImageContent). When a template has no saved
 * design yet (freshly uploaded background, or a legacy coordinate template), we seed a
 * single-page document that shows the template's background full-canvas, so the user
 * designs on top of it. The document is written in the editor's readable (unpacked)
 * shape — `unpack()` passes it through unchanged on load.
 */
export function buildBackgroundDocument(opts: {
  backgroundUrl: string; // may be an API-relative "/files/..." path or an absolute URL
  width: number;
  height: number;
}) {
  const width = Math.max(1, Math.round(opts.width) || 0) || 1414;
  const height = Math.max(1, Math.round(opts.height) || 0) || 1000;
  const url = toAbsoluteAssetUrl(opts.backgroundUrl);

  return [
    {
      name: '',
      notes: '',
      layers: {
        ROOT: {
          type: { resolvedName: 'RootLayer' },
          props: {
            boxSize: { width, height },
            position: { x: 0, y: 0 },
            rotate: 0,
            color: 'rgb(255, 255, 255)',
            image: {
              url,
              thumb: url,
              position: { x: 0, y: 0 },
              rotate: 0,
              boxSize: { width, height },
              transparency: 1
            }
          },
          locked: false,
          child: [],
          parent: null
        }
      }
    }
  ];
}

/** Editor <img> layers need an absolute URL to the API origin; template backgroundUrl is "/files/...". */
export function toAbsoluteAssetUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${apiUrl}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}
