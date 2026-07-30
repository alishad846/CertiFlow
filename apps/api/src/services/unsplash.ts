import { env } from '../config/env';

/**
 * Item shape expected by the fork's Collection tab (ImageCollectionTab.tsx), which reads
 * `item.img.url` / `item.img.width` / `item.img.height` — `img` MUST be an object, never a bare
 * url string. `downloadLocationUrl` is surfaced so a future "place image" hook can fire the
 * Unsplash-required download ping (see `import-url` in routes/editor.ts) when a picked photo is
 * persisted into CertiFlow's own uploads.
 */
export type UnsplashImageItem = {
  img: { url: string; width: number; height: number };
  desc?: string;
  source: 'unsplash';
  downloadLocationUrl?: string;
};

/**
 * Server-side Unsplash search proxy: the API key lives only here, never in the browser bundle
 * (the client-side `unsplash-js` tab in the fork is intentionally left disabled with an empty
 * key — see apps/web/src/components/editor/editor-config.ts). Degrades to `[]` — never throws —
 * when no key is configured or the upstream call fails, so the Collection tab just renders empty.
 */
export async function searchUnsplash(kw: string, ps: number, pi: number): Promise<UnsplashImageItem[]> {
  if (!env.UNSPLASH_ACCESS_KEY) {
    return [];
  }

  const query = encodeURIComponent(kw || 'background');
  const perPage = ps || 18;
  const page = (pi || 0) + 1;
  const url = `https://api.unsplash.com/search/photos?query=${query}&per_page=${perPage}&page=${page}`;

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` }
  });
  if (!res.ok) {
    return [];
  }

  const data = (await res.json()) as {
    results?: Array<{
      urls?: { regular?: string };
      width?: number;
      height?: number;
      description?: string | null;
      alt_description?: string | null;
      links?: { download_location?: string };
    }>;
  };

  return (data.results ?? [])
    .filter((r) => !!r.urls?.regular)
    .map((r) => ({
      img: { url: r.urls!.regular as string, width: r.width ?? 0, height: r.height ?? 0 },
      desc: r.description ?? r.alt_description ?? undefined,
      source: 'unsplash' as const,
      downloadLocationUrl: r.links?.download_location
    }));
}
