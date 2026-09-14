/**
 * Apify adaptörü (§13.1 birincil aday): clockworks/tiktok-scraper (TikTok) + apify/instagram-scraper (Instagram).
 * Apify API v2: POST /v2/acts/{actorId}/runs (webhooks=base64 JSON), GET /v2/actor-runs/{runId}, GET /v2/datasets/{id}/items.
 * Token yalnız Authorization header'da; log/hata mesajlarında redaksiyon. Sağlayıcı JSON'u normalize sınırında kalır.
 * Kaynak: docs/research/social-data-access.md (§Apify).
 */
import { normalizeApifyTikTok, type NormalizedPost } from '../normalize';
import { normalizeApifyInstagram } from '../normalize-instagram';
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

export interface ApifyConfig {
  token: string;
  baseUrl?: string; // https://api.apify.com
  tiktokActorId: string; // 'clockworks~tiktok-scraper'
  instagramActorId: string; // 'apify~instagram-scraper'
  /** Webhook hedefi; ayarlıysa run başlatılırken ad-hoc webhook eklenir (ACTOR.RUN.SUCCEEDED|FAILED|ABORTED|TIMED_OUT). */
  webhook?: { requestUrl: string; secret: string } | null;
  /** Senkron bekleme (saniye); worker webhook ile çalışıyorsa 0. */
  waitForFinishSec?: number;
  fetchImpl?: FetchLike;
  now?: () => string;
  /** Run başına maksimum sonuç (bütçe kapısı çağıran katmanda ayrıca uygulanır). */
  maxResultsPerRun?: number;
}

export interface ApifyRun {
  id: string;
  actId: string;
  status: string;
  defaultDatasetId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  /** usageTotalUsd Apify run nesnesinde bulunur; yoksa null (maliyet bilinmiyor → uzlaştırma bekler). */
  usageTotalUsd: number | null;
}

const ACTOR_INPUT_SCHEMA_VERSION = 'apify-input-2026-09';

export class ApifyClient {
  private readonly base: string;
  private readonly fetchImpl: FetchLike;
  constructor(private readonly cfg: ApifyConfig) {
    this.base = (cfg.baseUrl ?? 'https://api.apify.com').replace(/\/$/, '');
    this.fetchImpl = cfg.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.cfg.token}`, 'Content-Type': 'application/json' };
  }

  private async call(path: string, init?: { method?: string; body?: unknown }): Promise<unknown> {
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      const reqInit: { method: string; headers: Record<string, string>; body?: string } = { method: init?.method ?? 'GET', headers: this.headers() };
      if (init?.body !== undefined) reqInit.body = JSON.stringify(init.body);
      res = await this.fetchImpl(`${this.base}${path}`, reqInit);
    } catch (e) {
      throw new ProviderError('provider_timeout', redactSecrets(String((e as Error).message ?? e), [this.cfg.token]), true, 'apify');
    }
    if (!res.ok) throw classifyHttpStatus(res.status, 'apify');
    try {
      return safeJsonParse(await res.text());
    } catch {
      throw new ProviderError('schema_changed', 'apify response not json', false, 'apify', res.status);
    }
  }

  /** Ad-hoc webhook listesi base64 JSON (Apify belgesi). payloadTemplate resource.defaultDatasetId taşır. */
  private webhooksParam(): string {
    if (!this.cfg.webhook) return '';
    const hooks = [
      {
        eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.ABORTED', 'ACTOR.RUN.TIMED_OUT'],
        requestUrl: this.cfg.webhook.requestUrl,
        headersTemplate: JSON.stringify({ 'x-apify-webhook-secret': this.cfg.webhook.secret }),
        payloadTemplate: '{"eventType":{{eventType}},"eventData":{{eventData}},"resource":{{resource}},"createdAt":{{createdAt}}}',
      },
    ];
    return `&webhooks=${Buffer.from(JSON.stringify(hooks)).toString('base64')}`;
  }

  async startRun(actorId: string, input: unknown): Promise<ApifyRun> {
    const wait = this.cfg.waitForFinishSec ?? 0;
    const data = (await this.call(`/v2/acts/${encodeURIComponent(actorId)}/runs?waitForFinish=${wait}${this.webhooksParam()}`, { method: 'POST', body: input })) as { data?: Record<string, unknown> };
    return toRun(data.data);
  }

  async getRun(runId: string): Promise<ApifyRun> {
    const data = (await this.call(`/v2/actor-runs/${encodeURIComponent(runId)}`)) as { data?: Record<string, unknown> };
    return toRun(data.data);
  }

  async getDatasetItems(datasetId: string, opts: { offset: number; limit: number }): Promise<unknown[]> {
    const items = await this.call(`/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json&offset=${opts.offset}&limit=${opts.limit}`);
    if (!Array.isArray(items)) throw new ProviderError('schema_changed', 'dataset items not array', false, 'apify');
    return items;
  }
}

function toRun(d: Record<string, unknown> | undefined): ApifyRun {
  if (!d || typeof d.id !== 'string') throw new ProviderError('schema_changed', 'run object missing id', false, 'apify');
  const usage = d.usageTotalUsd;
  return {
    id: d.id,
    actId: String(d.actId ?? ''),
    status: String(d.status ?? 'UNKNOWN'),
    defaultDatasetId: typeof d.defaultDatasetId === 'string' ? d.defaultDatasetId : null,
    startedAt: typeof d.startedAt === 'string' ? d.startedAt : null,
    finishedAt: typeof d.finishedAt === 'string' ? d.finishedAt : null,
    usageTotalUsd: typeof usage === 'number' ? usage : null,
  };
}

/** Aktör girdileri tek yerde: alan adları sağlayıcı belgesinden; değişirse burada güncellenir (schema_changed izlemesi). */
export function buildActorInput(platform: Platform, req: { handle: string; maxPosts: number; newerThan: string | null }): unknown {
  if (platform === 'tiktok') {
    return {
      profiles: [req.handle],
      resultsPerPage: req.maxPosts,
      profileScrapeSections: ['videos'],
      profileSorting: 'latest',
      excludePinnedPosts: false, // pinned post akışa girer ama dedupe.partitionPage "yeni" saymaz (§13.4)
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      ...(req.newerThan ? { oldestPostDateUnified: req.newerThan.slice(0, 10) } : {}),
    };
  }
  return {
    directUrls: [`https://www.instagram.com/${req.handle}/`],
    resultsType: 'posts',
    resultsLimit: req.maxPosts,
    addParentData: false,
    ...(req.newerThan ? { onlyPostsNewerThan: req.newerThan.slice(0, 10) } : {}),
  };
}

