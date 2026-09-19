/**
 * DB satırı → public DTO (§19). Çıkış contracts Zod şemasından geçer; şemaya uymayan veri 500 değil, alan düzeyinde temizlenir/500 olur.
 * Ham sağlayıcı alanı, private alan veya secret DTO'ya taşınmaz.
 */
import {
  CityDto,
  CreatorDetailDto,
  MapPlaceItemDto,
  PlaceDetailDto,
  type CoverageDto,
  type SourcePostDto,
  type SummaryItemDto,
  type TrendSummaryDto,
} from '@viral-places/contracts';
import { env } from './env';

export type Row = Record<string, any>;

const COVERAGE_NOTE: Record<string, string | null> = { none: 'coverage.none', pilot: 'coverage.pilot', growing: 'coverage.growing', covered: null };

export function coverageOf(city: Row, monitoredCreators: number | null, lastObs: string | null): CoverageDto {
  return {
    status: city.coverage_status,
    cityId: city.id,
    cityName: city.name,
    noteKey: COVERAGE_NOTE[city.coverage_status] ?? null,
    monitoredCreators,
    lastSuccessfulObservationAt: lastObs,
  };
}

export function cityDto(city: Row, monitoredCreators: number | null, lastObs: string | null): CityDto {
  return CityDto.parse({
    id: city.id,
    name: city.name,
    countryCode: city.country_code,
    timezone: city.timezone,
    center: { lat: city.center_lat, lng: city.center_lng },
    coverage: coverageOf(city, monitoredCreators, lastObs),
  });
}

export function dataStatusOf(rows: Row[]): 'demo' | 'live' | 'stale' {
  if (env.dataMode() === 'demo' || rows.some((r) => r?.data_mode === 'synthetic')) return 'demo';
  return 'live';
}

export function trendOf(score: Row | null): TrendSummaryDto {
  if (!score) {
    return {
      score: null, status: 'insufficient_data', trending: false, scoreVersion: 'none', asOf: new Date(0).toISOString(), windowDays: 7,
      eligiblePosts: 0, distinctCreators: 0, accessibleViews: null, metricsCoverage: null, baselinePartial: false, baselineScope: null,
      components: { momentum: null, diversity: 0, freshness: 0, outperformance: null }, reasonCodes: ['no_score_row'], lastSuccessfulObservationAt: null,
    };
  }
  const c = score.components_json ?? {};
  return {
    score: score.score,
    status: score.status,
    trending: score.trending,
    scoreVersion: score.score_version,
    asOf: score.as_of,
    windowDays: score.window_days,
    eligiblePosts: score.eligible_posts,
    distinctCreators: score.distinct_creators,
    accessibleViews: score.accessible_views === null || score.accessible_views === undefined ? null : String(score.accessible_views),
    metricsCoverage: score.metrics_coverage === null ? null : Number(score.metrics_coverage),
    baselinePartial: score.baseline_partial,
    baselineScope: score.baseline_scope,
    components: { momentum: c.momentum ?? null, diversity: c.diversity ?? 0, freshness: c.freshness ?? 0, outperformance: c.outperformance ?? null },
    reasonCodes: score.reason_codes ?? [],
    lastSuccessfulObservationAt: score.last_successful_observation_at,
  };
}

export function mapItem(venue: Row, loc: Row, score: Row | null, thumbnailUrl: string | null, renderMode: string, lastObs: string | null): MapPlaceItemDto {
  return MapPlaceItemDto.parse({
    type: 'place',
    id: venue.id,
    name: venue.own_name ?? venue.name,
    neighborhood: venue.neighborhood,
    cityId: venue.city_id,
    category: venue.primary_category ?? venue.category,
    location: { lat: loc.lat, lng: loc.lng, origin: loc.location_origin, expiresAt: loc.location_expires_at },
    trend: { score: score?.score ?? null, status: score?.status ?? 'insufficient_data', trending: score?.trending ?? false },
    media: { mode: renderMode, thumbnailUrl },
    freshness: { lastObservedAt: lastObs },
    familySupported: venue.family_supported,
  });
}

/** TikTok resmi gömme oynatıcısı (§14.2 official_embed): kaynak URL'sindeki video kimliğinden türetilir; başka platformda null. */
export function officialEmbedUrl(platform: string, renderMode: string, sourceUrl: string | null): string | null {
  if (renderMode !== 'official_embed' || !sourceUrl) return null;
  if (platform === 'tiktok') {
    const m = /\/video\/(\d{6,})/.exec(sourceUrl);
    return m ? `https://www.tiktok.com/embed/v2/${m[1]}` : null;
  }
  return null;
}

