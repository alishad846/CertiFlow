import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Task 10a: searchUnsplash is a thin server-side proxy over the Unsplash search API. The editor's
// Collection tab (ImageCollectionTab.tsx) reads `item.img.url` / `item.img.width` / `item.img.height`,
// so the mapped shape MUST nest url/width/height under an `img` object (not a bare string url).
describe('searchUnsplash', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns [] with no key configured', async () => {
    vi.doMock('../../config/env', () => ({ env: { UNSPLASH_ACCESS_KEY: '' } }));
    const { searchUnsplash } = await import('../unsplash.js');
    expect(await searchUnsplash('flowers', 5, 0)).toEqual([]);
  });

  it('maps results into { img: { url, width, height } } when a key is present', async () => {
    vi.doMock('../../config/env', () => ({ env: { UNSPLASH_ACCESS_KEY: 'k' } }));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            urls: { regular: 'https://img/1' },
            width: 800,
            height: 600,
            description: 'a flower',
            links: { download_location: 'https://dl/1' }
          }
        ]
      })
    }) as unknown as typeof fetch;

    const { searchUnsplash } = await import('../unsplash.js');
    const out = await searchUnsplash('flowers', 5, 0);

    expect(out[0].img.url).toBe('https://img/1');
    expect(out[0].img.width).toBe(800);
    expect(out[0].img.height).toBe(600);
    expect(out[0].source).toBe('unsplash');
    expect(out[0].desc).toBe('a flower');
    expect(out[0].downloadLocationUrl).toBe('https://dl/1');
  });

  it('returns [] when the upstream request fails', async () => {
    vi.doMock('../../config/env', () => ({ env: { UNSPLASH_ACCESS_KEY: 'k' } }));
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    const { searchUnsplash } = await import('../unsplash.js');
    expect(await searchUnsplash('flowers', 5, 0)).toEqual([]);
  });
});
