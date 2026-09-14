/**
 * Fixture adaptörü: ağ yok; sözleşme/entegrasyon testleri ve DEMO modu için. dataMode='synthetic' zorunlu.
 */
import type { NormalizedPost } from '../normalize';
import type { AvailabilityResult, CreatorLookup, CreatorSourceRecord, DiscoveryPage, DiscoveryRequest, MediaRequest, MetricObservation, MetricsRequest, PermittedMediaResult, Platform, PostLookup, PostPage, RecentPostsRequest, SocialSourceAdapter } from './types';

export class FixtureAdapter implements SocialSourceAdapter {
  readonly provider = 'fixture' as const;
  readonly platforms: Platform[] = ['tiktok', 'instagram'];
  readonly schemaVersion = 'fixture-1.0';
  constructor(private readonly posts: NormalizedPost[], private readonly now: () => string = () => new Date().toISOString()) {}

  async listRecentPosts(req: RecentPostsRequest): Promise<PostPage> {
    const all = this.posts.filter((p) => p.platform === req.platform && p.handle === req.handle && (!req.newerThan || p.publishedAt >= req.newerThan));
    const posts = all.slice(0, req.maxPosts).map((p) => ({ ...p, dataMode: 'synthetic' as const, provider: 'fixture' as const, observedAt: this.now() }));
    return { posts, rejected: [], nextCursor: null, pageLimitReached: all.length > req.maxPosts, providerRunId: `fixture-${req.handle}`, newestFirstGuaranteed: true, costMicroUsd: 0 };
  }
  async fetchPost(input: PostLookup): Promise<NormalizedPost> {
    const p = this.posts.find((x) => x.platform === input.platform && (x.platformPostId === input.platformPostId || x.canonicalUrl === input.canonicalUrl));
    if (!p) throw new Error('post_deleted');
    return { ...p, observedAt: this.now() };
  }
  async refreshMetrics(input: MetricsRequest): Promise<MetricObservation[]> {
    const now = this.now();
    return input.posts.flatMap((q) => {
      const p = this.posts.find((x) => x.platformPostId === q.platformPostId);
      return p ? [{ platform: p.platform, platformPostId: p.platformPostId, observedAt: now, ...p.metrics, providerRunId: 'fixture-metrics' }] : [];
    });
  }
  async checkAvailability(input: PostLookup): Promise<AvailabilityResult> {
    const p = this.posts.find((x) => x.platformPostId === input.platformPostId);
    return { platform: input.platform, platformPostId: input.platformPostId ?? '', availability: p ? p.availability : 'deleted', checkedAt: this.now() };
  }
  async getPermittedMedia(input: MediaRequest): Promise<PermittedMediaResult> {
    if (!input.permitted.download && !input.permitted.thumbnail) return { kind: 'denied', reason: 'rights_denied' };
    return { kind: 'unavailable', reason: 'media_unavailable' };
  }
  async fetchCreator(input: CreatorLookup): Promise<CreatorSourceRecord> {
    const p = this.posts.find((x) => x.platform === input.platform && (x.handle === input.handle || x.platformCreatorId === input.platformCreatorId));
    if (!p) throw new Error('post_deleted');
    return { platform: p.platform, platformCreatorId: p.platformCreatorId, handle: p.handle, displayName: null, canonicalUrl: p.canonicalUrl, followerCount: null, postCount: this.posts.filter((x) => x.platformCreatorId === p.platformCreatorId).length, verifiedBadgeObserved: false, isPrivate: false, observedAt: this.now(), providerRunId: 'fixture-profile' };
  }
  async discoverCreators(input: DiscoveryRequest): Promise<DiscoveryPage> {
    const now = this.now();
    const seen = new Map<string, DiscoveryPage['items'][number]>();
    for (const p of this.posts.filter((x) => x.platform === input.platform && (x.caption ?? '').toLocaleLowerCase('tr').includes(input.query.toLocaleLowerCase('tr')))) {
      if (!seen.has(p.platformCreatorId)) seen.set(p.platformCreatorId, { platform: p.platform, platformCreatorId: p.platformCreatorId, handle: p.handle, canonicalUrl: p.canonicalUrl, followerCount: null, sampleCaptions: [p.caption ?? ''], foundVia: `fixture:${input.query}`, foundAt: now });
    }
    return { items: Array.from(seen.values()).slice(0, input.maxResults), nextCursor: null, providerRunId: 'fixture-search' };
  }
}
