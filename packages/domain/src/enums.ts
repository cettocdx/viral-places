export const CATEGORIES = ['food', 'coffee', 'nightlife', 'family', 'culture', 'sightseeing', 'shopping'] as const;
export type Category = (typeof CATEGORIES)[number];

export const PLATFORMS = ['tiktok', 'instagram'] as const;
export type Platform = (typeof PLATFORMS)[number];

/** §14.2 gösterim modları */
export const RENDER_MODES = ['official_embed', 'licensed_native', 'link_only', 'unavailable'] as const;
export type RenderMode = (typeof RENDER_MODES)[number];

/** §17.6 skor durumu */
export const TREND_STATUSES = ['ready', 'insufficient_data', 'stale', 'withheld'] as const;
export type TrendStatus = (typeof TREND_STATUSES)[number];

/** Veri modu: demo fixture, canlı veya bayat. UI bunu daima gösterir (§8, §32). */
export const DATA_STATUSES = ['demo', 'live', 'stale'] as const;
export type DataStatus = (typeof DATA_STATUSES)[number];

export const LOCATION_ORIGINS = ['own_verified', 'creator_supplied', 'google_cache', 'synthetic'] as const;
export type LocationOrigin = (typeof LOCATION_ORIGINS)[number];

export const STANCES = ['recommend', 'neutral', 'avoid', 'unclear'] as const;
export type Stance = (typeof STANCES)[number];

export const SPONSORED_STATUSES = ['declared', 'none_declared', 'unknown'] as const;
export type SponsoredStatus = (typeof SPONSORED_STATUSES)[number];

export const CLAIM_TYPES = ['try', 'visit_time', 'reservation', 'atmosphere', 'family_note', 'uncertainty'] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export const FAMILY_VALUES = ['supported', 'contradicted', 'unknown'] as const;
export type FamilyAttributeValue = (typeof FAMILY_VALUES)[number];

export const VERIFICATION_KINDS = ['none', 'platform_badge_observed', 'app_claimed'] as const;
export type VerificationKind = (typeof VERIFICATION_KINDS)[number];

export const COVERAGE_STATUSES = ['none', 'pilot', 'growing', 'covered'] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export interface CategoryMeta {
  key: Category;
  /** i18n anahtarı; metin çeviri tablosundan gelir. */
  labelKey: `category.${Category}`;
  /** iOS SF Symbol adı. */
  sfSymbol: string;
  /** Android Material icon adı (MaterialIcons seti). */
  materialIcon: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  food: { key: 'food', labelKey: 'category.food', sfSymbol: 'fork.knife', materialIcon: 'restaurant' },
  coffee: { key: 'coffee', labelKey: 'category.coffee', sfSymbol: 'cup.and.saucer.fill', materialIcon: 'local-cafe' },
  nightlife: { key: 'nightlife', labelKey: 'category.nightlife', sfSymbol: 'wineglass.fill', materialIcon: 'local-bar' },
  family: { key: 'family', labelKey: 'category.family', sfSymbol: 'figure.2.and.child.holdinghands', materialIcon: 'family-restroom' },
  culture: { key: 'culture', labelKey: 'category.culture', sfSymbol: 'building.columns.fill', materialIcon: 'museum' },
  sightseeing: { key: 'sightseeing', labelKey: 'category.sightseeing', sfSymbol: 'binoculars.fill', materialIcon: 'landscape' },
  shopping: { key: 'shopping', labelKey: 'category.shopping', sfSymbol: 'bag.fill', materialIcon: 'shopping-bag' },
};
