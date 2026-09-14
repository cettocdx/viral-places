/**
 * DEMO VERİ — TAMAMI SENTETİK. Gerçek işletme, creator, izlenme veya puan iddiası değildir.
 * Referans görsellerdeki isimler/puanlar KULLANILMAMIŞTIR (§6.1, §32).
 * Bütün kayıtlar dataStatus='demo' taşır; production seed'ine giremez (§10).
 * Trend skorları packages/scoring ile sentetik bileşenlerden deterministik hesaplanır; elle yazılmaz.
 */
import type { Category } from '@viral-places/domain';
import type { CityDto, CreatorDetailDto, MapPlaceItemDto, PlaceDetailDto, SourcePostDto, SummaryItemDto, TrendSummaryDto } from '@viral-places/contracts';
import { computeViralScore, isTrending, type ScoreComponents, type TrendConfig } from '@viral-places/scoring';
import { decideRender, type RightsRecord } from '@viral-places/policy';

export const DEMO_AS_OF = '2026-09-11T09:00:00Z';
export const DEMO_DATA_STATUS = 'demo' as const;

/** config/pipeline-policy.example.json trend bölümü ile aynı değerler (test bunu doğrular). */
export const DEMO_TREND_CONFIG: TrendConfig = {
  version: 'trend-v0-proposal',
  windowDays: 7,
  weights: { momentum: 0.45, diversity: 0.3, freshness: 0.15, outperformance: 0.1 },
  creatorDiversitySaturation: 6,
  freshnessDecayHours: 72,
  minimumIndependentCreators: 2,
  minimumPosts: 3,
  minimumMomentumCoverage: 0.7,
  minimumNormalizationObservations: 100,
  freshObservationAgeHoursExclusive: 24,
  trendingBadge: { minimumScore: 75, minimumMomentum: 0.7, minimumCreators: 3, newestPostAgeHoursExclusive: 72 },
};

export const demoCity: CityDto = {
  id: 'demo-city-ist',
  name: 'İstanbul',
  countryCode: 'TR',
  timezone: 'Europe/Istanbul',
  center: { lat: 41.03, lng: 28.98 },
  coverage: {
    status: 'pilot',
    cityId: 'demo-city-ist',
    cityName: 'İstanbul',
    noteKey: 'coverage.pilotDemo',
    monitoredCreators: 3,
    lastSuccessfulObservationAt: '2026-09-11T08:30:00Z',
  },
};

/** Sentetik creator kayıtları; platform profil bağlantıları fixture router'a gider, crawl edilmez. */
export interface DemoCreator {
  id: string;
  displayName: string;
  handle: string;
  bio: string;
  cities: string[];
  categories: Category[];
  /** Deny-by-default: yalnız açıkça "demo-approved" olanlarda link_only gösterim. */
  rights: RightsRecord | null;
}

const demoApprovedLinkOnly: RightsRecord = {
  policyId: 'demo-link-only',
  policyVersion: '1.0',
  approvedBy: 'DEMO-fixture (hukuki onay değildir)',
  approvedAt: '2026-09-01T00:00:00Z',
  expiresAt: null,
  revokedAt: null,
  permissions: { may_collect_metadata: true, may_store_metrics: true, may_show_source_link: true, may_show_creator_profile: true },
};

export const demoCreators: DemoCreator[] = [
  {
    id: 'demo-creator-a',
    displayName: 'Demo Creator A',
    handle: 'demo.creator.a',
    bio: 'DEMO biyografi: şehirdeki kahve ve kahvaltı mekanlarını paylaşıyor.',
    cities: ['demo-city-ist'],
    categories: ['coffee', 'food'],
    rights: demoApprovedLinkOnly,
  },
  {
    id: 'demo-creator-b',
    displayName: 'Demo Creator B',
    handle: 'demo.creator.b',
    bio: 'DEMO biyografi: aile ile gezilecek yerler ve müzeler.',
    cities: ['demo-city-ist'],
    categories: ['family', 'culture', 'sightseeing'],
    rights: demoApprovedLinkOnly,
  },
  {
    id: 'demo-creator-c',
    displayName: 'Demo Creator C',
    handle: 'demo.creator.c',
    bio: 'DEMO biyografi: gece hayatı ve yeni açılan restoranlar.',
    cities: ['demo-city-ist'],
    categories: ['nightlife', 'food'],
    // Hak kaydı yok -> medya unavailable, creator profil linki yok.
    rights: null,
  },
];

