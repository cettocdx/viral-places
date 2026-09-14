/**
 * ScrapeCreators adaptörü — araştırmada birincil aday (docs/research/social-data-access.md):
 * senkron REST, 1 kredi/istek, ham TikTok aweme (poi/anchors dahil) ve ham IG medya (location{lat,lng}).
 * TikTok: GET /v3/tiktok/profile/videos?handle=&max_cursor=&sort_by=latest ; GET /v1/tiktok/video/transcript?url=
 * Instagram: GET /v2/instagram/user/posts?handle=&next_max_id= ; GET /v1/instagram/post?url=
 * Auth: x-api-key header. Kaynak şeması sağlayıcı dokümanından; alan garantisi yok → normalize sınırında doğrulanır.
 */
import type { NormalizedPost } from '../normalize';
import { normalizeInstagramRaw, normalizeTikTokAweme } from '../normalize-tiktok-aweme';
import {
  ProviderError,
  classifyHttpStatus,
  redactSecrets,
  safeJsonParse,
  type AvailabilityResult,
  type CreatorLookup,
  type CreatorSourceRecord,
  type DiscoveryPage,
  type DiscoveryRequest,
  type FetchLike,
  type MediaRequest,
  type MetricObservation,
  type MetricsRequest,
  type PermittedMediaResult,
  type Platform,
  type PostLookup,
  type PostPage,
  type RecentPostsRequest,
  type SocialSourceAdapter,
} from './types';

export interface ScrapeCreatorsConfig {
  apiKey: string;
  baseUrl?: string; // https://api.scrapecreators.com
  fetchImpl?: FetchLike;
  now?: () => string;
  /** Belgelenmiş fiyat: kredi başına USD (25k kredi = $47 → 0.00188). Bilinmiyorsa null → maliyet uzlaştırılamaz. */
  usdPerCredit: number | null;
  /** Yanıtta sayfa boyutu bilinmiyor; TikTok ~20-35 aweme/sayfa. */
  maxPagesPerPoll?: number;
}

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
}

/** WebVTT → segment listesi (ms). Bozuk satırlar atlanır; süre bilgisi yoksa boş döner. */
export function parseWebVtt(vtt: string): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  const lines = vtt.split(/\r?\n/);
  const toMs = (t: string): number | null => {
    const m = t.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/);
    if (!m) return null;
    const h = m[1] ? Number(m[1]) : 0;
    return ((h * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + Number(m[4]!.padEnd(3, '0'));
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const arrow = line.indexOf('-->');
    if (arrow < 0) continue;
    const start = toMs(line.slice(0, arrow));
    const end = toMs(line.slice(arrow + 3).split(' ')[1] ?? line.slice(arrow + 3));
    if (start === null || end === null) continue;
    const textLines: string[] = [];
    for (let j = i + 1; j < lines.length && lines[j]!.trim() !== ''; j++) textLines.push(lines[j]!.replace(/<[^>]+>/g, ''));
    const text = textLines.join(' ').trim();
    if (text) out.push({ startMs: start, endMs: end, text });
  }
  return out;
}

export class ScrapeCreatorsAdapter implements SocialSourceAdapter {
  readonly provider = 'scrapecreators' as const;
  readonly platforms: Platform[] = ['tiktok', 'instagram'];
  readonly schemaVersion = 'scrapecreators-2026-09';
  private readonly base: string;
  private readonly fetchImpl: FetchLike;
  private creditsUsed = 0;

  constructor(private readonly cfg: ScrapeCreatorsConfig) {
    this.base = (cfg.baseUrl ?? 'https://api.scrapecreators.com').replace(/\/$/, '');
    this.fetchImpl = cfg.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  }

  get creditsConsumed(): number {
    return this.creditsUsed;
  }

  private now(): string {
    return (this.cfg.now ?? (() => new Date().toISOString()))();
  }

