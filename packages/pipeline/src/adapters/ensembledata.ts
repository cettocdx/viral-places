/**
 * EnsembleData adaptörü (§13.1 ikinci aday / araştırmada üçüncü seçenek): /tt/user/posts?username=&depth=&cursor=&oldest_createtime=&token=
 * Token query string'e yazılmak zorunda → hata/log redaksiyonu zorunlu (§13.2). Yanıt: data.aweme_list (ham TikTok) + nextCursor.
 * Instagram: /instagram/user/posts?user_id=&depth=&chunk_size=&oldest_timestamp=&token= (ham IG şekli).
 */
import type { NormalizedPost } from '../normalize';
import { normalizeInstagramRaw, normalizeTikTokAweme } from '../normalize-tiktok-aweme';
import { ProviderError, classifyHttpStatus, redactSecrets, safeJsonParse, type AvailabilityResult, type CreatorLookup, type CreatorSourceRecord, type DiscoveryPage, type DiscoveryRequest, type FetchLike, type MediaRequest, type MetricObservation, type MetricsRequest, type PermittedMediaResult, type Platform, type PostLookup, type PostPage, type RecentPostsRequest, type SocialSourceAdapter } from './types';

export interface EnsembleDataConfig {
  token: string;
  baseUrl?: string; // https://ensembledata.com/apis
  fetchImpl?: FetchLike;
  now?: () => string;
  /** Belgelenmiş birim: user posts 1 unit / 10 post; plan fiyatı (ör. Wood $100 / 45k unit-ay) → unit başına USD; bilinmiyorsa null. */
  usdPerUnit: number | null;
}

export class EnsembleDataAdapter implements SocialSourceAdapter {
  readonly provider = 'ensembledata' as const;
  readonly platforms: Platform[] = ['tiktok', 'instagram'];
  readonly schemaVersion = 'ensembledata-2026-09';
  private readonly base: string;
  private readonly fetchImpl: FetchLike;
  private unitsUsed = 0;

  constructor(private readonly cfg: EnsembleDataConfig) {
    this.base = (cfg.baseUrl ?? 'https://ensembledata.com/apis').replace(/\/$/, '');
    this.fetchImpl = cfg.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  }

  get unitsConsumed(): number {
    return this.unitsUsed;
  }
  private now(): string {
    return (this.cfg.now ?? (() => new Date().toISOString()))();
  }

