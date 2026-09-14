/**
 * Public DTO sözleşmeleri (§19). camelCase; tarihler RFC 3339 UTC; büyük sayaçlar decimal string.
 * Public DTO'ya ham sağlayıcı response'u, secret veya private kullanıcı alanı taşınmaz.
 */
import { z } from 'zod';
import {
  CATEGORIES,
  CLAIM_TYPES,
  COVERAGE_STATUSES,
  DATA_STATUSES,
  FAMILY_VALUES,
  LOCATION_ORIGINS,
  PLATFORMS,
  RENDER_MODES,
  SPONSORED_STATUSES,
  STANCES,
  TREND_STATUSES,
  VERIFICATION_KINDS,
} from '@viral-places/domain';

export const IsoDateTime = z.string().datetime({ offset: true });
export const DecimalString = z.string().regex(/^\d+$/, 'decimal string expected');

export const CategorySchema = z.enum(CATEGORIES);
export const PlatformSchema = z.enum(PLATFORMS);
export const RenderModeSchema = z.enum(RENDER_MODES);
export const TrendStatusSchema = z.enum(TREND_STATUSES);
export const DataStatusSchema = z.enum(DATA_STATUSES);
export const LocationOriginSchema = z.enum(LOCATION_ORIGINS);
export const StanceSchema = z.enum(STANCES);
export const SponsoredStatusSchema = z.enum(SPONSORED_STATUSES);
export const ClaimTypeSchema = z.enum(CLAIM_TYPES);
export const FamilyValueSchema = z.enum(FAMILY_VALUES);
export const VerificationKindSchema = z.enum(VERIFICATION_KINDS);
export const CoverageStatusSchema = z.enum(COVERAGE_STATUSES);

export const LocationDto = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  origin: LocationOriginSchema,
  /** Google kaynaklı koordinatta zorunlu; kendi verimizde null olabilir. */
  expiresAt: IsoDateTime.nullable(),
});
export type LocationDto = z.infer<typeof LocationDto>;

export const ResponseMeta = z.object({
  requestId: z.string().min(1),
  asOf: IsoDateTime,
  dataStatus: DataStatusSchema,
});

export const CoverageDto = z.object({
  status: CoverageStatusSchema,
  cityId: z.string(),
  cityName: z.string(),
  /** UI'da "Kapsamımız gelişiyor" gibi metnin anahtarı. */
  noteKey: z.string().nullable(),
  monitoredCreators: z.number().int().nonnegative().nullable(),
  lastSuccessfulObservationAt: IsoDateTime.nullable(),
});
export type CoverageDto = z.infer<typeof CoverageDto>;

export const TrendComponentsDto = z.object({
  momentum: z.number().min(0).max(1).nullable(),
  diversity: z.number().min(0).max(1),
  freshness: z.number().min(0).max(1),
  outperformance: z.number().min(0).max(1).nullable(),
});

export const TrendSummaryDto = z.object({
  score: z.number().int().min(0).max(100).nullable(),
  status: TrendStatusSchema,
  trending: z.boolean(),
  scoreVersion: z.string(),
  asOf: IsoDateTime,
  windowDays: z.number().int().positive(),
  eligiblePosts: z.number().int().nonnegative(),
  distinctCreators: z.number().int().nonnegative(),
  /** Seçili gönderilerin erişilebilir kümülatif sayaç toplamı; benzersiz kişi değildir. */
  accessibleViews: DecimalString.nullable(),
  metricsCoverage: z.number().min(0).max(1).nullable(),
  baselinePartial: z.boolean(),
  baselineScope: z.string().nullable(),
  components: TrendComponentsDto,
  reasonCodes: z.array(z.string()),
  lastSuccessfulObservationAt: IsoDateTime.nullable(),
});
export type TrendSummaryDto = z.infer<typeof TrendSummaryDto>;

export const MediaDto = z.object({
  mode: RenderModeSchema,
  /** Yalnız hak policy'si izinliyse gerçek görsel; aksi halde placeholder. */
  thumbnailUrl: z.string().url().nullable(),
  embedUrl: z.string().url().nullable(),
  sourceUrl: z.string().url().nullable(),
  rightsPolicyId: z.string(),
  /** Kaynak süresi/hakkı bittiğinde UI bunu gösterir. */
  expiresAt: IsoDateTime.nullable(),
});
export type MediaDto = z.infer<typeof MediaDto>;

export const CreatorRefDto = z.object({
  id: z.string(),
  displayName: z.string(),
  handle: z.string(),
  platform: PlatformSchema,
  verificationKind: VerificationKindSchema,
  /** Avatar gösterimi may_show_creator_profile hakkına bağlıdır. */
  avatarUrl: z.string().url().nullable(),
});
export type CreatorRefDto = z.infer<typeof CreatorRefDto>;

export const SourcePostDto = z.object({
  id: z.string(),
  platform: PlatformSchema,
  creator: CreatorRefDto,
  publishedAt: IsoDateTime,
  observedAt: IsoDateTime,
  /** Erişilebilen sayaç; null = veri yok. */
  views: DecimalString.nullable(),
  sponsored: SponsoredStatusSchema,
  stance: StanceSchema,
  media: MediaDto,
  /** Bu mekana ilişkin bağlantının eşleştirme sürümü/durumu. */
  linkResolution: z.enum(['approved', 'review_required']),
});
export type SourcePostDto = z.infer<typeof SourcePostDto>;

