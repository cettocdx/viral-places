/**
 * Sağlayıcı kaydı → NormalizedPost (§13.2). Bu bizim sözleşmemizdir; Apify alan adları burada haritalanır.
 * Platform ID'leri string kalır (BigInt'e çevrilmez). null ile 0 ayrılır. Caption ile transcript ayrıdır.
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';

export const NormalizedPost = z.object({
  schemaVersion: z.literal('1.0'),
  dataMode: z.enum(['synthetic', 'live']),
  provider: z.enum(['apify', 'ensembledata', 'instagram_graph', 'scrapecreators', 'fixture']),
  providerRunId: z.string().min(1),
  platform: z.enum(['tiktok', 'instagram']),
  platformPostId: z.string().regex(/^\d{1,30}$/),
  platformCreatorId: z.string().min(1),
  handle: z.string().min(1),
  canonicalUrl: z.string().url(),
  publishedAt: z.string().datetime({ offset: true }),
  observedAt: z.string().datetime({ offset: true }),
  caption: z.string().nullable(),
  language: z.string().nullable(),
  metrics: z.object({
    views: z.number().int().nonnegative().nullable(),
    likes: z.number().int().nonnegative().nullable(),
    comments: z.number().int().nonnegative().nullable(),
    shares: z.number().int().nonnegative().nullable(),
    saves: z.number().int().nonnegative().nullable(),
  }),
  availability: z.enum(['available', 'private', 'deleted', 'geo_restricted', 'unknown']),
  sponsoredStatus: z.enum(['declared', 'none_declared', 'unknown']),
  mediaCapabilities: z.object({ downloadUrlPresent: z.boolean(), durationMs: z.number().int().positive().nullable() }),
  /** Post'un yüklendiği ülke; mekan konumu DEĞİLDİR (§16.1). */
  uploadCountryHint: z.string().length(2).nullable(),
  contentHash: z.string().length(64),
  rightsPolicyId: z.string().min(1),
  /** Instagram shortcode gibi ikincil platform kimliği (URL'de görünen). */
  platformShortcode: z.string().max(64).nullable().optional(),
  /** Caption'dan ayrıştırılmış hashtag'ler (# olmadan, küçük harf). */
  hashtags: z.array(z.string().max(100)).max(60).optional(),
  /**
   * Gönderiye creator'ın açıkça eklediği yer etiketi (§16.1 konum hiyerarşisinin en üstü).
   * uploadCountryHint ile karıştırılmaz; koordinat platformdan geliyorsa origin=platform_tag olarak saklanır.
   */
  locationTag: z
    .object({ name: z.string().max(200), platformLocationId: z.string().max(64).nullable(), lat: z.number().min(-90).max(90).nullable(), lng: z.number().min(-180).max(180).nullable() })
    .nullable()
    .optional(),
  /** Küçük görsel (hak: may_store_thumbnail); imzalı CDN URL'leri süreli olabilir. */
  thumbnailUrl: z.string().url().nullable().optional(),
});
export type NormalizedPost = z.infer<typeof NormalizedPost>;

/** Apify clockworks/tiktok-scraper çıktısının bizde kullanılan alt kümesi; hepsi opsiyonel (alan garantisi yok, §13.1). */
export const ApifyTikTokItem = z.object({
  id: z.union([z.string(), z.number()]),
  text: z.string().optional().nullable(),
  createTimeISO: z.string().optional(),
  createTime: z.union([z.number(), z.string()]).optional(),
  webVideoUrl: z.string().optional(),
  authorMeta: z.object({ id: z.union([z.string(), z.number()]).optional(), name: z.string().optional() }).optional(),
  playCount: z.number().optional().nullable(),
  diggCount: z.number().optional().nullable(),
  commentCount: z.number().optional().nullable(),
  shareCount: z.number().optional().nullable(),
  collectCount: z.number().optional().nullable(),
  isAd: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  locationCreated: z.string().optional().nullable(),
  videoMeta: z.object({ duration: z.number().optional(), coverUrl: z.string().optional() }).optional(),
  mediaUrls: z.array(z.string()).optional(),
  textLanguage: z.string().optional().nullable(),
  hashtags: z.array(z.union([z.string(), z.object({ name: z.string().optional() })])).optional(),
  /** Aktör changelog 2025-01-23: gönderi bir konuma etiketliyse locationMeta gelir (§16.1 açık yer etiketi). */
  locationMeta: z.object({ address: z.string().optional().nullable(), city: z.string().optional().nullable(), countryCode: z.string().optional().nullable(), locationName: z.string().optional().nullable() }).optional().nullable(),
  subtitleLinks: z.array(z.object({ language: z.string().optional(), downloadLink: z.string().optional(), source: z.string().optional() })).optional(),
  errorCode: z.string().optional(),
});
export type ApifyTikTokItem = z.infer<typeof ApifyTikTokItem>;

