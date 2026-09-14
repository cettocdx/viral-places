/**
 * Resmi Instagram Graph API — Business Discovery (creator izni gerekmeyen tek resmi okuma yolu).
 * GET https://graph.facebook.com/v25.0/{OUR_IG_USER_ID}?fields=business_discovery.username({target}){id,username,followers_count,media_count,
 *   media.limit(n).after(cursor){id,caption,comments_count,like_count,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,username,view_count}}
 * Ön koşul: kendi IG profesyonel hesabımız + Facebook Page + App Review (instagram_basic, instagram_manage_insights, pages_read_engagement).
 * Konum alanı resmi API'de yok → locationTag null; ScrapeCreators ile yalnız yeni gönderiler için zenginleştirme (araştırma önerisi).
 * Ücretsiz; platform oran limiti 200 çağrı/saat/uygulama kullanıcısı. Yalnız public profesyonel (Business/Creator) hesaplar döner.
 */
import type { NormalizedPost } from '../normalize';
import { normalizeGraphInstagram } from '../normalize-instagram';
import { ProviderError, classifyHttpStatus, redactSecrets, type AvailabilityResult, type CreatorLookup, type CreatorSourceRecord, type DiscoveryPage, type DiscoveryRequest, type FetchLike, type MediaRequest, type MetricObservation, type MetricsRequest, type PermittedMediaResult, type Platform, type PostLookup, type PostPage, type RecentPostsRequest, type SocialSourceAdapter } from './types';

export interface InstagramGraphConfig {
  accessToken: string;
  /** Bizim IG professional hesabımızın IG User ID'si (business_discovery bu düğümden çağrılır). */
  ourIgUserId: string;
  apiVersion?: string; // v25.0
  baseUrl?: string; // https://graph.facebook.com
  fetchImpl?: FetchLike;
  now?: () => string;
}

const MEDIA_FIELDS = 'id,caption,comments_count,like_count,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,username,view_count';

export class InstagramGraphAdapter implements SocialSourceAdapter {
  readonly provider = 'instagram_graph' as const;
  readonly platforms: Platform[] = ['instagram'];
  readonly schemaVersion = 'graph-v25.0-business-discovery';
  private readonly base: string;
  private readonly fetchImpl: FetchLike;
  constructor(private readonly cfg: InstagramGraphConfig) {
    this.base = `${(cfg.baseUrl ?? 'https://graph.facebook.com').replace(/\/$/, '')}/${cfg.apiVersion ?? 'v25.0'}`;
    this.fetchImpl = cfg.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  }
  private now(): string {
    return (this.cfg.now ?? (() => new Date().toISOString()))();
  }

