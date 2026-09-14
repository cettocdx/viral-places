/**
 * Ham TikTok "aweme" nesnesi → NormalizedPost. ScrapeCreators (/v3/tiktok/profile/videos) ve EnsembleData (/tt/user/posts)
 * ikisi de TikTok'un iç JSON şeklini döndürür: aweme_id, desc, create_time (epoch s), statistics{play_count,...},
 * video{cover, duration}, poi/poi_info, text_extra, author{uid, unique_id}, is_ad, is_top.
 * Kaynak: docs/research/social-data-access.md (§ScrapeCreators, §EnsembleData).
 */
import { z } from 'zod';
import { NormalizedPost, contentHashOf, extractHashtags, type NormalizeResult } from './normalize';

const UrlList = z.object({ url_list: z.array(z.string()).optional() }).optional().nullable();

export const TikTokAweme = z.object({
  aweme_id: z.union([z.string(), z.number()]),
  desc: z.string().optional().nullable(),
  create_time: z.union([z.number(), z.string()]).optional(),
  region: z.string().optional().nullable(),
  share_url: z.string().optional().nullable(),
  is_ad: z.boolean().optional(),
  is_top: z.union([z.boolean(), z.number()]).optional(),
  author: z.object({ uid: z.union([z.string(), z.number()]).optional(), unique_id: z.string().optional(), sec_uid: z.string().optional(), nickname: z.string().optional(), region: z.string().optional() }).optional(),
  statistics: z.object({ play_count: z.number().optional().nullable(), digg_count: z.number().optional().nullable(), comment_count: z.number().optional().nullable(), share_count: z.number().optional().nullable(), collect_count: z.union([z.number(), z.string()]).optional().nullable() }).optional(),
  video: z.object({ duration: z.number().optional().nullable(), cover: UrlList, origin_cover: UrlList, play_addr: UrlList, download_addr: UrlList, download_no_watermark_addr: UrlList, has_watermark: z.boolean().optional() }).optional(),
  text_extra: z.array(z.object({ hashtag_name: z.string().optional().nullable(), type: z.number().optional() })).optional().nullable(),
  poi: z.object({ poi_id: z.union([z.string(), z.number()]).optional().nullable(), poi_name: z.string().optional().nullable(), address_info: z.object({ city_name: z.string().optional().nullable(), address: z.string().optional().nullable() }).optional().nullable(), latitude: z.union([z.number(), z.string()]).optional().nullable(), longitude: z.union([z.number(), z.string()]).optional().nullable() }).optional().nullable(),
  poi_info: z.object({ poi_id: z.union([z.string(), z.number()]).optional().nullable(), poi_name: z.string().optional().nullable(), address_info: z.object({ city_name: z.string().optional().nullable(), address: z.string().optional().nullable() }).optional().nullable() }).optional().nullable(),
  anchors: z.array(z.object({ type: z.number().optional(), keyword: z.string().optional().nullable(), description: z.string().optional().nullable() })).optional().nullable(),
  commerce_info: z.object({ adv_promotable: z.boolean().optional(), branded_content_type: z.number().optional() }).optional().nullable(),
});
export type TikTokAweme = z.infer<typeof TikTokAweme>;

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