export class ApifyAdapter implements SocialSourceAdapter {
  readonly provider = 'apify' as const;
  readonly platforms: Platform[] = ['tiktok', 'instagram'];
  readonly schemaVersion = ACTOR_INPUT_SCHEMA_VERSION;
  private readonly client: ApifyClient;
  constructor(private readonly cfg: ApifyConfig) {
    this.client = new ApifyClient(cfg);
  }

  private actorFor(platform: Platform): string {
    return platform === 'tiktok' ? this.cfg.tiktokActorId : this.cfg.instagramActorId;
  }

  /** Run başlat (webhook modunda hemen döner). Worker, webhook geldiğinde collectRun ile dataset'i okur. */
  async startProfileRun(req: RecentPostsRequest): Promise<ApifyRun> {
    const max = Math.min(req.maxPosts, this.cfg.maxResultsPerRun ?? 100);
    return this.client.startRun(this.actorFor(req.platform), buildActorInput(req.platform, { handle: req.handle, maxPosts: max, newerThan: req.newerThan }));
  }

  /** Bitmiş run'ın dataset'ini normalize eder. Run kimliği sağlayıcının kendi API'siyle doğrulanır (§13.5 madde 6). */
  async collectRun(runId: string, ctx: { platform: Platform; rightsPolicyId: string; dataMode: 'synthetic' | 'live'; pageSize?: number; maxItems?: number }): Promise<PostPage> {
    const run = await this.client.getRun(runId);
    if (run.status !== 'SUCCEEDED') throw new ProviderError(run.status === 'RUNNING' || run.status === 'READY' ? 'provider_timeout' : 'provider_unavailable', `run status ${run.status}`, run.status === 'RUNNING' || run.status === 'READY', 'apify');
    if (!run.defaultDatasetId) throw new ProviderError('schema_changed', 'run has no dataset', false, 'apify');
    const observedAt = (this.cfg.now ?? (() => new Date().toISOString()))();
    const pageSize = ctx.pageSize ?? 100;
    const maxItems = ctx.maxItems ?? 500;
    const posts: NormalizedPost[] = [];
    const rejected: PostPage['rejected'] = [];
    let offset = 0;
    let pageLimitReached = false;
    for (;;) {
      const items = await this.client.getDatasetItems(run.defaultDatasetId, { offset, limit: pageSize });
      for (const raw of items) {
        const r = ctx.platform === 'tiktok' ? normalizeApifyTikTok(raw, { providerRunId: run.id, observedAt, rightsPolicyId: ctx.rightsPolicyId, dataMode: ctx.dataMode }) : normalizeApifyInstagram(raw, { providerRunId: run.id, observedAt, rightsPolicyId: ctx.rightsPolicyId, dataMode: ctx.dataMode });
        if (r.ok) posts.push(r.post);
        else rejected.push({ code: r.code, detail: r.detail });
      }
      offset += items.length;
      if (items.length < pageSize) break;
      if (offset >= maxItems) {
        pageLimitReached = true;
        break;
      }
    }
    return { posts, rejected, nextCursor: null, pageLimitReached, providerRunId: run.id, newestFirstGuaranteed: false, costMicroUsd: run.usageTotalUsd === null ? null : Math.round(run.usageTotalUsd * 1_000_000) };
  }

