/**
 * Tekilleştirme ve high-water mark (§13.4): pinned post "yeni" değildir; içerik hash'i değişmediyse AI yeniden çalışmaz;
 * metrik snapshot her gözlemde yeni satırdır.
 */
import type { NormalizedPost } from './normalize';

export interface KnownPost {
  platformPostId: string;
  contentHash: string;
}

export interface CreatorWatermark {
  /** En son görülen yayın zamanı (ISO). */
  newestPublishedAt: string | null;
  /** Son taramada görülen ID kümesi (pinned/eski postları yeni saymamak için). */
  seenIds: string[];
}

export type IngestDecision =
  | { kind: 'new_post'; reason: 'unseen' }
  | { kind: 'edited_post'; reason: 'content_hash_changed' }
  | { kind: 'metrics_only'; reason: 'known_unchanged' };

export function decideIngest(post: NormalizedPost, known: KnownPost | null): IngestDecision {
  if (!known) return { kind: 'new_post', reason: 'unseen' };
  if (known.contentHash !== post.contentHash) return { kind: 'edited_post', reason: 'content_hash_changed' };
  return { kind: 'metrics_only', reason: 'known_unchanged' };
}

/** Tarama sayfasında hangi kayıtların "yeni" olduğu: watermark + görülen ID'ler birlikte; newest-first garantisi varsayılmaz. */
export function partitionPage(page: NormalizedPost[], watermark: CreatorWatermark, pageLimitReached: boolean): { fresh: NormalizedPost[]; stale: NormalizedPost[]; coverageGap: boolean; nextWatermark: CreatorWatermark } {
  const seen = new Set(watermark.seenIds);
  const fresh: NormalizedPost[] = [];
  const stale: NormalizedPost[] = [];
  let newest = watermark.newestPublishedAt;
  for (const p of page) {
    if (seen.has(p.platformPostId)) stale.push(p);
    else fresh.push(p);
    if (!newest || p.publishedAt > newest) newest = p.publishedAt;
  }
  // Sayfa limitine takıldıysa ve en eski kayıt hâlâ watermark'tan yeniyse boşluk olabilir.
  const oldest = page.reduce<string | null>((acc, p) => (acc === null || p.publishedAt < acc ? p.publishedAt : acc), null);
  const coverageGap = pageLimitReached && !!oldest && (watermark.newestPublishedAt === null || oldest > watermark.newestPublishedAt);
  const ids = Array.from(new Set([...watermark.seenIds, ...page.map((p) => p.platformPostId)])).slice(-500);
  return { fresh, stale, coverageGap, nextWatermark: { newestPublishedAt: newest, seenIds: ids } };
}