interface DemoVenueSeed {
  id: string;
  name: string;
  neighborhood: string;
  category: Category;
  /** Kara üzerinde bilinen semt koordinatlarına yakın sentetik noktalar; suya pin konmaz. */
  lat: number;
  lng: number;
  familySupported: boolean;
  components: ScoreComponents;
  eligiblePosts: number;
  distinctCreators: number;
  momentumCoverage: number;
  lastObservationAgeHours: number;
  cohortObservations: number;
  newestPostAgeHours: number;
  posts: Array<{ id: string; creatorId: string; publishedAt: string; views: string | null; sponsored: 'declared' | 'none_declared' | 'unknown'; stance: 'recommend' | 'neutral' | 'avoid' | 'unclear' }>;
  summary: SummaryItemDto[];
  familyAttributes: Array<{ key: string; value: 'supported' | 'contradicted' | 'unknown'; evidenceIds: string[] }>;
}

const seeds: DemoVenueSeed[] = [
  {
    id: 'demo-venue-001',
    name: 'Demo Kafe Karaköy',
    neighborhood: 'Karaköy',
    category: 'coffee',
    lat: 41.0242,
    lng: 28.9769,
    familySupported: false,
    components: { M: 0.88, D: 0.6667, F: 0.95, O: 0.8 },
    eligiblePosts: 5,
    distinctCreators: 4,
    momentumCoverage: 0.9,
    lastObservationAgeHours: 0.5,
    cohortObservations: 240,
    newestPostAgeHours: 20,
    posts: [
      { id: 'demo-post-001', creatorId: 'demo-creator-a', publishedAt: '2026-09-10T12:00:00Z', views: '184000', sponsored: 'none_declared', stance: 'recommend' },
      { id: 'demo-post-002', creatorId: 'demo-creator-b', publishedAt: '2026-09-09T09:00:00Z', views: '92000', sponsored: 'unknown', stance: 'recommend' },
      { id: 'demo-post-003', creatorId: 'demo-creator-c', publishedAt: '2026-09-08T18:00:00Z', views: null, sponsored: 'unknown', stance: 'recommend' },
    ],
    summary: [
      { claimType: 'try', text: 'DEMO: Kaynak gönderide filtre kahve ve tarçınlı çörek öneriliyor.', evidenceIds: ['demo-ev-001'], sourcePostIds: ['demo-post-001'], lastVerifiedAt: '2026-09-10T13:00:00Z', expiresAt: null },
      { claimType: 'atmosphere', text: 'DEMO: İki kaynak sakin ve küçük bir mekan olduğunu söylüyor.', evidenceIds: ['demo-ev-002', 'demo-ev-003'], sourcePostIds: ['demo-post-001', 'demo-post-002'], lastVerifiedAt: '2026-09-10T13:00:00Z', expiresAt: null },
      { claimType: 'uncertainty', text: 'DEMO: Rezervasyon veya en iyi ziyaret saati hakkında kaynakta bilgi yok.', evidenceIds: ['demo-ev-004'], sourcePostIds: ['demo-post-002'], lastVerifiedAt: '2026-09-10T13:00:00Z', expiresAt: null },
    ],
    familyAttributes: [{ key: 'stroller_access', value: 'unknown', evidenceIds: [] }],
  },
  {
    id: 'demo-venue-002',
    name: 'Demo Lokanta Cihangir',
    neighborhood: 'Cihangir',
    category: 'food',
    lat: 41.0318,
    lng: 28.9829,
    familySupported: false,
    components: { M: 0.74, D: 0.6667, F: 0.8, O: null },
    eligiblePosts: 6,
    distinctCreators: 4,
    momentumCoverage: 0.85,
    lastObservationAgeHours: 3,
    cohortObservations: 240,
    newestPostAgeHours: 30,
    posts: [
      { id: 'demo-post-004', creatorId: 'demo-creator-a', publishedAt: '2026-09-09T20:00:00Z', views: '410000', sponsored: 'none_declared', stance: 'recommend' },
      { id: 'demo-post-005', creatorId: 'demo-creator-c', publishedAt: '2026-09-07T20:00:00Z', views: '75000', sponsored: 'declared', stance: 'recommend' },
    ],
    summary: [
      { claimType: 'try', text: 'DEMO: Kaynakta günün çorbası ve zeytinyağlılar öne çıkarılıyor.', evidenceIds: ['demo-ev-005'], sourcePostIds: ['demo-post-004'], lastVerifiedAt: '2026-09-10T08:00:00Z', expiresAt: null },
      { claimType: 'reservation', text: 'DEMO: Bir kaynak hafta sonu rezervasyon öneriyor; zorunluluk işletmeden doğrulanmadı.', evidenceIds: ['demo-ev-006'], sourcePostIds: ['demo-post-004'], lastVerifiedAt: '2026-09-10T08:00:00Z', expiresAt: null },
    ],
    familyAttributes: [],
  },
  {
    id: 'demo-venue-003',
    name: 'Demo Müze Sultanahmet',
    neighborhood: 'Sultanahmet',
    category: 'culture',
    lat: 41.0075,
    lng: 28.9765,
    familySupported: true,
    components: { M: 0.55, D: 0.5, F: 0.6, O: 0.2 },
    eligiblePosts: 4,
    distinctCreators: 3,
    momentumCoverage: 0.75,
    lastObservationAgeHours: 6,
    cohortObservations: 150,
    newestPostAgeHours: 60,
    posts: [
      { id: 'demo-post-006', creatorId: 'demo-creator-b', publishedAt: '2026-09-08T21:00:00Z', views: '58000', sponsored: 'none_declared', stance: 'recommend' },
    ],
    summary: [
      { claimType: 'family_note', text: 'DEMO: Kaynak gönderi bebek arabasıyla giriş yapılabildiğini söylüyor.', evidenceIds: ['demo-ev-007'], sourcePostIds: ['demo-post-006'], lastVerifiedAt: '2026-09-09T10:00:00Z', expiresAt: null },
    ],
    familyAttributes: [
      { key: 'stroller_access', value: 'supported', evidenceIds: ['demo-ev-007'] },
      { key: 'kids_menu', value: 'unknown', evidenceIds: [] },
    ],
  },
  {
    id: 'demo-venue-004',
    name: 'Demo Bar Beyoğlu',
    neighborhood: 'Beyoğlu',
    category: 'nightlife',
    lat: 41.0336,
    lng: 28.9776,
    familySupported: false,
    components: { M: 0.9, D: 0.1667, F: 1, O: 0.9 },
    eligiblePosts: 4,
    distinctCreators: 1, // tek bağımsız creator -> insufficient_data (V03)
    momentumCoverage: 1,
    lastObservationAgeHours: 1,
    cohortObservations: 240,
    newestPostAgeHours: 5,
    posts: [
      { id: 'demo-post-007', creatorId: 'demo-creator-c', publishedAt: '2026-09-11T04:00:00Z', views: '900000', sponsored: 'unknown', stance: 'recommend' },
    ],
    summary: [],
    familyAttributes: [{ key: 'kids_welcome', value: 'contradicted', evidenceIds: ['demo-ev-008'] }],
  },
  {
    id: 'demo-venue-005',
    name: 'Demo Park Kafe Moda',
    neighborhood: 'Moda',
    category: 'family',
    lat: 40.9835,
    lng: 29.0258,
    familySupported: true,
    components: { M: 0.7, D: 0.5, F: 0.7, O: null },
    eligiblePosts: 3,
    distinctCreators: 3,
    momentumCoverage: 0.7,
    lastObservationAgeHours: 30, // > 24 saat -> stale (V06)
    cohortObservations: 200,
    newestPostAgeHours: 40,
    posts: [
      { id: 'demo-post-008', creatorId: 'demo-creator-b', publishedAt: '2026-09-09T15:00:00Z', views: '31000', sponsored: 'none_declared', stance: 'recommend' },
    ],
    summary: [
      { claimType: 'family_note', text: 'DEMO: Kaynak gönderide çocuk oyun alanı olduğu belirtiliyor.', evidenceIds: ['demo-ev-009'], sourcePostIds: ['demo-post-008'], lastVerifiedAt: '2026-09-09T16:00:00Z', expiresAt: null },
    ],
    familyAttributes: [{ key: 'play_area', value: 'supported', evidenceIds: ['demo-ev-009'] }],
  },
  {
    id: 'demo-venue-006',
    name: 'Demo Butik Nişantaşı',
    neighborhood: 'Nişantaşı',
    category: 'shopping',
    lat: 41.0478,
    lng: 28.9935,
    familySupported: false,
    components: { M: null, D: 0.3333, F: 0.5, O: null }, // tek snapshot -> momentum yok (V04)
    eligiblePosts: 2,
    distinctCreators: 2,
    momentumCoverage: 0,
    lastObservationAgeHours: 2,
    cohortObservations: 240,
    newestPostAgeHours: 48,
    posts: [
      { id: 'demo-post-009', creatorId: 'demo-creator-a', publishedAt: '2026-09-09T09:00:00Z', views: '12000', sponsored: 'unknown', stance: 'neutral' },
    ],
    summary: [],
    familyAttributes: [],
  },
  {
    id: 'demo-venue-007',
    name: 'Demo Seyir Terası Balat',
    neighborhood: 'Balat',
    category: 'sightseeing',
    lat: 41.0295,
    lng: 28.9488,
    familySupported: true,
    components: { M: 0.8, D: 0.5, F: 0.9, O: 0.6 }, // V01 -> 71
    eligiblePosts: 4,
    distinctCreators: 3,
    momentumCoverage: 0.8,
    lastObservationAgeHours: 4,
    cohortObservations: 240,
    newestPostAgeHours: 26,
    posts: [
      { id: 'demo-post-010', creatorId: 'demo-creator-b', publishedAt: '2026-09-10T07:00:00Z', views: '240000', sponsored: 'none_declared', stance: 'recommend' },
      { id: 'demo-post-011', creatorId: 'demo-creator-a', publishedAt: '2026-09-09T07:00:00Z', views: '66000', sponsored: 'none_declared', stance: 'recommend' },
    ],
    summary: [
      { claimType: 'visit_time', text: 'DEMO: İki kaynak gün batımında gittiğini söylüyor; "en iyi saat" iddiası yapılmıyor.', evidenceIds: ['demo-ev-010', 'demo-ev-011'], sourcePostIds: ['demo-post-010', 'demo-post-011'], lastVerifiedAt: '2026-09-10T09:00:00Z', expiresAt: null },
    ],
    familyAttributes: [{ key: 'stroller_access', value: 'unknown', evidenceIds: [] }],
  },
  {
    // Aynı bina, farklı kat: Karaköy kafeyle birebir aynı koordinat (§7.2 "aynı koordinattaki farklı mekanlarda seçim listesi").
    id: 'demo-venue-008',
    name: 'Demo Çatı Bar Karaköy',
    neighborhood: 'Karaköy',
    category: 'nightlife',
    lat: 41.0242,
    lng: 28.9769,
    familySupported: false,
    components: { M: 0.75, D: 0.5, F: 0.9, O: 0.7 },
    eligiblePosts: 2,
    distinctCreators: 2,
    momentumCoverage: 0.8,
    lastObservationAgeHours: 2,
    cohortObservations: 240,
    newestPostAgeHours: 30,
    posts: [
      { id: 'demo-post-012', creatorId: 'demo-creator-c', publishedAt: '2026-09-10T02:00:00Z', views: '61000', sponsored: 'none_declared', stance: 'recommend' },
      { id: 'demo-post-013', creatorId: 'demo-creator-b', publishedAt: '2026-09-08T21:00:00Z', views: null, sponsored: 'unknown', stance: 'neutral' },
    ],
    summary: [
      { claimType: 'atmosphere', text: 'DEMO: Kaynak gönderi kafenin üst katındaki terastan Haliç manzarasından söz ediyor.', evidenceIds: ['demo-ev-012'], sourcePostIds: ['demo-post-012'], lastVerifiedAt: '2026-09-10T13:00:00Z', expiresAt: null },
    ],
    familyAttributes: [{ key: 'kids_welcome', value: 'unknown', evidenceIds: [] }],
  },
];

