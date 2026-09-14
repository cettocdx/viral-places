import { describe, expect, it } from 'vitest';
import { ApifyAdapter, buildActorInput } from '../adapters/apify';
import { EnsembleDataAdapter } from '../adapters/ensembledata';
import { InstagramGraphAdapter } from '../adapters/instagram-graph';
import { ScrapeCreatorsAdapter, parseWebVtt } from '../adapters/scrapecreators';
import { ProviderError, classifyHttpStatus, redactSecrets, safeJsonParse, type FetchLike } from '../adapters/types';

const aweme = (id: string, ct: number) => ({ aweme_id: id, desc: 'x', create_time: ct, author: { uid: '1', unique_id: 'ali' }, statistics: { play_count: 1 } });

function fakeFetch(routes: Array<{ match: (url: string, init?: Parameters<FetchLike>[1]) => boolean; status?: number; body: unknown }>, log: string[] = []): FetchLike {
  return async (url, init) => {
    log.push(url);
    const r = routes.find((x) => x.match(url, init));
    if (!r) return { status: 404, ok: false, text: async () => 'nf', json: async () => ({}) };
    const status = r.status ?? 200;
    return { status, ok: status < 400, text: async () => JSON.stringify(r.body), json: async () => r.body };
  };
}

describe('ScrapeCreatorsAdapter', () => {
  it('TikTok sayfalama: has_more ile 2 sayfa, kredi sayımı, newerThan ile erken durma', async () => {
    const log: string[] = [];
    const f = fakeFetch([
      { match: (u) => u.includes('/v3/tiktok/profile/videos') && !u.includes('max_cursor='), body: { aweme_list: [aweme('1', 1757600000), aweme('2', 1757500000)], has_more: true, max_cursor: 'c2' } },
      { match: (u) => u.includes('max_cursor=c2'), body: { aweme_list: [aweme('3', 1700000000)], has_more: false } },
    ], log);
    const a = new ScrapeCreatorsAdapter({ apiKey: 'sk-secret-123', fetchImpl: f, usdPerCredit: 0.00188, now: () => '2026-09-13T12:00:00.000Z' });
    const page = await a.listRecentPosts({ platform: 'tiktok', handle: 'ali', platformCreatorId: null, maxPosts: 50, newerThan: null, cursor: null, rightsPolicyId: 'pol', dataMode: 'live' });
    expect(page.posts.map((p) => p.platformPostId)).toEqual(['1', '2', '3']);
    expect(page.costMicroUsd).toBe(Math.round(2 * 0.00188 * 1_000_000));
    expect(a.creditsConsumed).toBe(2);
    expect(log.every((u) => !u.includes('sk-secret-123'))).toBe(true); // key header'da, URL'de değil
  });
  it('429 → ProviderError rate_limited retryable; 401 → authentication_failed', async () => {
    const a = new ScrapeCreatorsAdapter({ apiKey: 'k', fetchImpl: fakeFetch([{ match: () => true, status: 429, body: {} }]), usdPerCredit: null });
    await expect(a.listRecentPosts({ platform: 'tiktok', handle: 'x', platformCreatorId: null, maxPosts: 10, newerThan: null, cursor: null, rightsPolicyId: 'p', dataMode: 'live' })).rejects.toMatchObject({ code: 'rate_limited', retryable: true });
    expect(classifyHttpStatus(401, 'scrapecreators').code).toBe('authentication_failed');
  });
  it('transcript WebVTT ayrıştırma', async () => {
    const vtt = 'WEBVTT\n\n00:00.000 --> 00:02.500\nPizza <b>Roma</b> harika\n\n00:02.500 --> 00:04.000\nKadıköy\n';
    expect(parseWebVtt(vtt)).toEqual([{ startMs: 0, endMs: 2500, text: 'Pizza Roma harika' }, { startMs: 2500, endMs: 4000, text: 'Kadıköy' }]);
    const a = new ScrapeCreatorsAdapter({ apiKey: 'k', fetchImpl: fakeFetch([{ match: (u) => u.includes('/transcript'), body: { transcript: vtt } }]), usdPerCredit: null });
    const t = await a.fetchTranscript('https://www.tiktok.com/@a/video/1');
    expect(t?.segments.length).toBe(2);
  });
});

