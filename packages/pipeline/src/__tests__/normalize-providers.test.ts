import { describe, expect, it } from 'vitest';
import { extractHashtags, normalizeApifyTikTok } from '../normalize';
import { normalizeApifyInstagram, normalizeGraphInstagram } from '../normalize-instagram';
import { normalizeInstagramRaw, normalizeTikTokAweme } from '../normalize-tiktok-aweme';

const ctx = { providerRunId: 'run1', observedAt: '2026-09-13T12:00:00.000Z', rightsPolicyId: 'pol', dataMode: 'synthetic' as const };

describe('normalize: sağlayıcı çeşitleri', () => {
  it('Apify TikTok: locationMeta → locationTag, hashtags[] nesne biçimi, errorCode satırı reddedilir', () => {
    const r = normalizeApifyTikTok({ id: '7300000000000000001', text: 'harika #Kahve', createTimeISO: '2026-09-10T10:00:00Z', authorMeta: { id: 12, name: 'ali' }, playCount: 10, hashtags: [{ name: 'Kahve' }], locationMeta: { locationName: 'Demo Kafe', city: 'İstanbul', countryCode: 'TR' } }, ctx);
    expect(r.ok && r.post.locationTag?.name).toBe('Demo Kafe, İstanbul');
    expect(r.ok && r.post.hashtags).toEqual(['kahve']);
    expect(normalizeApifyTikTok({ id: '1', errorCode: 'PROFILE_PRIVATE' }, ctx)).toMatchObject({ ok: false, code: 'missing_identity' });
  });
  it('Apify Instagram: shortcode → canonical URL, play count tercih, konum id string', () => {
    const r = normalizeApifyInstagram({ id: '3145678901234567890', shortCode: 'AbC123xyz', productType: 'clips', caption: 'Brunch #Karaköy', timestamp: '2026-09-11T09:00:00.000Z', ownerId: 99, ownerUsername: 'ayse', likesCount: 5, videoPlayCount: 400, videoViewCount: 300, locationName: 'Karaköy', locationId: 212970049, videoDuration: 12.5, isSponsored: true }, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.post.canonicalUrl).toBe('https://www.instagram.com/reel/AbC123xyz/');
    expect(r.post.metrics.views).toBe(400);
    expect(r.post.locationTag).toEqual({ name: 'Karaköy', platformLocationId: '212970049', lat: null, lng: null });
    expect(r.post.sponsoredStatus).toBe('declared');
    expect(r.post.mediaCapabilities.durationMs).toBe(12500);
    expect(r.post.hashtags).toEqual(['karaköy']);
  });
  it('Graph Business Discovery: konum yok, provider instagram_graph, view_count reels', () => {
    const r = normalizeGraphInstagram({ id: '17900000000000001', caption: 'x #a', permalink: 'https://www.instagram.com/reel/XyZ/', timestamp: '2026-09-11T09:00:00+0000', media_type: 'VIDEO', media_product_type: 'REELS', view_count: 12, like_count: 3 }, { ...ctx, ownerId: '17841400000000000', ownerUsername: 'biz' });
    expect(r.ok && r.post.provider).toBe('instagram_graph');
    expect(r.ok && r.post.locationTag).toBeNull();
    expect(r.ok && r.post.platformShortcode).toBe('XyZ');
    expect(r.ok && r.post.metrics.views).toBe(12);
  });
  it('ham TikTok aweme (ScrapeCreators/EnsembleData): poi → locationTag lat/lng, region → uploadCountryHint, is_ad → declared', () => {
    const r = normalizeTikTokAweme({ aweme_id: '7300000000000000002', desc: 'Roma pizza #roma', create_time: 1757500000, region: 'it', is_ad: true, author: { uid: '77', unique_id: 'marco' }, statistics: { play_count: 1000, digg_count: 10, collect_count: '4' }, video: { duration: 15000, cover: { url_list: ['https://cdn/x.jpg'] } }, poi: { poi_id: 'p1', poi_name: 'Pizzeria Demo', address_info: { city_name: 'Roma' }, latitude: '41.9', longitude: 12.5 }, text_extra: [{ hashtag_name: 'Roma' }] }, { ...ctx, provider: 'scrapecreators' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.post.locationTag).toEqual({ name: 'Pizzeria Demo, Roma', platformLocationId: 'p1', lat: 41.9, lng: 12.5 });
    expect(r.post.uploadCountryHint).toBe('IT');
    expect(r.post.sponsoredStatus).toBe('declared');
    expect(r.post.metrics.saves).toBe(4);
    expect(r.post.mediaCapabilities.durationMs).toBe(15000);
    expect(r.post.canonicalUrl).toBe('https://www.tiktok.com/@marco/video/7300000000000000002');
  });
  it('ham IG medya: pk "id_userid" biçimi, caption nesnesi, location lat/lng', () => {
    const r = normalizeInstagramRaw({ pk: '3145678901234567891_99', code: 'Zz9', taken_at: 1757500000, product_type: 'clips', caption: { text: 'yemek #Bebek' }, like_count: 2, play_count: 50, user: { pk: 99, username: 'can' }, location: { pk: 5, name: 'Bebek Cafe', lat: 41.08, lng: 29.04 } }, { ...ctx, provider: 'scrapecreators' });
    expect(r.ok && r.post.platformPostId).toBe('3145678901234567891');
    expect(r.ok && r.post.locationTag?.lat).toBe(41.08);
    expect(r.ok && r.post.canonicalUrl).toBe('https://www.instagram.com/reel/Zz9/');
  });
  it('extractHashtags Türkçe karakter ve tekilleştirme', () => {
    expect(extractHashtags('#Kahve #kahve #İstanbul yok')).toEqual(['kahve', 'istanbul']);
    expect(normalizeTikTokAweme({ aweme_id: 7300000000000000002, create_time: 1, author: { uid: '1', unique_id: 'a' } }, { ...ctx, provider: 'scrapecreators' })).toMatchObject({ ok: false, detail: 'id_precision_lost' });
  });
});