function trendFor(seed: DemoVenueSeed): TrendSummaryDto {
  const result = computeViralScore(
    seed.components,
    {
      eligiblePosts: seed.eligiblePosts,
      distinctCreators: seed.distinctCreators,
      momentumCoverage: seed.momentumCoverage,
      lastObservationAgeHours: seed.lastObservationAgeHours,
      cohortObservations: seed.cohortObservations,
    },
    DEMO_TREND_CONFIG,
  );
  const accessible = seed.posts.reduce<bigint | null>((acc, p) => (p.views === null ? acc : (acc ?? 0n) + BigInt(p.views)), null);
  const lastObs = new Date(Date.parse(DEMO_AS_OF) - seed.lastObservationAgeHours * 3_600_000).toISOString();
  return {
    score: result.score,
    status: result.status,
    trending: isTrending(result, seed.distinctCreators, seed.newestPostAgeHours, DEMO_TREND_CONFIG),
    scoreVersion: result.scoreVersion,
    asOf: DEMO_AS_OF,
    windowDays: DEMO_TREND_CONFIG.windowDays,
    eligiblePosts: seed.eligiblePosts,
    distinctCreators: seed.distinctCreators,
    accessibleViews: accessible === null ? null : accessible.toString(),
    metricsCoverage: seed.momentumCoverage,
    baselinePartial: result.baselinePartial,
    baselineScope: result.score === null ? null : 'DEMO: platform×yaş×şehir/kategori (sentetik)',
    components: result.components,
    reasonCodes: result.reasonCodes,
    lastSuccessfulObservationAt: lastObs,
  };
}