export function normalizeTikTokAweme(
  raw: unknown,
  ctx: { provider: 'scrapecreators' | 'ensembledata'; providerRunId: string; observedAt: string; rightsPolicyId: string; dataMode: 'synthetic' | 'live' },
): NormalizeResult {
  const parsed = TikTokAweme.safeParse(raw);
  if (!parsed.success) return { ok: false, code: 'schema_changed', detail: parsed.error.issues.map((i) => i.path.join('.')).join(',') };
  const a = parsed.data;
  if (typeof a.aweme_id === 'number' && !Number.isSafeInteger(a.aweme_id)) return { ok: false, code: 'schema_changed', detail: 'id_precision_lost' };
  const platformPostId = String(a.aweme_id);
  const creatorId = a.author?.uid !== undefined ? String(a.author.uid) : null;
  const handle = a.author?.unique_id ?? null;
  if (!/^\d+$/.test(platformPostId) || !creatorId || !handle) return { ok: false, code: 'missing_identity', detail: 'aweme_id/author missing' };
  const url = `https://www.tiktok.com/@${handle}/video/${platformPostId}`;
  const ct = num(a.create_time);
  if (ct === null) return { ok: false, code: 'schema_changed', detail: 'create_time missing' };
  const caption = a.desc ?? null;
  const poi = a.poi ?? a.poi_info ?? null;
  const poiName = poi?.poi_name ?? null;
  const branded = a.commerce_info?.branded_content_type !== undefined && a.commerce_info.branded_content_type > 0;
  const post = {
    schemaVersion: '1.0' as const,
    dataMode: ctx.dataMode,
    provider: ctx.provider,
    providerRunId: ctx.providerRunId,
    platform: 'tiktok' as const,
    platformPostId,
    platformCreatorId: creatorId,
    handle,
    canonicalUrl: url,
    publishedAt: new Date(ct * 1000).toISOString(),
    observedAt: ctx.observedAt,
    caption,
    language: null,
    metrics: {
      views: a.statistics?.play_count ?? null,
      likes: a.statistics?.digg_count ?? null,
      comments: a.statistics?.comment_count ?? null,
      shares: a.statistics?.share_count ?? null,
      saves: num(a.statistics?.collect_count),
    },
    availability: 'available' as const,
    sponsoredStatus: a.is_ad === true || branded ? ('declared' as const) : ('unknown' as const),
    mediaCapabilities: { downloadUrlPresent: (a.video?.download_addr?.url_list?.length ?? 0) > 0 || (a.video?.play_addr?.url_list?.length ?? 0) > 0, durationMs: a.video?.duration ? Math.round(a.video.duration > 1000 ? a.video.duration : a.video.duration * 1000) : null },
    uploadCountryHint: a.region && a.region.length === 2 ? a.region.toUpperCase() : null,
    contentHash: contentHashOf({ platform: 'tiktok', platformPostId, caption }),
    rightsPolicyId: ctx.rightsPolicyId,
    platformShortcode: null,
    hashtags: a.text_extra && a.text_extra.length > 0 ? Array.from(new Set(a.text_extra.map((t) => t.hashtag_name).filter((h): h is string => !!h).map((h) => h.toLocaleLowerCase('tr')))).slice(0, 60) : extractHashtags(caption),
    locationTag: poiName
      ? { name: [poiName, poi?.address_info?.city_name].filter(Boolean).join(', '), platformLocationId: poi?.poi_id != null ? String(poi.poi_id) : null, lat: 'latitude' in (poi ?? {}) ? num((poi as { latitude?: number | string | null }).latitude) : null, lng: 'longitude' in (poi ?? {}) ? num((poi as { longitude?: number | string | null }).longitude) : null }
      : null,
    thumbnailUrl: a.video?.cover?.url_list?.[0] ?? a.video?.origin_cover?.url_list?.[0] ?? null,
  };
  const validated = NormalizedPost.safeParse(post);
  if (!validated.success) return { ok: false, code: 'schema_changed', detail: validated.error.issues.map((i) => i.path.join('.')).join(',') };
  return { ok: true, post: validated.data };
}

/** ScrapeCreators /v1/instagram/post ve /v2/instagram/user/posts ham IG şekli (pk/code/caption.text/taken_at/location{lat,lng}). */
export const InstagramRawMedia = z.object({
  pk: z.union([z.string(), z.number()]).optional(),
  id: z.union([z.string(), z.number()]).optional(),
  code: z.string().optional(),
  taken_at: z.union([z.number(), z.string()]).optional(),
  taken_at_timestamp: z.union([z.number(), z.string()]).optional(),
  product_type: z.string().optional().nullable(),
  media_type: z.number().optional(),
  caption: z.union([z.string(), z.object({ text: z.string().optional().nullable() })]).optional().nullable(),
  like_count: z.number().optional().nullable(),
  comment_count: z.number().optional().nullable(),
  play_count: z.number().optional().nullable(),
  view_count: z.number().optional().nullable(),
  video_duration: z.number().optional().nullable(),
  video_versions: z.array(z.object({ url: z.string().optional() })).optional().nullable(),
  image_versions2: z.object({ candidates: z.array(z.object({ url: z.string().optional() })).optional() }).optional().nullable(),
  location: z.object({ pk: z.union([z.string(), z.number()]).optional().nullable(), name: z.string().optional().nullable(), lat: z.number().optional().nullable(), lng: z.number().optional().nullable() }).optional().nullable(),
  user: z.object({ pk: z.union([z.string(), z.number()]).optional(), id: z.union([z.string(), z.number()]).optional(), username: z.string().optional() }).optional(),
  owner: z.object({ id: z.union([z.string(), z.number()]).optional(), username: z.string().optional() }).optional(),
  is_paid_partnership: z.boolean().optional(),
});
export type InstagramRawMedia = z.infer<typeof InstagramRawMedia>;

