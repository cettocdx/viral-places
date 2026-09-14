import { describe, expect, it } from 'vitest';
import { contentHashOf, normalizeApifyTikTok } from '../normalize';

const ctx = { providerRunId: 'run-1', observedAt: '2026-09-12T09:00:00.000Z', rightsPolicyId: 'deny-by-default', dataMode: 'synthetic' as const };
const base = {
  id: 7351234567890123456, // 64-bit'e sığmayan platform ID: JSON'da number gelirse hassasiyet kaybı olur; string beklenir
  text: 'DEMO caption',
  createTimeISO: '2026-09-10T12:00:00Z',
  webVideoUrl: 'https://www.tiktok.com/@demo/video/7351234567890123456',
  authorMeta: { id: '111', name: 'demo' },
  playCount: 0,
  diggCount: null,
};

describe('normalizeApifyTikTok', () => {
  it('string ID korunur, null ile 0 ayrılır, caption hash içindedir', () => {
    const r = normalizeApifyTikTok({ ...base, id: '7351234567890123456' }, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.post.platformPostId).toBe('7351234567890123456');
    expect(r.post.metrics.views).toBe(0);
    expect(r.post.metrics.likes).toBeNull();
    expect(r.post.metrics.shares).toBeNull();
    expect(r.post.contentHash).toBe(contentHashOf({ platform: 'tiktok', platformPostId: '7351234567890123456', caption: 'DEMO caption' }));
    expect(r.post.sponsoredStatus).toBe('unknown');
    expect(r.post.dataMode).toBe('synthetic');
  });

  it('isAd → declared; locationCreated mekan konumu değil sadece ipucu', () => {
    const r = normalizeApifyTikTok({ ...base, id: '1', isAd: true, locationCreated: 'tr' }, ctx);
    expect(r.ok && r.post.sponsoredStatus).toBe('declared');
    expect(r.ok && r.post.uploadCountryHint).toBe('TR');
  });

  it('tiktok dışı veya http URL kalıcı geçersiz', () => {
    expect(normalizeApifyTikTok({ ...base, id: '1', webVideoUrl: 'http://www.tiktok.com/x' }, ctx)).toMatchObject({ ok: false, code: 'permanent_invalid_url' });
    expect(normalizeApifyTikTok({ ...base, id: '1', webVideoUrl: 'https://evil.example/x' }, ctx)).toMatchObject({ ok: false, code: 'permanent_invalid_url' });
  });

  it('kimlik yoksa reddedilir; createTime epoch da kabul edilir', () => {
    expect(normalizeApifyTikTok({ ...base, id: '1', authorMeta: {} }, ctx)).toMatchObject({ ok: false, code: 'missing_identity' });
    const r = normalizeApifyTikTok({ ...base, id: '1', createTimeISO: undefined, createTime: 1788500000 }, ctx);
    expect(r.ok && r.post.publishedAt).toBe(new Date(1788500000 * 1000).toISOString());
  });

  it('şema değişikliği (bilinmeyen tip) schema_changed', () => {
    expect(normalizeApifyTikTok({ ...base, id: { nested: true } }, ctx)).toMatchObject({ ok: false, code: 'schema_changed' });
  });
});