function creatorRef(creatorId: string) {
  const c = demoCreators.find((x) => x.id === creatorId)!;
  const decision = decideRender('profile', c.rights, DEMO_AS_OF);
  return {
    id: c.id,
    displayName: c.displayName,
    handle: c.handle,
    platform: 'tiktok' as const,
    verificationKind: 'none' as const,
    avatarUrl: null,
    profileVisible: decision.allowedActions.includes('may_show_creator_profile'),
  };
}

function postFor(seed: DemoVenueSeed, p: DemoVenueSeed['posts'][number]): SourcePostDto {
  const c = demoCreators.find((x) => x.id === p.creatorId)!;
  const decision = decideRender(p.id, c.rights, DEMO_AS_OF);
  const { profileVisible: _pv, ...creator } = creatorRef(p.creatorId);
  return {
    id: p.id,
    platform: 'tiktok',
    creator,
    publishedAt: p.publishedAt,
    observedAt: '2026-09-11T08:30:00Z',
    views: p.views,
    sponsored: p.sponsored,
    stance: p.stance,
    media: {
      mode: decision.renderMode,
      thumbnailUrl: null,
      embedUrl: null,
      // Fixture router: gerçek ağ çağrısı yapılmaz (dataMode=synthetic, §35.1).
      sourceUrl: decision.renderMode === 'unavailable' ? null : `https://fixture.invalid/tiktok/${c.handle}/video/${p.id}`,
      rightsPolicyId: c.rights?.policyId ?? 'deny-by-default',
      expiresAt: decision.expiresAt,
    },
    linkResolution: 'approved',
  };
}

