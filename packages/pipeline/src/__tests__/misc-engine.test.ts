import { describe, expect, it } from 'vitest';
import { creatorFit, viewStability } from '../discovery';
import { isAllowedRedirectHost, parseImportUrl } from '../import-url';
import { GooglePlacesClient, candidateFromCache, categoryFromTypes, isCacheEntryValid, toCacheEntry } from '../places/google-places';

describe('parseImportUrl', () => {
  it('TikTok/Instagram biçimleri', () => {
    expect(parseImportUrl('https://www.tiktok.com/@ali/video/7300000000000000001?x=1')).toMatchObject({ kind: 'post', platform: 'tiktok', platformPostId: '7300000000000000001', handle: 'ali' });
    expect(parseImportUrl('https://vm.tiktok.com/ZMabc/')).toMatchObject({ kind: 'short_link', platform: 'tiktok' });
    expect(parseImportUrl('https://www.instagram.com/reel/AbC123/?igsh=1')).toMatchObject({ kind: 'post', platform: 'instagram', shortcode: 'AbC123', normalizedUrl: 'https://www.instagram.com/reel/AbC123/' });
    expect(parseImportUrl('https://instagram.com/ayse')).toMatchObject({ kind: 'profile', platform: 'instagram', handle: 'ayse' });
    expect(parseImportUrl('http://www.tiktok.com/@a/video/1')).toMatchObject({ kind: 'unsupported', reason: 'not_https' });
    expect(parseImportUrl('https://evil.com/@a/video/1')).toMatchObject({ kind: 'unsupported', reason: 'host_not_allowed' });
    expect(isAllowedRedirectHost('www.tiktok.com')).toBe(true);
    expect(isAllowedRedirectHost('tiktok.com.evil.io')).toBe(false);
  });
});

describe('creatorFit', () => {
  const base = { platform: 'tiktok' as const, handle: 'a', sampledPosts: 25, topicShare: 0.8, extractableShare: 0.7, targetGeoShare: 0.9, recentActivityShare: 0.6, viewsSample: [100, 120, 90, 110, 5000, 95], originalityShare: 0.5, accessBlocked: false, disclosesSponsorship: true };
  it('medyan tabanlı istikrar; yetersiz örnek ve erişim engeli puan değil durum', () => {
    expect(viewStability(base.viewsSample)!).toBeLessThan(0.2);
    const r = creatorFit(base);
    expect(r.status).toBe('scored');
    expect(r.fit).toBeGreaterThan(0.5);
    expect(creatorFit({ ...base, sampledPosts: 5 }).status).toBe('insufficient_sample');
    expect(creatorFit({ ...base, accessBlocked: true }).status).toBe('access_blocked');
    expect(creatorFit({ ...base, viewsSample: [1] }).notes).toContain('view_stability_missing_reweighted');
  });
});

describe('GooglePlacesClient', () => {
  it('coğrafi ipucu yoksa çağrı yapılmaz; fiyat birimi bilinmiyorsa reddedilir; cache ≤30 gün', async () => {
    let calls = 0;
    const fetchImpl = async () => { calls += 1; return { status: 200, ok: true, json: async () => ({ places: [{ id: 'ChIJ1', displayName: { text: 'Demo Kafe' }, formattedAddress: 'Karaköy, İstanbul', location: { latitude: 41.02, longitude: 28.97 }, types: ['cafe', 'food'], businessStatus: 'OPERATIONAL', addressComponents: [{ longText: 'Karaköy', types: ['sublocality'] }, { longText: 'İstanbul', types: ['locality'] }] }] }), text: async () => '' }; };
    const c = new GooglePlacesClient({ apiKey: 'k', fetchImpl, usdPer1kRequests: 32, now: () => '2026-09-13T12:00:00.000Z', cacheTtlDays: 90 });
    expect(await c.searchText({ name: 'Demo Kafe', cityHint: null, areaHint: null, languageCode: 'tr' })).toMatchObject({ ok: true, entries: [] });
    expect(calls).toBe(0);
    const r = await c.searchText({ name: 'Demo Kafe', cityHint: 'İstanbul', areaHint: 'Karaköy', languageCode: 'tr' });
    expect(r.ok && r.entries[0]?.expiresAt).toBe('2026-10-13T12:00:00.000Z');
    expect(r.ok && r.entries[0]?.city).toBe('İstanbul');
    const cand = candidateFromCache((r.ok ? r.entries : [])[0]!);
    expect(cand).toMatchObject({ venueId: 'google:ChIJ1', category: 'coffee', neighborhood: 'Karaköy', status: 'open' });
    const noPrice = new GooglePlacesClient({ apiKey: 'k', fetchImpl, usdPer1kRequests: null });
    expect(await noPrice.searchText({ name: 'x', cityHint: 'y', areaHint: null, languageCode: 'tr' })).toMatchObject({ ok: false, code: 'places_budget_unknown' });
    expect(isCacheEntryValid(toCacheEntry({ id: 'a' }, 'q', '2026-09-13T12:00:00.000Z', 30), '2026-10-14T00:00:00.000Z')).toBe(false);
    expect(categoryFromTypes(['night_club'])).toBe('nightlife');
  });
});
