import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Task 10a wires /search-images to the real Unsplash proxy (searchUnsplash). The repo-root .env
// (loaded by config/env.ts, including in tests) carries a real UNSPLASH_ACCESS_KEY, so this route
// would otherwise make a live network call here. Mock the service so this route test stays a pure,
// deterministic contract test of the { data: [...] } envelope; searchUnsplash's own mapping logic
// (empty-key, mapped-with-key, upstream-failure) is covered by services/__tests__/unsplash.test.ts.
vi.mock('../../services/unsplash', () => ({
  searchUnsplash: vi.fn(async () => [
    { img: { url: 'https://images.unsplash.com/mock', width: 800, height: 600 }, source: 'unsplash' as const }
  ])
}));

import { createApp } from '../../app';

// The editor's content panels (ShapeContent/FrameContent/TextContent/TemplateContent/
// ImageCollectionTab/FontSidebar) all read `res.data.data`, so every search endpoint must
// return a { data: [...] } envelope (matching the upstream mock-api), not a bare array.
describe('GET /api/editor/*', () => {
  const app = createApp();

  it('search-shapes paginates the vendored dataset and rewrites image urls to /api/editor/images', async () => {
    const res = await request(app).get('/api/editor/search-shapes?ps=5&pi=0&kw=');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    expect(res.body.data[0].img.url).toContain('/api/editor/images/shapes/');
    expect(res.body.data[0].img.url).not.toContain('localhost:4000/images/');
  });

  it('search-fonts returns the curated font families in a { data } envelope and rewrites font urls', async () => {
    const res = await request(app).get('/api/editor/search-fonts?ps=5&pi=0');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].styles[0].url).toContain('/api/editor/fonts/');
    expect(res.body.data[0].styles[0].url).not.toContain('localhost:4000/api/editor/fonts/');
  });

  it('search-images proxies searchUnsplash results in a { data } envelope with the { img: { url, width, height } } shape', async () => {
    const res = await request(app).get('/api/editor/search-images?ps=5&pi=0&kw=x');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].img).toEqual({ url: 'https://images.unsplash.com/mock', width: 800, height: 600 });
  });

  it('search-templates returns an empty { data } envelope (stock templates are a later task)', async () => {
    const res = await request(app).get('/api/editor/search-templates');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [] });
  });
});
