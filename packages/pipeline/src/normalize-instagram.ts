/**
 * Instagram kayıtları → NormalizedPost. İki kaynak: (1) Apify apify/instagram-scraper / instagram-reel-scraper çıktısı,
 * (2) resmi Instagram Graph API Business Discovery medya nesnesi. Alan garantisi yok; kimlik/URL eksikse reddedilir.
 * Kaynak: docs/research/social-data-access.md (Eylül 2026 araştırması).
 */
import { z } from 'zod';
import { NormalizedPost, contentHashOf, extractHashtags, type NormalizeResult } from './normalize';

/** apify/instagram-scraper (resultsType posts|reels) alan alt kümesi. */
export const ApifyInstagramItem = z.object({
  id: z.union([z.string(), z.number()]),
  shortCode: z.string().optional(),
  url: z.string().optional(),
  type: z.string().optional(),
  productType: z.string().optional(),
  caption: z.string().optional().nullable(),
  hashtags: z.array(z.string()).optional(),
  likesCount: z.number().optional().nullable(),
  commentsCount: z.number().optional().nullable(),
  videoViewCount: z.number().optional().nullable(),
  videoPlayCount: z.number().optional().nullable(),
  displayUrl: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  videoDuration: z.number().optional().nullable(),
  timestamp: z.string().optional(),
  locationName: z.string().optional().nullable(),
  locationId: z.union([z.string(), z.number()]).optional().nullable(),
  ownerUsername: z.string().optional(),
  ownerId: z.union([z.string(), z.number()]).optional(),
  isPinned: z.boolean().optional(),
  isSponsored: z.boolean().optional(),
  paidPartnership: z.boolean().optional(),
});
export type ApifyInstagramItem = z.infer<typeof ApifyInstagramItem>;

const IG_HOSTS = ['instagram.com', 'www.instagram.com'];

function canonicalIgUrl(shortcode: string | undefined, url: string | undefined, productType: string | undefined): string | null {
  if (shortcode) return `https://www.instagram.com/${productType === 'clips' ? 'reel' : 'p'}/${shortcode}/`;
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !IG_HOSTS.includes(u.hostname)) return null;
    return `https://www.instagram.com${u.pathname.endsWith('/') ? u.pathname : u.pathname + '/'}`;
  } catch {
    return null;
  }
}

