/** Değişmez kimlikler string'dir (UUID veya platform ID). Sayıya çevrilmez. */
export type VenueId = string & { readonly __brand: 'VenueId' };
export type CreatorId = string & { readonly __brand: 'CreatorId' };
export type SourcePostId = string & { readonly __brand: 'SourcePostId' };
export type CollectionId = string & { readonly __brand: 'CollectionId' };
export type PlanId = string & { readonly __brand: 'PlanId' };
export type CityId = string & { readonly __brand: 'CityId' };

export const asVenueId = (s: string) => s as VenueId;
export const asCreatorId = (s: string) => s as CreatorId;
export const asSourcePostId = (s: string) => s as SourcePostId;
export const asCollectionId = (s: string) => s as CollectionId;
export const asPlanId = (s: string) => s as PlanId;
export const asCityId = (s: string) => s as CityId;

/** Kimlik üretimi platforma bağlıdır (expo-crypto / node crypto); domain enjekte edilmiş fonksiyon kullanır. */
export type IdGenerator = () => string;