export function toMapItem(seed: DemoVenueSeed): MapPlaceItemDto {
  const trend = trendFor(seed);
  return {
    type: 'place',
    id: seed.id,
    name: seed.name,
    neighborhood: seed.neighborhood,
    cityId: demoCity.id,
    category: seed.category,
    location: { lat: seed.lat, lng: seed.lng, origin: 'synthetic', expiresAt: null },
    trend: { score: trend.score, status: trend.status, trending: trend.trending },
    media: { mode: 'unavailable', thumbnailUrl: null },
    freshness: { lastObservedAt: trend.lastSuccessfulObservationAt },
    familySupported: seed.familySupported,
  };
}

export const demoMapItems: MapPlaceItemDto[] = seeds.map(toMapItem);

export function demoPlaceDetail(id: string): PlaceDetailDto | null {
  const seed = seeds.find((s) => s.id === id);
  if (!seed) return null;
  const trend = trendFor(seed);
  return {
    requestId: `demo-place-${seed.id}`,
    asOf: DEMO_AS_OF,
    dataStatus: DEMO_DATA_STATUS,
    id: seed.id,
    name: seed.name,
    neighborhood: seed.neighborhood,
    city: demoCity,
    category: seed.category,
    location: { lat: seed.lat, lng: seed.lng, origin: 'synthetic', expiresAt: null },
    externalRating: null,
    trend,
    sources: seed.posts.map((p) => postFor(seed, p)),
    summary: {
      items: seed.summary,
      modelVersion: seed.summary.length > 0 ? 'DEMO-fixture (model çalışmadı)' : null,
      generatedAt: seed.summary.length > 0 ? '2026-09-10T13:00:00Z' : null,
    },
    practical: { addressHint: null, familyAttributes: seed.familyAttributes },
    freshness: { lastObservedAt: trend.lastSuccessfulObservationAt },
  };
}