export function normalizeInstagramRaw(raw: unknown, ctx: { provider: 'scrapecreators' | 'ensembledata'; providerRunId: string; observedAt: string; rightsPolicyId: string; dataMode: 'synthetic' | 'live' }): NormalizeResult {
  const parsed = InstagramRawMedia.safeParse(raw);
  if (!parsed.success) return { ok: false, code: 'schema_changed', detail: parsed.error.issues.map((i) => i.path.join('.')).join(',') };
  const m = parsed.data;
  const idRaw = m.pk ?? m.id;
  if (typeof idRaw === 'number' && !Number.isSafeInteger(idRaw)) return { ok: false, code: 'schema_changed', detail: 'id_precision_lost' };
  const platformPostId = idRaw !== undefined ? String(idRaw).split('_')[0]! : '';
  const creatorId = m.user?.pk ?? m.user?.id ?? m.owner?.id;
  const handle = m.user?.username ?? m.owner?.username ?? null;
  if (!/^\d+$/.test(platformPostId) || creatorId === undefined || !handle) return { ok: false, code: 'missing_identity', detail: 'pk/user missing' };
  if (!m.code) return { ok: false, code: 'permanent_invalid_url', detail: 'shortcode missing' };
  const ts = num(m.taken_at ?? m.taken_at_timestamp);
  if (ts === null) return { ok: false, code: 'schema_changed', detail: 'taken_at missing' };
  const caption = typeof m.caption === 'string' ? m.caption : (m.caption?.text ?? null);
  const isReel = m.product_type === 'clips' || (m.media_type === 2 && m.product_type !== 'feed');
  const post = {
    schemaVersion: '1.0' as const,
    dataMode: ctx.dataMode,
    provider: ctx.provider,
    providerRunId: ctx.providerRunId,
    platform: 'instagram' as const,
    platformPostId,
    platformCreatorId: String(creatorId),
    handle,
    canonicalUrl: `https://www.instagram.com/${isReel ? 'reel' : 'p'}/${m.code}/`,
    publishedAt: new Date(ts * 1000).toISOString(),
    observedAt: ctx.observedAt,
    caption,
    language: null,
    metrics: { views: m.play_count ?? m.view_count ?? null, likes: m.like_count ?? null, comments: m.comment_count ?? null, shares: null, saves: null },
    availability: 'available' as const,
    sponsoredStatus: m.is_paid_partnership === true ? ('declared' as const) : ('unknown' as const),
    mediaCapabilities: { downloadUrlPresent: (m.video_versions?.length ?? 0) > 0, durationMs: m.video_duration ? Math.round(m.video_duration * 1000) : null },
    uploadCountryHint: null,
    contentHash: contentHashOf({ platform: 'instagram', platformPostId, caption }),
    rightsPolicyId: ctx.rightsPolicyId,
    platformShortcode: m.code,
    hashtags: extractHashtags(caption),
    locationTag: m.location?.name ? { name: m.location.name, platformLocationId: m.location.pk != null ? String(m.location.pk) : null, lat: m.location.lat ?? null, lng: m.location.lng ?? null } : null,
    thumbnailUrl: m.image_versions2?.candidates?.[0]?.url ?? null,
  };
  const validated = NormalizedPost.safeParse(post);
  if (!validated.success) return { ok: false, code: 'schema_changed', detail: validated.error.issues.map((i) => i.path.join('.')).join(',') };
  return { ok: true, post: validated.data };
}