  async listRecentPosts(req: RecentPostsRequest): Promise<PostPage> {
    if (!this.cfg.waitForFinishSec) throw new ProviderError('provider_timeout', 'listRecentPosts requires waitForFinishSec>0; use startProfileRun + webhook + collectRun', false, 'apify');
    const run = await this.startProfileRun(req);
    return this.collectRun(run.id, { platform: req.platform, rightsPolicyId: req.rightsPolicyId, dataMode: req.dataMode });
  }

  async discoverCreators(input: DiscoveryRequest): Promise<DiscoveryPage> {
    // Hashtag/keyword araması: TikTok aktörü `hashtags`/`searchQueries`, Instagram aktörü hashtag URL kabul eder.
    const actor = this.actorFor(input.platform);
    const body = input.platform === 'tiktok' ? { searchQueries: [input.query], resultsPerPage: input.maxResults, shouldDownloadVideos: false } : { directUrls: [`https://www.instagram.com/explore/tags/${encodeURIComponent(input.query.replace(/^#/, ''))}/`], resultsType: 'posts', resultsLimit: input.maxResults };
    if (!this.cfg.waitForFinishSec) throw new ProviderError('provider_timeout', 'discoverCreators requires synchronous wait in v1', false, 'apify');
    const run = await this.client.startRun(actor, body);
    if (!run.defaultDatasetId) return { items: [], nextCursor: null, providerRunId: run.id };
    const items = await this.client.getDatasetItems(run.defaultDatasetId, { offset: 0, limit: input.maxResults });
    const foundAt = (this.cfg.now ?? (() => new Date().toISOString()))();
    const byCreator = new Map<string, DiscoveryPage['items'][number]>();
    for (const raw of items) {
      const r = input.platform === 'tiktok' ? normalizeApifyTikTok(raw, { providerRunId: run.id, observedAt: foundAt, rightsPolicyId: 'discovery-no-rights', dataMode: 'live' }) : normalizeApifyInstagram(raw, { providerRunId: run.id, observedAt: foundAt, rightsPolicyId: 'discovery-no-rights', dataMode: 'live' });
      if (!r.ok) continue;
      const key = r.post.platformCreatorId;
      const cur = byCreator.get(key) ?? { platform: input.platform, platformCreatorId: key, handle: r.post.handle, canonicalUrl: input.platform === 'tiktok' ? `https://www.tiktok.com/@${r.post.handle}` : `https://www.instagram.com/${r.post.handle}/`, followerCount: null, sampleCaptions: [], foundVia: `${this.provider}:${input.query}`, foundAt };
      if (r.post.caption && cur.sampleCaptions.length < 5) cur.sampleCaptions.push(r.post.caption.slice(0, 300));
      byCreator.set(key, cur);
    }
    return { items: Array.from(byCreator.values()), nextCursor: null, providerRunId: run.id };
  }

  async fetchCreator(_input: CreatorLookup): Promise<CreatorSourceRecord> {
    throw new ProviderError('schema_changed', 'fetchCreator: profile-only run not wired for apify in v1 (use listRecentPosts; creator identity comes with posts)', false, 'apify');
  }