export function demoCreatorDetail(id: string): CreatorDetailDto | null {
  const c = demoCreators.find((x) => x.id === id);
  if (!c) return null;
  const linked = seeds.filter((s) => s.posts.some((p) => p.creatorId === id));
  const posts = linked.flatMap((s) => s.posts.filter((p) => p.creatorId === id).map((p) => postFor(s, p)));
  const decision = decideRender('profile', c.rights, DEMO_AS_OF);
  const profileVisible = decision.allowedActions.includes('may_show_creator_profile');
  return {
    requestId: `demo-creator-${c.id}`,
    asOf: DEMO_AS_OF,
    dataStatus: DEMO_DATA_STATUS,
    id: c.id,
    displayName: c.displayName,
    handle: c.handle,
    platform: 'tiktok',
    profileUrl: `https://fixture.invalid/tiktok/@${c.handle}`,
    verificationKind: 'none',
    claimStatus: 'unclaimed',
    avatarUrl: null,
    bio: profileVisible ? { text: c.bio, source: 'platform_bio_observed', observedAt: '2026-09-11T08:30:00Z' } : null,
    platformFollowers: profileVisible ? { count: '12400', platform: 'tiktok', observedAt: '2026-09-11T08:30:00Z' } : null,
    cities: [{ id: demoCity.id, name: demoCity.name, placeCount: linked.length }],
    categories: c.categories,
    places: linked.map(toMapItem),
    posts,
    styleNotes: [],
    compiledFromPublicPostsNoticeKey: 'creator.compiledNotice',
  };
}

export const demoVenueIds = seeds.map((s) => s.id);
export const demoCreatorIds = demoCreators.map((c) => c.id);
export function demoCountryForVenue(venueId: string): string | null {
  return seeds.some((s) => s.id === venueId) ? demoCity.countryCode : null;
}