  private async discovery(username: string, mediaLimit: number, after: string | null): Promise<{ id: string; username: string; followers_count?: number; media_count?: number; media?: { data?: unknown[]; paging?: { cursors?: { after?: string }; next?: string } } }> {
    const mediaPart = mediaLimit > 0 ? `,media.limit(${Math.min(mediaLimit, 100)})${after ? `.after(${after})` : ''}{${MEDIA_FIELDS}}` : '';
    const fields = `business_discovery.username(${encodeURIComponent(username)}){id,username,followers_count,media_count${mediaPart}}`;
    // Token Authorization header'da (Graph API Bearer kabul eder); query string'e yazılmaz.
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.fetchImpl(`${this.base}/${encodeURIComponent(this.cfg.ourIgUserId)}?fields=${fields}`, { method: 'GET', headers: { Authorization: `Bearer ${this.cfg.accessToken}`, Accept: 'application/json' } });
    } catch (e) {
      throw new ProviderError('provider_timeout', redactSecrets(String((e as Error).message ?? e), [this.cfg.accessToken]), true, 'instagram_graph');
    }
    if (!res.ok) {
      // Graph: 400 + error.code 110/100 (kullanıcı bulunamadı/profesyonel değil), 190 (token), 4/17/32 (oran limiti)
      let code: number | null = null;
      try {
        const body = (await res.json()) as { error?: { code?: number } };
        code = body.error?.code ?? null;
      } catch {
        /* gövde yok */
      }
      if (code === 190) throw new ProviderError('authentication_failed', 'graph token invalid/expired', false, 'instagram_graph', res.status);
      if (code === 4 || code === 17 || code === 32 || code === 613) throw new ProviderError('rate_limited', 'graph rate limit', true, 'instagram_graph', res.status);
      if (code === 110 || code === 100) throw new ProviderError('post_private', 'account not a public professional account or not found', false, 'instagram_graph', res.status);
      throw classifyHttpStatus(res.status, 'instagram_graph');
    }
    const json = (await res.json()) as { business_discovery?: { id: string; username: string; followers_count?: number; media_count?: number; media?: { data?: unknown[]; paging?: { cursors?: { after?: string }; next?: string } } } };
    if (!json.business_discovery) throw new ProviderError('schema_changed', 'business_discovery missing', false, 'instagram_graph');
    return json.business_discovery;
  }

  async listRecentPosts(req: RecentPostsRequest): Promise<PostPage> {
    const providerRunId = `ig-graph-${Date.now().toString(36)}`;
    const observedAt = this.now();
    const posts: NormalizedPost[] = [];
    const rejected: PostPage['rejected'] = [];
    let after: string | null = req.cursor;
    let nextCursor: string | null = null;
    let pages = 0;
    while (posts.length < req.maxPosts && pages < 5) {
      pages += 1;
      const bd = await this.discovery(req.handle, Math.min(req.maxPosts - posts.length, 50), after);
      const items = bd.media?.data ?? [];
      for (const raw of items) {
        const r = normalizeGraphInstagram(raw, { providerRunId, observedAt, rightsPolicyId: req.rightsPolicyId, dataMode: req.dataMode, ownerId: bd.id, ownerUsername: bd.username });
        if (r.ok) posts.push(r.post);
        else rejected.push({ code: r.code, detail: r.detail });
      }
      const nxt = bd.media?.paging?.next ? (bd.media.paging.cursors?.after ?? null) : null;
      const oldest = posts.reduce<string | null>((acc, p) => (acc === null || p.publishedAt < acc ? p.publishedAt : acc), null);
      if (!nxt || items.length === 0 || (req.newerThan && oldest && oldest < req.newerThan)) {
        nextCursor = nxt;
        break;
      }
      after = nxt;
      nextCursor = nxt;
    }
    return { posts: posts.slice(0, req.maxPosts), rejected, nextCursor, pageLimitReached: nextCursor !== null, providerRunId, newestFirstGuaranteed: true, costMicroUsd: 0 };
  }

  async fetchCreator(input: CreatorLookup): Promise<CreatorSourceRecord> {
    if (!input.handle) throw new ProviderError('permanent_invalid_url', 'handle required', false, 'instagram_graph');
    const bd = await this.discovery(input.handle, 0, null);
    return { platform: 'instagram', platformCreatorId: bd.id, handle: bd.username, displayName: null, canonicalUrl: `https://www.instagram.com/${bd.username}/`, followerCount: bd.followers_count ?? null, postCount: bd.media_count ?? null, verifiedBadgeObserved: false, isPrivate: false, observedAt: this.now(), providerRunId: `ig-graph-${Date.now().toString(36)}` };
  }

  /** Business Discovery medya ID'leri doğrudan GET edilemez; tek gönderi için handle üzerinden sayfa taranır. */
  async fetchPost(input: PostLookup): Promise<NormalizedPost> {
    throw new ProviderError('schema_changed', `fetchPost unsupported on instagram_graph (media ids not directly readable); use listRecentPosts + filter (${input.platformPostId ?? input.canonicalUrl})`, false, 'instagram_graph');
  }

  async refreshMetrics(input: MetricsRequest): Promise<MetricObservation[]> {
    // Sayaç yenileme: handle bazında son N medya tekrar okunur; istenen post id'leri eşleşirse gözlem üretilir (ücretsiz).
    const byHandle = new Map<string, string[]>();
    for (const p of input.posts) {
      const handle = p.canonicalUrl.split('instagram.com/')[1]?.split('/')[0];
      if (!handle || handle === 'p' || handle === 'reel') continue;
      byHandle.set(handle, [...(byHandle.get(handle) ?? []), p.platformPostId]);
    }
    const wanted = new Set(input.posts.map((p) => p.platformPostId));
    const out: MetricObservation[] = [];
    for (const [handle] of byHandle) {
      const page = await this.listRecentPosts({ platform: 'instagram', handle, platformCreatorId: null, maxPosts: 50, newerThan: null, cursor: null, rightsPolicyId: input.rightsPolicyId, dataMode: input.dataMode });
      for (const post of page.posts) if (wanted.has(post.platformPostId)) out.push({ platform: 'instagram', platformPostId: post.platformPostId, observedAt: post.observedAt, views: post.metrics.views, likes: post.metrics.likes, comments: post.metrics.comments, shares: null, saves: null, providerRunId: post.providerRunId });
    }
    return out;
  }

  async getPermittedMedia(input: MediaRequest): Promise<PermittedMediaResult> {
    if (!input.permitted.download && !input.permitted.thumbnail) return { kind: 'denied', reason: 'rights_denied' };
    return { kind: 'unavailable', reason: 'media_unavailable' }; // media_url listRecentPosts ile gelir; ayrı indirme yolu yok
  }

  async checkAvailability(input: PostLookup): Promise<AvailabilityResult> {
    return { platform: 'instagram', platformPostId: input.platformPostId ?? '', availability: 'unknown', checkedAt: this.now() };
  }

  async discoverCreators(_input: DiscoveryRequest): Promise<DiscoveryPage> {
    return { items: [], nextCursor: null, providerRunId: null }; // Graph API'de izinsiz keşif yok (hashtag arama ayrı izin ister)
  }
}