  private async get(path: string, params: Record<string, string | undefined>): Promise<{ data: unknown; units: number }> {
    const qs = Object.entries({ ...params, token: this.cfg.token })
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
      .join('&');
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.fetchImpl(`${this.base}${path}?${qs}`, { method: 'GET', headers: { Accept: 'application/json' } });
    } catch (e) {
      throw new ProviderError('provider_timeout', redactSecrets(String((e as Error).message ?? e), [this.cfg.token]), true, 'ensembledata');
    }
    if (!res.ok) throw classifyHttpStatus(res.status, 'ensembledata');
    let json: { data?: unknown; units_charged?: number };
    try {
      json = safeJsonParse(await res.text()) as typeof json;
    } catch {
      throw new ProviderError('schema_changed', 'ensembledata response not json', false, 'ensembledata', res.status);
    }
    const units = typeof json.units_charged === 'number' ? json.units_charged : 1;
    this.unitsUsed += units;
    return { data: json.data, units };
  }

  private runId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async listRecentPosts(req: RecentPostsRequest): Promise<PostPage> {
    const providerRunId = this.runId(`ed-${req.platform}`);
    const observedAt = this.now();
    const depth = String(Math.max(1, Math.min(10, Math.ceil(req.maxPosts / 10))));
    const oldest = req.newerThan ? String(Math.floor(Date.parse(req.newerThan) / 1000)) : undefined;
    const { data, units } = req.platform === 'tiktok'
      ? await this.get('/tt/user/posts', { username: req.handle, depth, cursor: req.cursor ?? undefined, oldest_createtime: oldest })
      : await this.get('/instagram/user/posts', { user_id: req.platformCreatorId ?? undefined, depth, chunk_size: '10', oldest_timestamp: oldest, start_cursor: req.cursor ?? undefined });
    const d = (data ?? {}) as { aweme_list?: unknown[]; posts?: unknown[]; nextCursor?: string | number | null; next_cursor?: string | null };
    const items = Array.isArray(d.aweme_list) ? d.aweme_list : Array.isArray(d.posts) ? d.posts : [];
    const posts: NormalizedPost[] = [];
    const rejected: PostPage['rejected'] = [];
    for (const raw of items) {
      const r = req.platform === 'tiktok' ? normalizeTikTokAweme(raw, { provider: 'ensembledata', providerRunId, observedAt, rightsPolicyId: req.rightsPolicyId, dataMode: req.dataMode }) : normalizeInstagramRaw(raw, { provider: 'ensembledata', providerRunId, observedAt, rightsPolicyId: req.rightsPolicyId, dataMode: req.dataMode });
      if (r.ok) posts.push(r.post);
      else rejected.push({ code: r.code, detail: r.detail });
    }
    const next = d.nextCursor ?? d.next_cursor ?? null;
    return { posts: posts.slice(0, req.maxPosts), rejected, nextCursor: next !== null && next !== undefined ? String(next) : null, pageLimitReached: next !== null && next !== undefined, providerRunId, newestFirstGuaranteed: false, costMicroUsd: this.cfg.usdPerUnit === null ? null : Math.round(units * this.cfg.usdPerUnit * 1_000_000) };
  }

  async fetchPost(input: PostLookup): Promise<NormalizedPost> {
    if (!input.canonicalUrl) throw new ProviderError('permanent_invalid_url', 'canonicalUrl required', false, 'ensembledata');
    const providerRunId = this.runId('ed-post');
    const observedAt = this.now();
    if (input.platform === 'tiktok') {
      const { data } = await this.get('/tt/post/info', { url: input.canonicalUrl });
      const raw = Array.isArray(data) ? data[0] : data;
      const r = normalizeTikTokAweme(raw, { provider: 'ensembledata', providerRunId, observedAt, rightsPolicyId: input.rightsPolicyId, dataMode: input.dataMode });
      if (!r.ok) throw new ProviderError('schema_changed', r.detail, false, 'ensembledata');
      return r.post;
    }
    const code = input.canonicalUrl.split('/').filter(Boolean).at(-1) ?? '';
    const { data } = await this.get('/instagram/post/info', { code });
    const r = normalizeInstagramRaw(data, { provider: 'ensembledata', providerRunId, observedAt, rightsPolicyId: input.rightsPolicyId, dataMode: input.dataMode });
    if (!r.ok) throw new ProviderError('schema_changed', r.detail, false, 'ensembledata');
    return r.post;
  }

  async refreshMetrics(input: MetricsRequest): Promise<MetricObservation[]> {
    const out: MetricObservation[] = [];
    for (const p of input.posts) {
      try {
        const post = await this.fetchPost({ platform: input.platform, platformPostId: p.platformPostId, canonicalUrl: p.canonicalUrl, rightsPolicyId: input.rightsPolicyId, dataMode: input.dataMode });
        out.push({ platform: input.platform, platformPostId: post.platformPostId, observedAt: post.observedAt, views: post.metrics.views, likes: post.metrics.likes, comments: post.metrics.comments, shares: post.metrics.shares, saves: post.metrics.saves, providerRunId: post.providerRunId });
      } catch (e) {
        if (e instanceof ProviderError && e.retryable) throw e;
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
      return { platform: input.platform, platformPostId: input.platformPostId ?? '', availability: code === 'post_deleted' ? 'deleted' : code === 'post_private' ? 'private' : 'unknown', checkedAt };
    }
  }

  async getPermittedMedia(input: MediaRequest): Promise<PermittedMediaResult> {
    if (!input.permitted.download && !input.permitted.thumbnail) return { kind: 'denied', reason: 'rights_denied' };
    const post = await this.fetchPost({ platform: input.platform, platformPostId: input.platformPostId, canonicalUrl: input.canonicalUrl, rightsPolicyId: 'media-check', dataMode: 'live' });
    return { kind: 'available', downloadUrl: null, thumbnailUrl: input.permitted.thumbnail ? (post.thumbnailUrl ?? null) : null, urlExpiresAt: null, durationMs: post.mediaCapabilities.durationMs };
  }

  async fetchCreator(input: CreatorLookup): Promise<CreatorSourceRecord> {
    if (!input.handle) throw new ProviderError('permanent_invalid_url', 'handle required', false, 'ensembledata');
    const observedAt = this.now();
    if (input.platform === 'tiktok') {
      const { data } = await this.get('/tt/user/info', { username: input.handle });
      const d = (data ?? {}) as { user?: { uid?: string | number; unique_id?: string; nickname?: string; sec_uid?: string; verification_type?: number; secret?: boolean; follower_count?: number; aweme_count?: number } };
      const u = d.user ?? {};
      if (u.uid === undefined) throw new ProviderError('schema_changed', 'user.uid missing', false, 'ensembledata');
      return { platform: 'tiktok', platformCreatorId: String(u.uid), handle: u.unique_id ?? input.handle, displayName: u.nickname ?? null, canonicalUrl: `https://www.tiktok.com/@${u.unique_id ?? input.handle}`, followerCount: u.follower_count ?? null, postCount: u.aweme_count ?? null, verifiedBadgeObserved: (u.verification_type ?? 0) > 0, isPrivate: u.secret === true, observedAt, providerRunId: this.runId('ed-profile') };
    }
    const { data } = await this.get('/instagram/user/info', { username: input.handle });
    const u = (data ?? {}) as { pk?: string | number; id?: string | number; username?: string; full_name?: string; is_verified?: boolean; is_private?: boolean; follower_count?: number; media_count?: number };
    const id = u.pk ?? u.id;
    if (id === undefined) throw new ProviderError('schema_changed', 'user.pk missing', false, 'ensembledata');
    return { platform: 'instagram', platformCreatorId: String(id), handle: u.username ?? input.handle, displayName: u.full_name ?? null, canonicalUrl: `https://www.instagram.com/${u.username ?? input.handle}/`, followerCount: u.follower_count ?? null, postCount: u.media_count ?? null, verifiedBadgeObserved: u.is_verified === true, isPrivate: u.is_private === true, observedAt, providerRunId: this.runId('ed-profile') };
  }

  async discoverCreators(input: DiscoveryRequest): Promise<DiscoveryPage> {
    const foundAt = this.now();
    const providerRunId = this.runId('ed-search');
    if (input.platform !== 'tiktok') return { items: [], nextCursor: null, providerRunId };
    const { data } = await this.get('/tt/keyword/search', { name: input.query, cursor: '0', period: '30', sorting: '0' });
    const items = ((data ?? {}) as { data?: Array<{ aweme_info?: unknown }> }).data ?? [];
    const byCreator = new Map<string, DiscoveryPage['items'][number]>();
    for (const it of items.slice(0, input.maxResults)) {
      const r = normalizeTikTokAweme(it.aweme_info, { provider: 'ensembledata', providerRunId, observedAt: foundAt, rightsPolicyId: 'discovery-no-rights', dataMode: 'live' });
      if (!r.ok) continue;
      const key = r.post.platformCreatorId;
      const cur = byCreator.get(key) ?? { platform: 'tiktok' as const, platformCreatorId: key, handle: r.post.handle, canonicalUrl: `https://www.tiktok.com/@${r.post.handle}`, followerCount: null, sampleCaptions: [], foundVia: `ensembledata:${input.query}`, foundAt };
      if (r.post.caption && cur.sampleCaptions.length < 5) cur.sampleCaptions.push(r.post.caption.slice(0, 300));
      byCreator.set(key, cur);
    }
    return { items: Array.from(byCreator.values()), nextCursor: null, providerRunId };
  }
}