export function normalizeApifyInstagram(raw: unknown, ctx: { providerRunId: string; observedAt: string; rightsPolicyId: string; dataMode: 'synthetic' | 'live' }): NormalizeResult {
  const parsed = ApifyInstagramItem.safeParse(raw);
  if (!parsed.success) return { ok: false, code: 'schema_changed', detail: parsed.error.issues.map((i) => i.path.join('.')).join(',') };
  const item = parsed.data;
  if (typeof item.id === 'number' && !Number.isSafeInteger(item.id)) return { ok: false, code: 'schema_changed', detail: 'id_precision_lost' };
  const platformPostId = String(item.id);
  const creatorId = item.ownerId !== undefined ? String(item.ownerId) : null;
  const handle = item.ownerUsername ?? null;
  if (!/^\d+$/.test(platformPostId) || !creatorId || !handle) return { ok: false, code: 'missing_identity', detail: 'id/owner missing' };
  const url = canonicalIgUrl(item.shortCode, item.url, item.productType);
  if (!url) return { ok: false, code: 'permanent_invalid_url', detail: 'no shortcode/url or host not instagram' };
  if (!item.timestamp) return { ok: false, code: 'schema_changed', detail: 'timestamp missing' };
  const publishedAt = new Date(item.timestamp);
  if (Number.isNaN(publishedAt.getTime())) return { ok: false, code: 'schema_changed', detail: 'timestamp unparsable' };
  const caption = item.caption ?? null;
  // Instagram'da videoPlayCount tarayıcıdaki sayaçla eşleşir; videoViewCount iç sayaçtır (Apify notu). Play tercih edilir.
  const views = item.videoPlayCount ?? item.videoViewCount ?? null;
  const post = {
    schemaVersion: '1.0' as const,
    dataMode: ctx.dataMode,
    provider: 'apify' as const,
    providerRunId: ctx.providerRunId,
    platform: 'instagram' as const,
    platformPostId,
    platformCreatorId: creatorId,
    handle,
    canonicalUrl: url,
    publishedAt: publishedAt.toISOString(),
    observedAt: ctx.observedAt,
    caption,
    language: null,
    metrics: { views, likes: item.likesCount ?? null, comments: item.commentsCount ?? null, shares: null, saves: null },
    availability: 'available' as const,
    sponsoredStatus: item.isSponsored === true || item.paidPartnership === true ? ('declared' as const) : ('unknown' as const),
    mediaCapabilities: { downloadUrlPresent: !!item.videoUrl, durationMs: item.videoDuration ? Math.round(item.videoDuration * 1000) : null },
    uploadCountryHint: null,
    contentHash: contentHashOf({ platform: 'instagram', platformPostId, caption }),
    rightsPolicyId: ctx.rightsPolicyId,
    platformShortcode: item.shortCode ?? null,
    hashtags: item.hashtags && item.hashtags.length > 0 ? item.hashtags.map((h) => h.replace(/^#/, '').toLocaleLowerCase('tr')).slice(0, 60) : extractHashtags(caption),
    locationTag: item.locationName ? { name: item.locationName, platformLocationId: item.locationId != null ? String(item.locationId) : null, lat: null, lng: null } : null,
    thumbnailUrl: item.displayUrl ?? null,
  };
  const validated = NormalizedPost.safeParse(post);
  if (!validated.success) return { ok: false, code: 'schema_changed', detail: validated.error.issues.map((i) => i.path.join('.')).join(',') };
  return { ok: true, post: validated.data };
}

/**
 * Instagram Graph API Business Discovery medya nesnesi (resmi, izinsiz creator için tek resmi yol).
 * Konum alanı resmi API'de YOK; hashtag caption'dan ayrıştırılır. view_count yalnız Reels'te.
 */
export const GraphInstagramMedia = z.object({
  id: z.string(),
  caption: z.string().optional().nullable(),
  comments_count: z.number().optional().nullable(),
  like_count: z.number().optional().nullable(),
  media_type: z.string().optional(),
  media_product_type: z.string().optional(),
  media_url: z.string().optional().nullable(),
  thumbnail_url: z.string().optional().nullable(),
  permalink: z.string().optional(),
  timestamp: z.string().optional(),
  username: z.string().optional(),
  view_count: z.number().optional().nullable(),
});
export type GraphInstagramMedia = z.infer<typeof GraphInstagramMedia>;

export function normalizeGraphInstagram(
  raw: unknown,
  ctx: { providerRunId: string; observedAt: string; rightsPolicyId: string; dataMode: 'synthetic' | 'live'; ownerId: string; ownerUsername: string },
): NormalizeResult {
  const parsed = GraphInstagramMedia.safeParse(raw);
  if (!parsed.success) return { ok: false, code: 'schema_changed', detail: parsed.error.issues.map((i) => i.path.join('.')).join(',') };
  const m = parsed.data;
  if (!/^\d+$/.test(m.id)) return { ok: false, code: 'missing_identity', detail: 'media id not numeric' };
  if (!m.permalink) return { ok: false, code: 'permanent_invalid_url', detail: 'permalink missing' };
  let shortcode: string | null = null;
  try {
    const u = new URL(m.permalink);
    if (u.protocol !== 'https:' || !IG_HOSTS.includes(u.hostname)) return { ok: false, code: 'permanent_invalid_url', detail: u.hostname };
    shortcode = u.pathname.split('/').filter(Boolean)[1] ?? null;
  } catch {
    return { ok: false, code: 'permanent_invalid_url', detail: 'unparsable permalink' };
  }
  if (!m.timestamp) return { ok: false, code: 'schema_changed', detail: 'timestamp missing' };
  const caption = m.caption ?? null;
  const isVideo = m.media_type === 'VIDEO';
  const post = {
    schemaVersion: '1.0' as const,
    dataMode: ctx.dataMode,
    provider: 'instagram_graph' as const,
    providerRunId: ctx.providerRunId,
    platform: 'instagram' as const,
    platformPostId: m.id,
    platformCreatorId: ctx.ownerId,
    handle: m.username ?? ctx.ownerUsername,
    canonicalUrl: m.permalink,
    publishedAt: new Date(m.timestamp).toISOString(),
    observedAt: ctx.observedAt,
    caption,
    language: null,
    metrics: { views: m.view_count ?? null, likes: m.like_count ?? null, comments: m.comments_count ?? null, shares: null, saves: null },
    availability: 'available' as const,
    sponsoredStatus: 'unknown' as const,
    mediaCapabilities: { downloadUrlPresent: isVideo && !!m.media_url, durationMs: null },
    uploadCountryHint: null,
    contentHash: contentHashOf({ platform: 'instagram', platformPostId: m.id, caption }),
    rightsPolicyId: ctx.rightsPolicyId,
    platformShortcode: shortcode,
    hashtags: extractHashtags(caption),
    locationTag: null,
    thumbnailUrl: m.thumbnail_url ?? (isVideo ? null : (m.media_url ?? null)),
  };
  const validated = NormalizedPost.safeParse(post);
  if (!validated.success) return { ok: false, code: 'schema_changed', detail: validated.error.issues.map((i) => i.path.join('.')).join(',') };
  return { ok: true, post: validated.data };
}
