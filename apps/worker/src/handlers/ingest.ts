/**
 * Ortak ingestion adımı (§13.4): sayfa → watermark bölme → known/unknown → upsert (metrik snapshot her zaman) → yalnız yeni/düzenlenmiş + ön inceleme geçen gönderi için çıkarım işi.
 * Aynı gönderi iki kez gelirse ikinci ücretli AI işi açılmaz (idempotency key = post + content hash).
 */
import { cheapPrecheck, decideIngest, partitionPage, type CreatorWatermark, type PostPage } from '@viral-places/pipeline';
import type { Ctx } from './types.ts';

export interface IngestStats {
  seen: number;
  new: number;
  edited: number;
  metricsOnly: number;
  rejected: number;
  extractQueued: number;
  coverageGap: boolean;
  nextWatermark: CreatorWatermark;
}

export async function ingestPage(ctx: Ctx, accountId: string, page: PostPage, watermark: CreatorWatermark, providerRunUuid: string | null): Promise<IngestStats> {
  const part = partitionPage(page.posts, watermark, page.pageLimitReached);
  const stats: IngestStats = { seen: page.posts.length, new: 0, edited: 0, metricsOnly: 0, rejected: page.rejected.length, extractQueued: 0, coverageGap: part.coverageGap, nextWatermark: part.nextWatermark };
  for (const post of page.posts) {
    const known = await ctx.db.getKnownPost(post.platform, post.platformPostId);
    const decision = decideIngest(post, known ? { platformPostId: post.platformPostId, contentHash: known.contentHash ?? '' } : null);
    const postId = await ctx.db.upsertPost(accountId, post, providerRunUuid);
    if (decision.kind === 'metrics_only') {
      stats.metricsOnly += 1;
      continue;
    }
    if (decision.kind === 'new_post') stats.new += 1;
    else stats.edited += 1;
    const pre = cheapPrecheck({ caption: post.caption, hashtags: post.hashtags ?? [], hasLocationTag: !!post.locationTag, hasTranscript: false });
    if (!pre.candidate) {
      ctx.log('info', 'precheck_skip', { postId, reasons: pre.reasons });
      continue;
    }
    const r = await ctx.db.enqueue('post.extract', { postId, contentHash: post.contentHash, precheck: pre.reasons }, `post.extract:${postId}:${post.contentHash}`, providerRunUuid);
    if (r.inserted) stats.extractQueued += 1;
  }
  if (part.coverageGap) ctx.log('warn', 'coverage_gap', { accountId, providerRunId: page.providerRunId });
  return stats;
}