function httpUrlOrNull(v: unknown): string | null {
  return typeof v === 'string' && /^https?:\/\//.test(v) ? v : null;
}

export function sourceDto(s: Row, creator: Row, account: Row | null): SourcePostDto {
  const visible = s.render_mode !== 'unavailable';
  return {
    id: s.source_post_id,
    platform: s.platform,
    creator: {
      id: creator.id,
      displayName: creator.display_name,
      handle: account?.handle ?? creator.display_name,
      platform: s.platform,
      verificationKind: account?.verification_kind ?? 'none',
      // Avatar yalnız kaynak gösterilebilir durumdaysa (hak kaydı render_mode'a yansır; unavailable → deny-by-default)
      avatarUrl: visible ? httpUrlOrNull(account?.avatar_url) : null,
    },
    publishedAt: s.published_at,
    observedAt: s.observed_at,
    views: s.views === null || s.views === undefined ? null : String(s.views),
    likes: s.likes === null || s.likes === undefined ? null : String(s.likes),
    sponsored: s.sponsored_status,
    stance: s.stance,
    media: {
      mode: s.render_mode,
      thumbnailUrl: visible ? httpUrlOrNull(s.thumbnail_url) : null,
      embedUrl: officialEmbedUrl(s.platform, s.render_mode, s.source_url),
      sourceUrl: visible ? s.source_url : null,
      rightsPolicyId: s.rights_policy_id,
      expiresAt: s.rights_expires_at,
    },
    linkResolution: 'approved',
  };
}

export function placeDetailDto(input: { requestId: string; venue: Row; city: Row; loc: Row; score: Row | null; summary: Row | null; sources: Row[]; creators: Map<string, Row>; accounts: Map<string, Row>; monitoredCreators: number | null }): PlaceDetailDto {
  const { venue, city, loc, score, summary, sources } = input;
  const lastObs = score?.last_successful_observation_at ?? null;
  const items: SummaryItemDto[] = Array.isArray(summary?.claims_json) ? summary!.claims_json : [];
  return PlaceDetailDto.parse({
    requestId: input.requestId,
    asOf: score?.as_of ?? new Date().toISOString(),
    dataStatus: dataStatusOf([venue, city]),
    id: venue.id,
    name: venue.own_name,
    neighborhood: venue.neighborhood,
    city: cityDto(city, input.monitoredCreators, lastObs),
    category: venue.primary_category,
    location: { lat: loc.lat, lng: loc.lng, origin: loc.location_origin, expiresAt: loc.location_expires_at },
    externalRating: null, // Google Places puanı: cache + atıf hattı BLOCKED
    trend: trendOf(score),
    sources: sources.map((s) => sourceDto(s, input.creators.get(s.creator_id) ?? { id: s.creator_id, display_name: 'creator' }, input.accounts.get(`${s.creator_id}:${s.platform}`) ?? null)),
    summary: { items, modelVersion: summary?.model_version ?? null, generatedAt: summary?.generated_at ?? null },
    practical: { addressHint: venue.neighborhood, familyAttributes: [] },
    freshness: { lastObservedAt: lastObs },
  });
}

export function creatorDetailDto(input: { requestId: string; creator: Row; account: Row; cities: Array<{ id: string; name: string; placeCount: number }>; categories: string[]; places: MapPlaceItemDto[]; posts: SourcePostDto[] }): CreatorDetailDto {
  const { creator, account } = input;
  return CreatorDetailDto.parse({
    requestId: input.requestId,
    asOf: new Date().toISOString(),
    dataStatus: dataStatusOf([creator]),
    id: creator.id,
    displayName: creator.display_name,
    handle: account.handle,
    platform: account.platform,
    profileUrl: account.canonical_url,
    verificationKind: account.verification_kind,
    claimStatus: creator.claim_status,
    avatarUrl: httpUrlOrNull(account.avatar_url),
    bio: typeof account.bio === 'string' && account.bio.trim() && account.profile_observed_at ? { text: account.bio, source: 'platform_bio_observed', observedAt: account.profile_observed_at } : null,
    platformFollowers: account.follower_count !== null && account.follower_count !== undefined && account.profile_observed_at ? { count: String(account.follower_count), platform: account.platform, observedAt: account.profile_observed_at } : null,
    cities: input.cities,
    categories: input.categories,
    places: input.places,
    posts: input.posts,
    styleNotes: [],
    compiledFromPublicPostsNoticeKey: 'creator.compiledFromPublicPosts',
  });
}