describe('ApifyAdapter', () => {
  it('collectRun: run doğrulanır, dataset sayfalanır, maliyet mikro-USD; RUNNING → retryable', async () => {
    const items = Array.from({ length: 3 }, (_, i) => ({ id: `73000000000000000${i}`, text: 'a', createTimeISO: '2026-09-10T10:00:00Z', authorMeta: { id: 1, name: 'ali' } }));
    const f = fakeFetch([
      { match: (u) => u.includes('/v2/actor-runs/run1'), body: { data: { id: 'run1', status: 'SUCCEEDED', defaultDatasetId: 'ds1', usageTotalUsd: 0.012 } } },
      { match: (u) => u.includes('/v2/actor-runs/run2'), body: { data: { id: 'run2', status: 'RUNNING', defaultDatasetId: null } } },
      { match: (u) => u.includes('/v2/datasets/ds1/items') && u.includes('offset=0'), body: items.slice(0, 2) },
      { match: (u) => u.includes('/v2/datasets/ds1/items') && u.includes('offset=2'), body: items.slice(2) },
    ]);
    const a = new ApifyAdapter({ token: 'tok', tiktokActorId: 'clockworks~tiktok-scraper', instagramActorId: 'apify~instagram-scraper', fetchImpl: f, now: () => '2026-09-13T12:00:00.000Z' });
    const page = await a.collectRun('run1', { platform: 'tiktok', rightsPolicyId: 'p', dataMode: 'live', pageSize: 2 });
    expect(page.posts.length).toBe(3);
    expect(page.costMicroUsd).toBe(12000);
    await expect(a.collectRun('run2', { platform: 'tiktok', rightsPolicyId: 'p', dataMode: 'live' })).rejects.toMatchObject({ code: 'provider_timeout', retryable: true });
  });
  it('aktör girdileri: TikTok profiles/oldestPostDateUnified, Instagram directUrls/onlyPostsNewerThan; webhook secret header şablonda', async () => {
    expect(buildActorInput('tiktok', { handle: 'ali', maxPosts: 20, newerThan: '2026-09-01T00:00:00Z' })).toMatchObject({ profiles: ['ali'], resultsPerPage: 20, oldestPostDateUnified: '2026-09-01', shouldDownloadVideos: false });
    expect(buildActorInput('instagram', { handle: 'ayse', maxPosts: 10, newerThan: null })).toMatchObject({ directUrls: ['https://www.instagram.com/ayse/'], resultsType: 'posts' });
    const log: string[] = [];
    const f = fakeFetch([{ match: (u) => u.includes('/runs?'), body: { data: { id: 'r', status: 'READY', defaultDatasetId: 'd' } } }], log);
    const a = new ApifyAdapter({ token: 'tok', tiktokActorId: 'clockworks~tiktok-scraper', instagramActorId: 'apify~instagram-scraper', fetchImpl: f, webhook: { requestUrl: 'https://api.example/webhooks/apify', secret: 's3cret' } });
    await a.startProfileRun({ platform: 'tiktok', handle: 'ali', platformCreatorId: null, maxPosts: 5, newerThan: null, cursor: null, rightsPolicyId: 'p', dataMode: 'live' });
    const hooks = JSON.parse(Buffer.from(log[0]!.split('webhooks=')[1]!, 'base64').toString());
    expect(hooks[0].eventTypes).toContain('ACTOR.RUN.SUCCEEDED');
    expect(hooks[0].headersTemplate).toContain('x-apify-webhook-secret');
  });
});

describe('safeJsonParse', () => {
  it('büyük kimlikler string kalır, metrikler sayı kalır', () => {
    const o = safeJsonParse('{"aweme_id": 7300000000000000002, "statistics": {"play_count": 7300000000000000002}, "author": {"uid":1234567890123456789}}') as { aweme_id: unknown; statistics: { play_count: unknown }; author: { uid: unknown } };
    expect(o.aweme_id).toBe('7300000000000000002');
    expect(o.author.uid).toBe('1234567890123456789');
    expect(typeof o.statistics.play_count).toBe('number');
  });
});

describe('EnsembleDataAdapter / InstagramGraphAdapter / redaction', () => {
  it('EnsembleData: token query string\'de ama hata mesajında redakte; depth = ceil(maxPosts/10)', async () => {
    const log: string[] = [];
    const f: FetchLike = async (url) => { log.push(url); throw new Error(`connect failed for ${url}`); };
    const a = new EnsembleDataAdapter({ token: 'edtoken12345', fetchImpl: f, usdPerUnit: null });
    const err = await a.listRecentPosts({ platform: 'tiktok', handle: 'ali', platformCreatorId: null, maxPosts: 25, newerThan: null, cursor: null, rightsPolicyId: 'p', dataMode: 'live' }).catch((e: ProviderError) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).message).not.toContain('edtoken12345');
    expect(log[0]).toContain('depth=3');
    expect(redactSecrets('a edtoken12345 b', ['edtoken12345'])).toBe('a [REDACTED] b');
  });
  it('Graph Business Discovery: alanlar, Bearer header, error.code 190 → authentication_failed', async () => {
    const log: Array<{ url: string; auth: string | undefined }> = [];
    const f: FetchLike = async (url, init) => {
      log.push({ url, auth: init?.headers?.Authorization });
      if (url.includes('bad')) return { status: 400, ok: false, text: async () => '', json: async () => ({ error: { code: 190 } }) };
      return { status: 200, ok: true, text: async () => '', json: async () => ({ business_discovery: { id: '178', username: 'biz', media: { data: [{ id: '17900000000000001', permalink: 'https://www.instagram.com/p/Abc/', timestamp: '2026-09-11T09:00:00+0000', like_count: 1 }], paging: {} } } }) };
    };
    const a = new InstagramGraphAdapter({ accessToken: 'EAAB', ourIgUserId: '999', fetchImpl: f });
    const page = await a.listRecentPosts({ platform: 'instagram', handle: 'biz', platformCreatorId: null, maxPosts: 10, newerThan: null, cursor: null, rightsPolicyId: 'p', dataMode: 'live' });
    expect(page.posts[0]?.platformCreatorId).toBe('178');
    expect(page.costMicroUsd).toBe(0);
    expect(log[0]?.auth).toBe('Bearer EAAB');
    expect(log[0]?.url).toContain('business_discovery.username(biz)');
    expect(log[0]?.url).not.toContain('EAAB');
    await expect(a.fetchCreator({ platform: 'instagram', handle: 'bad', platformCreatorId: null })).rejects.toMatchObject({ code: 'authentication_failed' });
  });
});
