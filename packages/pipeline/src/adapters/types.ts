/**
 * Sosyal kaynak adaptör sözleşmesi (§13.2). Bu bizim arayüzümüzdür; sağlayıcı JSON'u bu sınırın dışına sızmaz.
 * Her adaptör alan dönüşümü + schemaVersion taşır; platform ID'leri string kalır (§13.2).
 */
import type { NormalizedPost } from '../normalize';

export type Platform = 'tiktok' | 'instagram';
export type ProviderName = 'apify' | 'ensembledata' | 'instagram_graph' | 'scrapecreators' | 'fixture';

/** §13.6 hata türleri; sağlayıcı HTTP kodu burada sınıflandırılır, ham hata dışarı sızmaz. */
export type ProviderErrorCode =
  | 'rate_limited'
  | 'provider_timeout'
  | 'authentication_failed'
  | 'schema_changed'
  | 'post_private'
  | 'post_deleted'
  | 'geo_restricted'
  | 'media_unavailable'
  | 'rights_denied'
  | 'budget_exceeded'
  | 'permanent_invalid_url'
  | 'provider_unavailable';

export class ProviderError extends Error {
  constructor(readonly code: ProviderErrorCode, message: string, readonly retryable: boolean, readonly provider: ProviderName, readonly httpStatus: number | null = null) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** HTTP durumundan §13.6 sınıfı; 403/login engeli aşılmaz, cookie/CAPTCHA/hesap rotasyonu YOK. */
export function classifyHttpStatus(status: number, provider: ProviderName): ProviderError {
  if (status === 401 || status === 403) return new ProviderError('authentication_failed', `provider auth/forbidden (${status})`, false, provider, status);
  if (status === 402) return new ProviderError('budget_exceeded', 'provider payment required', false, provider, status);
  if (status === 404) return new ProviderError('post_deleted', 'resource not found', false, provider, status);
  if (status === 408 || status === 504) return new ProviderError('provider_timeout', 'provider timeout', true, provider, status);
  if (status === 429) return new ProviderError('rate_limited', 'provider rate limited', true, provider, status);
  if (status >= 500) return new ProviderError('provider_unavailable', `provider ${status}`, true, provider, status);
  return new ProviderError('schema_changed', `unexpected status ${status}`, false, provider, status);
}

export interface DiscoveryRequest {
  platform: Platform;
  /** İzinli keyword/hashtag araması (§12.2); kişisel takipçi grafiği toplanmaz. */
  query: string;
  locale: string | null;
  maxResults: number;
}
export interface DiscoveryCandidate {
  platform: Platform;
  platformCreatorId: string;
  handle: string;
  canonicalUrl: string;
  followerCount: number | null;
  sampleCaptions: string[];
  foundVia: string;
  foundAt: string;
}
export interface DiscoveryPage {
  items: DiscoveryCandidate[];
  nextCursor: string | null;
  providerRunId: string | null;
}

export interface CreatorLookup {
  platform: Platform;
  handle: string | null;
  platformCreatorId: string | null;
}
export interface CreatorSourceRecord {
  platform: Platform;
  platformCreatorId: string;
  handle: string;
  displayName: string | null;
  canonicalUrl: string;
  followerCount: number | null;
  postCount: number | null;
  verifiedBadgeObserved: boolean;
  isPrivate: boolean;
  observedAt: string;
  providerRunId: string | null;
}

export interface RecentPostsRequest {
  platform: Platform;
  handle: string;
  platformCreatorId: string | null;
  /** Sayfa limiti (§13.3: ilk tarama ≤100, sonra watermark'a göre). */
  maxPosts: number;
  /** Bu tarihten eski gönderiler istenmez (sağlayıcı destekliyorsa). */
  newerThan: string | null;
  cursor: string | null;
  rightsPolicyId: string;
  dataMode: 'synthetic' | 'live';
}
export interface PostPage {
  posts: NormalizedPost[];
  rejected: Array<{ code: 'schema_changed' | 'permanent_invalid_url' | 'missing_identity'; detail: string }>;
  nextCursor: string | null;
  pageLimitReached: boolean;
  providerRunId: string;
  /** Sağlayıcı newest-first garantisi veriyor mu (§13.4)? Bilinmiyorsa false. */
  newestFirstGuaranteed: boolean;
  costMicroUsd: number | null;
}

export interface PostLookup {
  platform: Platform;
  platformPostId: string | null;
  canonicalUrl: string | null;
  rightsPolicyId: string;
  dataMode: 'synthetic' | 'live';
}

export interface MetricsRequest {
  platform: Platform;
  posts: Array<{ platformPostId: string; canonicalUrl: string }>;
  rightsPolicyId: string;
  dataMode: 'synthetic' | 'live';
}
export interface MetricObservation {
  platform: Platform;
  platformPostId: string;
  observedAt: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  providerRunId: string;
}

export interface MediaRequest {
  platform: Platform;
  platformPostId: string;
  canonicalUrl: string;
  /** Çağıran katman policy'yi (may_download_media) zaten kontrol etmiş olmalı; adaptör tekrar kontrol eder. */
  permitted: { download: boolean; thumbnail: boolean };
}
export type PermittedMediaResult =
  | { kind: 'denied'; reason: 'rights_denied' }
  | { kind: 'unavailable'; reason: 'media_unavailable' | 'geo_restricted' }
  | { kind: 'available'; downloadUrl: string | null; thumbnailUrl: string | null; urlExpiresAt: string | null; durationMs: number | null };

export interface AvailabilityResult {
  platform: Platform;
  platformPostId: string;
  availability: 'available' | 'private' | 'deleted' | 'geo_restricted' | 'unknown';
  checkedAt: string;
}

export interface SocialSourceAdapter {
  readonly provider: ProviderName;
  readonly platforms: Platform[];
  readonly schemaVersion: string;
  discoverCreators(input: DiscoveryRequest): Promise<DiscoveryPage>;
  fetchCreator(input: CreatorLookup): Promise<CreatorSourceRecord>;
  listRecentPosts(input: RecentPostsRequest): Promise<PostPage>;
  fetchPost(input: PostLookup): Promise<NormalizedPost>;
  refreshMetrics(input: MetricsRequest): Promise<MetricObservation[]>;
  getPermittedMedia(input: MediaRequest): Promise<PermittedMediaResult>;
  checkAvailability(input: PostLookup): Promise<AvailabilityResult>;
}

/** Sağlayıcı fiyat kartı (belgelenmiş birim). Bilinmiyorsa null → planlayıcı ücretli iş açmaz (§27.4). */
export interface ProviderPriceCard {
  provider: ProviderName;
  platform: Platform;
  /** 1000 sonuç/post başına USD. */
  usdPer1kResults: number | null;
  /** Aylık sabit ücret (varsa). */
  monthlyBaseUsd: number | null;
  source: string;
  observedAt: string;
}

/** fetch soyutlaması: testte sahte, üretimde global fetch. Secret'lar Authorization header'da; query string'e yazılırsa log redaksiyonu (§13.2). */
export type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ status: number; ok: boolean; text(): Promise<string>; json(): Promise<unknown> }>;

export function redactSecrets(s: string, secrets: Array<string | undefined>): string {
  let out = s;
  for (const sec of secrets) if (sec && sec.length >= 6) out = out.split(sec).join('[REDACTED]');
  return out;
}

/**
 * Büyük tamsayı kimlikleri (TikTok aweme_id/uid, IG pk > 2^53) JSON.parse ile bozulur (§13.2). Bilinen kimlik anahtarlarında
 * tırnaksız ≥16 haneli sayılar ayrıştırmadan önce string'e çevrilir. Metrik alanları etkilenmez.
 */
const BIG_ID_KEYS = ['aweme_id', 'id', 'pk', 'uid', 'author_id', 'owner_id', 'ownerId', 'locationId', 'poi_id', 'user_id', 'media_id', 'sec_uid', 'item_id', 'video_id'];
const BIG_ID_RE = new RegExp(`"(${BIG_ID_KEYS.join('|')})"(\\s*:\\s*)(-?\\d{16,})(?=[,}\\]\\s])`, 'g');
export function safeJsonParse(text: string): unknown {
  return JSON.parse(text.replace(BIG_ID_RE, '"$1"$2"$3"'));
}