  async fetchPost(input: PostLookup): Promise<NormalizedPost> {
    if (!input.canonicalUrl) throw new ProviderError('permanent_invalid_url', 'canonicalUrl required', false, 'apify');
    if (!this.cfg.waitForFinishSec) throw new ProviderError('provider_timeout', 'fetchPost requires synchronous wait', false, 'apify');
    const body = input.platform === 'tiktok' ? { postURLs: [input.canonicalUrl], shouldDownloadVideos: false } : { directUrls: [input.canonicalUrl], resultsType: 'posts', resultsLimit: 1 };
    const run = await this.client.startRun(this.actorFor(input.platform), body);
    if (!run.defaultDatasetId) throw new ProviderError('post_deleted', 'no dataset', false, 'apify');
    const items = await this.client.getDatasetItems(run.defaultDatasetId, { offset: 0, limit: 1 });
    const raw = items[0];
    if (!raw) throw new ProviderError('post_deleted', 'empty result', false, 'apify');
    const observedAt = (this.cfg.now ?? (() => new Date().toISOString()))();
    const r = input.platform === 'tiktok' ? normalizeApifyTikTok(raw, { providerRunId: run.id, observedAt, rightsPolicyId: input.rightsPolicyId, dataMode: input.dataMode }) : normalizeApifyInstagram(raw, { providerRunId: run.id, observedAt, rightsPolicyId: input.rightsPolicyId, dataMode: input.dataMode });
    if (!r.ok) throw new ProviderError(r.code === 'permanent_invalid_url' ? 'permanent_invalid_url' : 'schema_changed', r.detail, false, 'apify');
    return r.post;
  }

  async refreshMetrics(input: MetricsRequest): Promise<MetricObservation[]> {
    if (input.posts.length === 0) return [];
    if (!this.cfg.waitForFinishSec) throw new ProviderError('provider_timeout', 'refreshMetrics requires synchronous wait', false, 'apify');
    const urls = input.posts.map((p) => p.canonicalUrl);
    const body = input.platform === 'tiktok' ? { postURLs: urls, shouldDownloadVideos: false } : { directUrls: urls, resultsType: 'posts', resultsLimit: urls.length };
    const run = await this.client.startRun(this.actorFor(input.platform), body);
    if (!run.defaultDatasetId) return [];
    const items = await this.client.getDatasetItems(run.defaultDatasetId, { offset: 0, limit: urls.length });
    const observedAt = (this.cfg.now ?? (() => new Date().toISOString()))();
    const out: MetricObservation[] = [];
    for (const raw of items) {
      const r = input.platform === 'tiktok' ? normalizeApifyTikTok(raw, { providerRunId: run.id, observedAt, rightsPolicyId: input.rightsPolicyId, dataMode: input.dataMode }) : normalizeApifyInstagram(raw, { providerRunId: run.id, observedAt, rightsPolicyId: input.rightsPolicyId, dataMode: input.dataMode });
      if (!r.ok) continue;
      out.push({ platform: input.platform, platformPostId: r.post.platformPostId, observedAt, views: r.post.metrics.views, likes: r.post.metrics.likes, comments: r.post.metrics.comments, shares: r.post.metrics.shares, saves: r.post.metrics.saves, providerRunId: run.id });
    }
    return out;
  }

  /** İndirme URL'sinin teknik varlığı hak değildir; permitted.download false ise adaptör bile URL döndürmez (§14.1). */
  async getPermittedMedia(input: MediaRequest): Promise<PermittedMediaResult> {
    if (!input.permitted.download && !input.permitted.thumbnail) return { kind: 'denied', reason: 'rights_denied' };
    const post = await this.fetchPost({ platform: input.platform, platformPostId: input.platformPostId, canonicalUrl: input.canonicalUrl, rightsPolicyId: 'media-check', dataMode: 'live' });
    if (post.availability !== 'available') return { kind: 'unavailable', reason: post.availability === 'geo_restricted' ? 'geo_restricted' : 'media_unavailable' };
    return { kind: 'available', downloadUrl: null /* indirme yalnız licensed pipeline'da ayrı run ile */, thumbnailUrl: input.permitted.thumbnail ? (post.thumbnailUrl ?? null) : null, urlExpiresAt: null, durationMs: post.mediaCapabilities.durationMs };
  }

  async checkAvailability(input: PostLookup): Promise<AvailabilityResult> {
    const checkedAt = (this.cfg.now ?? (() => new Date().toISOString()))();
    try {
      const p = await this.fetchPost(input);
      return { platform: input.platform, platformPostId: p.platformPostId, availability: p.availability, checkedAt };
    } catch (e) {
      const code = e instanceof ProviderError ? e.code : 'unknown';
      const availability = code === 'post_deleted' ? 'deleted' : code === 'post_private' ? 'private' : code === 'geo_restricted' ? 'geo_restricted' : 'unknown';
      return { platform: input.platform, platformPostId: input.platformPostId ?? '', availability, checkedAt };
    }
  }
}
