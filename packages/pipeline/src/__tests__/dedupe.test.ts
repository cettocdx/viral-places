import { describe, expect, it } from 'vitest';
import { decideIngest, partitionPage } from '../dedupe';
import type { NormalizedPost } from '../normalize';

function post(id: string, publishedAt: string, hash = 'h' + id): NormalizedPost {
  return {
    schemaVersion: '1.0', dataMode: 'synthetic', provider: 'fixture', providerRunId: 'r', platform: 'tiktok', platformPostId: id, platformCreatorId: 'c', handle: 'h',
    canonicalUrl: 'https://www.tiktok.com/@h/video/' + id, publishedAt, observedAt: publishedAt, caption: null, language: null,
    metrics: { views: null, likes: null, comments: null, shares: null, saves: null }, availability: 'available', sponsoredStatus: 'unknown',
    mediaCapabilities: { downloadUrlPresent: false, durationMs: null }, uploadCountryHint: null, contentHash: hash.padEnd(64, '0'), rightsPolicyId: 'deny-by-default',
  };
}

describe('decideIngest', () => {
  it('bilinmeyen → yeni; hash değişti → düzenlendi; aynı → yalnız metrik', () => {
    const p = post('1', '2026-09-10T00:00:00.000Z');
    expect(decideIngest(p, null).kind).toBe('new_post');
    expect(decideIngest(p, { platformPostId: '1', contentHash: 'x'.padEnd(64, '0') }).kind).toBe('edited_post');
    expect(decideIngest(p, { platformPostId: '1', contentHash: p.contentHash }).kind).toBe('metrics_only');
  });
});

describe('partitionPage', () => {
  it('pinned (daha önce görülen) post yeni sayılmaz; watermark ileri gider', () => {
    const wm = { newestPublishedAt: '2026-09-09T00:00:00.000Z', seenIds: ['pinned'] };
    const page = [post('pinned', '2026-01-01T00:00:00.000Z'), post('new', '2026-09-11T00:00:00.000Z')];
    const r = partitionPage(page, wm, false);
    expect(r.fresh.map((p) => p.platformPostId)).toEqual(['new']);
    expect(r.stale.map((p) => p.platformPostId)).toEqual(['pinned']);
    expect(r.nextWatermark.newestPublishedAt).toBe('2026-09-11T00:00:00.000Z');
    expect(r.coverageGap).toBe(false);
  });
  it('sayfa limiti + tüm kayıtlar watermark sonrası → kapsam boşluğu işaretlenir', () => {
    const wm = { newestPublishedAt: '2026-09-01T00:00:00.000Z', seenIds: [] };
    const r = partitionPage([post('a', '2026-09-10T00:00:00.000Z'), post('b', '2026-09-09T00:00:00.000Z')], wm, true);
    expect(r.coverageGap).toBe(true);
  });
});