/** Caption içindeki #etiketler; büyük/küçük harf ve Türkçe karakter korunur, tekilleştirilir. */
export function extractHashtags(caption: string | null): string[] {
  if (!caption) return [];
  const found = caption.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return Array.from(new Set(found.map((h) => h.slice(1).toLocaleLowerCase('tr')))).slice(0, 60);
}

export function contentHashOf(parts: { platform: string; platformPostId: string; caption: string | null }): string {
  return createHash('sha256').update(`${parts.platform}\n${parts.platformPostId}\n${parts.caption ?? ''}`).digest('hex');
}

function toIso(item: ApifyTikTokItem): string | null {
  if (item.createTimeISO) return new Date(item.createTimeISO).toISOString();
  if (item.createTime !== undefined) {
    const n = typeof item.createTime === 'string' ? Number(item.createTime) : item.createTime;
    if (Number.isFinite(n)) return new Date(n * 1000).toISOString();
  }
  return null;
}

export type NormalizeResult = { ok: true; post: NormalizedPost } | { ok: false; code: 'schema_changed' | 'permanent_invalid_url' | 'missing_identity'; detail: string };

/** Alan eksikliği başarısızlık nedeni değil; kimlik ve URL eksikse kayıt reddedilir (§13.6 hata türleri). */
export function normalizeApifyTikTok(raw: unknown, ctx: { providerRunId: string; observedAt: string; rightsPolicyId: string; dataMode: 'synthetic' | 'live' }): NormalizeResult {
  const parsed = ApifyTikTokItem.safeParse(raw);
  if (!parsed.success) return { ok: false, code: 'schema_changed', detail: parsed.error.issues.map((i) => i.path.join('.')).join(',') };
  const item = parsed.data;
  if (item.errorCode) return { ok: false, code: 'missing_identity', detail: `actor error item: ${item.errorCode}` };
  if (typeof item.id === 'number' && !Number.isSafeInteger(item.id)) return { ok: false, code: 'schema_changed', detail: 'id_precision_lost: numeric id exceeds 2^53; provider must return string ids' };
  const platformPostId = String(item.id);
  const creatorId = item.authorMeta?.id !== undefined ? String(item.authorMeta.id) : null;
  const handle = item.authorMeta?.name ?? null;
  if (!/^\d+$/.test(platformPostId) || !creatorId || !handle) return { ok: false, code: 'missing_identity', detail: 'id/author missing' };
  const url = item.webVideoUrl ?? `https://www.tiktok.com/@${handle}/video/${platformPostId}`;
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return { ok: false, code: 'permanent_invalid_url', detail: 'not https' };
    host = u.hostname;
  } catch {
    return { ok: false, code: 'permanent_invalid_url', detail: 'unparsable' };
  }
  if (!host.endsWith('tiktok.com')) return { ok: false, code: 'permanent_invalid_url', detail: host };
  const publishedAt = toIso(item);
  if (!publishedAt) return { ok: false, code: 'schema_changed', detail: 'createTime missing' };
  const caption = item.text ?? null;
  const post = {
    schemaVersion: '1.0' as const,
    dataMode: ctx.dataMode,
    provider: 'apify' as const,
    providerRunId: ctx.providerRunId,
    platform: 'tiktok' as const,
    platformPostId,
    platformCreatorId: creatorId,
    handle,
    canonicalUrl: url,
    publishedAt,
    observedAt: ctx.observedAt,
    caption,
    language: item.textLanguage ?? null,
    metrics: {
      views: item.playCount ?? null,
      likes: item.diggCount ?? null,
      comments: item.commentCount ?? null,
      shares: item.shareCount ?? null,
      saves: item.collectCount ?? null,
    },
    availability: 'available' as const,
    sponsoredStatus: item.isAd === true ? ('declared' as const) : ('unknown' as const),
    mediaCapabilities: { downloadUrlPresent: (item.mediaUrls?.length ?? 0) > 0, durationMs: item.videoMeta?.duration ? Math.round(item.videoMeta.duration * 1000) : null },
    uploadCountryHint: item.locationCreated && item.locationCreated.length === 2 ? item.locationCreated.toUpperCase() : null,
    contentHash: contentHashOf({ platform: 'tiktok', platformPostId, caption }),
    rightsPolicyId: ctx.rightsPolicyId,
    platformShortcode: null,
    hashtags: item.hashtags && item.hashtags.length > 0 ? item.hashtags.map((h) => (typeof h === 'string' ? h : (h.name ?? ''))).filter(Boolean).map((h) => h.replace(/^#/, '').toLocaleLowerCase('tr')).slice(0, 60) : extractHashtags(caption),
    locationTag: item.locationMeta?.locationName
      ? { name: [item.locationMeta.locationName, item.locationMeta.city].filter(Boolean).join(', '), platformLocationId: null, lat: null, lng: null }
      : null,
    thumbnailUrl: item.videoMeta?.coverUrl ?? null,
  };
  const validated = NormalizedPost.safeParse(post);
  if (!validated.success) return { ok: false, code: 'schema_changed', detail: validated.error.issues.map((i) => i.path.join('.')).join(',') };
  return { ok: true, post: validated.data };
}