export const SummaryItemDto = z.object({
  claimType: ClaimTypeSchema,
  text: z.string().max(240),
  evidenceIds: z.array(z.string()).min(1),
  sourcePostIds: z.array(z.string()).min(1),
  lastVerifiedAt: IsoDateTime,
  expiresAt: IsoDateTime.nullable(),
});
export type SummaryItemDto = z.infer<typeof SummaryItemDto>;

export const FreshnessDto = z.object({
  lastObservedAt: IsoDateTime.nullable(),
});

export const MapPlaceItemDto = z.object({
  type: z.literal('place'),
  id: z.string(),
  name: z.string(),
  neighborhood: z.string().nullable(),
  cityId: z.string(),
  category: CategorySchema,
  location: LocationDto,
  trend: z.object({ score: z.number().int().min(0).max(100).nullable(), status: TrendStatusSchema, trending: z.boolean() }),
  media: z.object({ mode: RenderModeSchema, thumbnailUrl: z.string().url().nullable() }),
  freshness: FreshnessDto,
  familySupported: z.boolean(),
});
export type MapPlaceItemDto = z.infer<typeof MapPlaceItemDto>;

export const MapClusterItemDto = z.object({
  type: z.literal('cluster'),
  id: z.string(),
  location: LocationDto,
  count: z.number().int().positive(),
});
export type MapClusterItemDto = z.infer<typeof MapClusterItemDto>;

export const MapPlacesResponse = ResponseMeta.extend({
  coverage: CoverageDto,
  items: z.array(z.discriminatedUnion('type', [MapPlaceItemDto, MapClusterItemDto])),
  truncated: z.boolean(),
  nextCursor: z.string().nullable(),
});
export type MapPlacesResponse = z.infer<typeof MapPlacesResponse>;

export const CityDto = z.object({
  id: z.string(),
  name: z.string(),
  countryCode: z.string().length(2),
  timezone: z.string(),
  center: z.object({ lat: z.number(), lng: z.number() }),
  coverage: CoverageDto,
});
export type CityDto = z.infer<typeof CityDto>;

export const ExternalRatingDto = z.object({
  provider: z.literal('google'),
  rating: z.number().min(0).max(5),
  count: z.number().int().nonnegative(),
  observedAt: IsoDateTime,
  expiresAt: IsoDateTime,
  attributionRequired: z.literal(true),
});

export const FamilyAttributeDto = z.object({
  key: z.string(),
  value: FamilyValueSchema,
  evidenceIds: z.array(z.string()),
});

export const PlaceDetailDto = ResponseMeta.extend({
  id: z.string(),
  name: z.string(),
  neighborhood: z.string().nullable(),
  city: CityDto,
  category: CategorySchema,
  location: LocationDto,
  /** Bağımsız Google puanı; kendi puanımız değil, atıf zorunlu (§7.3). */
  externalRating: ExternalRatingDto.nullable(),
  trend: TrendSummaryDto,
  sources: z.array(SourcePostDto),
  summary: z.object({
    items: z.array(SummaryItemDto),
    modelVersion: z.string().nullable(),
    generatedAt: IsoDateTime.nullable(),
  }),
  practical: z.object({
    addressHint: z.string().nullable(),
    familyAttributes: z.array(FamilyAttributeDto),
  }),
  freshness: FreshnessDto,
});
export type PlaceDetailDto = z.infer<typeof PlaceDetailDto>;

export const CreatorDetailDto = ResponseMeta.extend({
  id: z.string(),
  displayName: z.string(),
  handle: z.string(),
  platform: PlatformSchema,
  profileUrl: z.string().url(),
  verificationKind: VerificationKindSchema,
  claimStatus: z.enum(['unclaimed', 'pending', 'claimed']),
  avatarUrl: z.string().url().nullable(),
  bio: z.object({ text: z.string(), source: z.literal('platform_bio_observed'), observedAt: IsoDateTime }).nullable(),
  platformFollowers: z.object({ count: DecimalString, platform: PlatformSchema, observedAt: IsoDateTime }).nullable(),
  cities: z.array(z.object({ id: z.string(), name: z.string(), placeCount: z.number().int().nonnegative() })),
  categories: z.array(CategorySchema),
  /** Yalnız onaylı eşleştirmelerden gelen yerler. */
  places: z.array(MapPlaceItemDto),
  posts: z.array(SourcePostDto),
  /** Kaynaklı tarz notları; yeterli örnek yoksa boş. */
  styleNotes: z.array(SummaryItemDto),
  /** "Bu sayfa kamuya açık paylaşımlardan derlenmiştir; creator tarafından yönetilmiyor." */
  compiledFromPublicPostsNoticeKey: z.string(),
});
export type CreatorDetailDto = z.infer<typeof CreatorDetailDto>;

export const ApiErrorDto = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
    requestId: z.string(),
  }),
});
export type ApiErrorDto = z.infer<typeof ApiErrorDto>;

export const MapPlacesQuery = z.object({
  bbox: z.object({ west: z.number(), south: z.number(), east: z.number(), north: z.number() }),
  zoom: z.number().min(0).max(22),
  categories: z.array(CategorySchema).default([]),
  trendingOnly: z.boolean().default(false),
  familyOnly: z.boolean().default(false),
  locale: z.enum(['tr', 'en']).default('tr'),
  limit: z.number().int().min(1).max(200).default(100),
});
export type MapPlacesQuery = z.infer<typeof MapPlacesQuery>;