  private async get(path: string, params: Record<string, string | undefined>): Promise<unknown> {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
      .join('&');
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.fetchImpl(`${this.base}${path}${qs ? `?${qs}` : ''}`, { method: 'GET', headers: { 'x-api-key': this.cfg.apiKey, Accept: 'application/json' } });
    } catch (e) {
      throw new ProviderError('provider_timeout', redactSecrets(String((e as Error).message ?? e), [this.cfg.apiKey]), true, 'scrapecreators');
    }
    if (!res.ok) throw classifyHttpStatus(res.status, 'scrapecreators');
    this.creditsUsed += 1; // sağlayıcı: başarılı istek = 1 kredi (cache isabeti 0; burada üst sınır sayılır)
    try {
      return safeJsonParse(await res.text());
    } catch {
      throw new ProviderError('schema_changed', 'scrapecreators response not json', false, 'scrapecreators', res.status);
    }
  }

  private runId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async listRecentPosts(req: RecentPostsRequest): Promise<PostPage> {
    const providerRunId = this.runId(`sc-${req.platform}`);
    const observedAt = this.now();
    const posts: NormalizedPost[] = [];
    const rejected: PostPage['rejected'] = [];
    let cursor: string | undefined = req.cursor ?? undefined;
    let pages = 0;
    let pageLimitReached = false;
    let nextCursor: string | null = null;
    const maxPages = this.cfg.maxPagesPerPoll ?? 3;
    while (pages < maxPages) {
      pages += 1;
      if (req.platform === 'tiktok') {
        const data = (await this.get('/v3/tiktok/profile/videos', { handle: req.handle, user_id: req.platformCreatorId ?? undefined, max_cursor: cursor, sort_by: 'latest', trim: 'true' })) as { aweme_list?: unknown[]; max_cursor?: string | number; has_more?: boolean | number };
        const items = Array.isArray(data.aweme_list) ? data.aweme_list : [];
        for (const raw of items) {
          const r = normalizeTikTokAweme(raw, { provider: 'scrapecreators', providerRunId, observedAt, rightsPolicyId: req.rightsPolicyId, dataMode: req.dataMode });
          if (r.ok) posts.push(r.post);
          else rejected.push({ code: r.code, detail: r.detail });
        }
        const more = data.has_more === true || data.has_more === 1;
        cursor = more && data.max_cursor !== undefined ? String(data.max_cursor) : undefined;
        if (!more || items.length === 0) break;
      } else {
        const data = (await this.get('/v2/instagram/user/posts', { handle: req.handle, next_max_id: cursor, trim: 'true' })) as { items?: unknown[]; posts?: unknown[]; next_max_id?: string; more_available?: boolean };
        const items = Array.isArray(data.items) ? data.items : Array.isArray(data.posts) ? data.posts : [];
        for (const raw of items) {
          const r = normalizeInstagramRaw(raw, { provider: 'scrapecreators', providerRunId, observedAt, rightsPolicyId: req.rightsPolicyId, dataMode: req.dataMode });
          if (r.ok) posts.push(r.post);
          else rejected.push({ code: r.code, detail: r.detail });
        }
        cursor = data.more_available && data.next_max_id ? data.next_max_id : undefined;
        if (!cursor || items.length === 0) break;
      }
      // newerThan varsa ve sayfadaki en eski gönderi ondan eskiyse durulur (newest-first varsayılmaz; watermark ayrıca uygulanır)
      const oldest = posts.reduce<string | null>((acc, p) => (acc === null || p.publishedAt < acc ? p.publishedAt : acc), null);
      if (req.newerThan && oldest && oldest < req.newerThan) break;
      if (posts.length >= req.maxPosts) break;
    }
    if (cursor) {
      pageLimitReached = true;
      nextCursor = cursor;
    }
    const credits = pages;
    return { posts: posts.slice(0, req.maxPosts), rejected, nextCursor, pageLimitReached, providerRunId, newestFirstGuaranteed: false, costMicroUsd: this.cfg.usdPerCredit === null ? null : Math.round(credits * this.cfg.usdPerCredit * 1_000_000) };
  }

  async fetchPost(input: PostLookup): Promise<NormalizedPost> {
    if (!input.canonicalUrl) throw new ProviderError('permanent_invalid_url', 'canonicalUrl required', false, 'scrapecreators');
    const providerRunId = this.runId('sc-post');
    const observedAt = this.now();
    if (input.platform === 'tiktok') {
      const data = (await this.get('/v1/tiktok/video', { url: input.canonicalUrl, trim: 'true' })) as { aweme_detail?: unknown; aweme_list?: unknown[] } & Record<string, unknown>;
      const raw = data.aweme_detail ?? data.aweme_list?.[0] ?? data;
      const r = normalizeTikTokAweme(raw, { provider: 'scrapecreators', providerRunId, observedAt, rightsPolicyId: input.rightsPolicyId, dataMode: input.dataMode });
      if (!r.ok) throw new ProviderError(r.code === 'permanent_invalid_url' ? 'permanent_invalid_url' : 'schema_changed', r.detail, false, 'scrapecreators');
      return r.post;
    }
    const data = (await this.get('/v1/instagram/post', { url: input.canonicalUrl, trim: 'true' })) as { data?: { xdt_shortcode_media?: unknown } } & Record<string, unknown>;
    const raw = data.data?.xdt_shortcode_media ?? data;
    const r = normalizeInstagramRaw(raw, { provider: 'scrapecreators', providerRunId, observedAt, rightsPolicyId: input.rightsPolicyId, dataMode: input.dataMode });
    if (!r.ok) throw new ProviderError(r.code === 'permanent_invalid_url' ? 'permanent_invalid_url' : 'schema_changed', r.detail, false, 'scrapecreators');
    return r.post;
  }

  /** TikTok otomatik altyazısı (1 kredi); AI fallback kapalı (ayrı bütçe/hak kararı). Metadata AI hakkı olmadan çağrılmaz. */
  async fetchTranscript(canonicalUrl: string, language?: string): Promise<{ segments: TranscriptSegment[]; source: 'tiktok_captions'; raw: string } | null> {
    const data = (await this.get('/v1/tiktok/video/transcript', { url: canonicalUrl, language, use_ai_as_fallback: 'false' })) as { transcript?: string | null; success?: boolean };
    if (!data.transcript) return null;
    return { segments: parseWebVtt(data.transcript), source: 'tiktok_captions', raw: data.transcript };
  }

  async refreshMetrics(input: MetricsRequest): Promise<MetricObservation[]> {
    const out: MetricObservation[] = [];
    for (const p of input.posts) {
      try {
        const post = await this.fetchPost({ platform: input.platform, platformPostId: p.platformPostId, canonicalUrl: p.canonicalUrl, rightsPolicyId: input.rightsPolicyId, dataMode: input.dataMode });
        out.push({ platform: input.platform, platformPostId: post.platformPostId, observedAt: post.observedAt, views: post.metrics.views, likes: post.metrics.likes, comments: post.metrics.comments, shares: post.metrics.shares, saves: post.metrics.saves, providerRunId: post.providerRunId });
      } catch (e) {
        if (e instanceof ProviderError && e.retryable) throw e; // 429/timeout: çağıran katman bounded retry uygular
        // kalıcı hata (silinmiş/özel): gözlem yok; availability ayrı işte güncellenir
      }
    }
    return out;
  }

  async checkAvailability(input: PostLookup): Promise<AvailabilityResult> {
    const checkedAt = this.now();
    try {
      const p = await this.fetchPost(input);
      return { platform: input.platform, platformPostId: p.platformPostId, availability: 'available', checkedAt };
    } catch (e) {
      const code = e instanceof ProviderError ? e.code : 'unknown';
      return { platform: input.platform, platformPostId: input.platformPostId ?? '', availability: code === 'post_deleted' ? 'deleted' : code === 'post_private' ? 'private' : code === 'geo_restricted' ? 'geo_restricted' : 'unknown', checkedAt };
    }
  }

  async getPermittedMedia(input: MediaRequest): Promise<PermittedMediaResult> {
    if (!input.permitted.download && !input.permitted.thumbnail) return { kind: 'denied', reason: 'rights_denied' };
    const post = await this.fetchPost({ platform: input.platform, platformPostId: input.platformPostId, canonicalUrl: input.canonicalUrl, rightsPolicyId: 'media-check', dataMode: 'live' });
    return { kind: 'available', downloadUrl: null, thumbnailUrl: input.permitted.thumbnail ? (post.thumbnailUrl ?? null) : null, urlExpiresAt: null, durationMs: post.mediaCapabilities.durationMs };
  }

  async fetchCreator(input: CreatorLookup): Promise<CreatorSourceRecord> {
    if (!input.handle) throw new ProviderError('permanent_invalid_url', 'handle required', false, 'scrapecreators');
    const observedAt = this.now();
    if (input.platform === 'tiktok') {
      const d = (await this.get('/v1/tiktok/profile', { handle: input.handle })) as { user?: { id?: string | number; uniqueId?: string; nickname?: string; verified?: boolean; privateAccount?: boolean; secUid?: string }; stats?: { followerCount?: number; videoCount?: number } };
      const u = d.user ?? {};
      if (u.id === undefined) throw new ProviderError('schema_changed', 'profile.user.id missing', false, 'scrapecreators');
      return { platform: 'tiktok', platformCreatorId: String(u.id), handle: u.uniqueId ?? input.handle, displayName: u.nickname ?? null, canonicalUrl: `https://www.tiktok.com/@${u.uniqueId ?? input.handle}`, followerCount: d.stats?.followerCount ?? null, postCount: d.stats?.videoCount ?? null, verifiedBadgeObserved: u.verified === true, isPrivate: u.privateAccount === true, observedAt, providerRunId: this.runId('sc-profile') };
    }
    const d = (await this.get('/v1/instagram/profile', { handle: input.handle })) as { data?: { user?: { id?: string | number; username?: string; full_name?: string; is_verified?: boolean; is_private?: boolean; edge_followed_by?: { count?: number }; edge_owner_to_timeline_media?: { count?: number } } } };
    const u = d.data?.user ?? {};
    if (u.id === undefined) throw new ProviderError('schema_changed', 'profile.user.id missing', false, 'scrapecreators');
    return { platform: 'instagram', platformCreatorId: String(u.id), handle: u.username ?? input.handle, displayName: u.full_name ?? null, canonicalUrl: `https://www.instagram.com/${u.username ?? input.handle}/`, followerCount: u.edge_followed_by?.count ?? null, postCount: u.edge_owner_to_timeline_media?.count ?? null, verifiedBadgeObserved: u.is_verified === true, isPrivate: u.is_private === true, observedAt, providerRunId: this.runId('sc-profile') };
  }

  async discoverCreators(input: DiscoveryRequest): Promise<DiscoveryPage> {
    const foundAt = this.now();
    const providerRunId = this.runId('sc-search');
    const items = input.platform === 'tiktok'
      ? (((await this.get('/v1/tiktok/search/keyword', { query: input.query, region: input.locale?.toUpperCase().slice(-2) })) as { search_item_list?: Array<{ aweme_info?: unknown }> }).search_item_list ?? []).map((s) => s.aweme_info)
      : (((await this.get('/v1/instagram/hashtag', { hashtag: input.query.replace(/^#/, '') })) as { items?: unknown[] }).items ?? []);
    const byCreator = new Map<string, DiscoveryPage['items'][number]>();
    for (const raw of items.slice(0, input.maxResults)) {
      const r = input.platform === 'tiktok' ? normalizeTikTokAweme(raw, { provider: 'scrapecreators', providerRunId, observedAt: foundAt, rightsPolicyId: 'discovery-no-rights', dataMode: 'live' }) : normalizeInstagramRaw(raw, { provider: 'scrapecreators', providerRunId, observedAt: foundAt, rightsPolicyId: 'discovery-no-rights', dataMode: 'live' });
      if (!r.ok) continue;
      const key = r.post.platformCreatorId;
      const cur = byCreator.get(key) ?? { platform: input.platform, platformCreatorId: key, handle: r.post.handle, canonicalUrl: input.platform === 'tiktok' ? `https://www.tiktok.com/@${r.post.handle}` : `https://www.instagram.com/${r.post.handle}/`, followerCount: null, sampleCaptions: [], foundVia: `scrapecreators:${input.query}`, foundAt };
      if (r.post.caption && cur.sampleCaptions.length < 5) cur.sampleCaptions.push(r.post.caption.slice(0, 300));
      byCreator.set(key, cur);
    }
    return { items: Array.from(byCreator.values()), nextCursor: null, providerRunId };
  }
}
