/**
 * Google Places API (New) Text Search — sınırlı aday isteği (§16.1 madde 4, §16.4).
 * POST https://places.googleapis.com/v1/places:searchText ; X-Goog-Api-Key + X-Goog-FieldMask zorunlu.
 * Field mask en dar tutulur (id, displayName, formattedAddress, location, types, businessStatus, addressComponents).
 * place_id kalıcı; diğer alanlar (lat/lng dahil) en fazla 30 gün geçici cache (expires_at zorunlu). Google verisi kendi venue verimize kopyalanmaz.
 */
import { z } from 'zod';
import type { VenueCandidate } from '../matcher';

export interface GooglePlacesConfig {
  apiKey: string;
  baseUrl?: string; // https://places.googleapis.com
  fetchImpl?: (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ status: number; ok: boolean; json(): Promise<unknown>; text(): Promise<string> }>;
  now?: () => string;
  /** Google Maps Platform fiyat listesi (USD / 1000 istek) — birim belirsizse null ve çağrı bütçe kapısında reddedilir. */
  usdPer1kRequests: number | null;
  /** Cache TTL (gün); Google şartlarındaki 30 günü aşamaz. */
  cacheTtlDays?: number;
}

export const PLACES_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.businessStatus,places.addressComponents';

const PlaceRow = z.object({
  id: z.string(),
  displayName: z.object({ text: z.string(), languageCode: z.string().optional() }).optional(),
  formattedAddress: z.string().optional(),
  location: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  types: z.array(z.string()).optional(),
  businessStatus: z.string().optional(),
  addressComponents: z.array(z.object({ longText: z.string().optional(), shortText: z.string().optional(), types: z.array(z.string()).optional() })).optional(),
});
export type PlaceRow = z.infer<typeof PlaceRow>;

export interface PlacesCacheEntry {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;
  types: string[];
  businessStatus: string | null;
  city: string | null;
  neighborhood: string | null;
  fetchedAt: string;
  /** §16.4: koordinat dahil geçici alanların silinme/yenilenme tarihi. */
  expiresAt: string;
  queryText: string;
}

export type PlacesSearchResult = { ok: true; entries: PlacesCacheEntry[]; requestCostUsd: number | null } | { ok: false; code: 'places_auth' | 'places_rate_limited' | 'places_error' | 'places_budget_unknown'; status: number | null };

const TYPE_TO_CATEGORY: Array<[RegExp, string]> = [
  [/coffee|cafe|tea_house|bakery/, 'coffee'],
  [/restaurant|meal|food|pizza|burger|kebab|steak|seafood|sushi|brunch|breakfast/, 'food'],
  [/bar|night_club|pub|wine_bar|karaoke/, 'nightlife'],
  [/museum|art_gallery|cultural|historical|performing_arts|library|monument/, 'culture'],
  [/tourist_attraction|park|beach|viewpoint|landmark|garden|zoo|aquarium/, 'sightseeing'],
  [/amusement|playground|water_park|family|childrens/, 'family'],
  [/store|shopping|market|mall|boutique/, 'shopping'],
];

export function categoryFromTypes(types: string[]): string {
  for (const t of types) for (const [re, cat] of TYPE_TO_CATEGORY) if (re.test(t)) return cat;
  return 'food';
}

function component(row: PlaceRow, wanted: string[]): string | null {
  for (const c of row.addressComponents ?? []) if ((c.types ?? []).some((t) => wanted.includes(t))) return c.longText ?? c.shortText ?? null;
  return null;
}

export function toCacheEntry(row: PlaceRow, queryText: string, nowIso: string, ttlDays: number): PlacesCacheEntry {
  return {
    placeId: row.id,
    name: row.displayName?.text ?? '',
    formattedAddress: row.formattedAddress ?? null,
    lat: row.location?.latitude ?? null,
    lng: row.location?.longitude ?? null,
    types: row.types ?? [],
    businessStatus: row.businessStatus ?? null,
    city: component(row, ['locality', 'administrative_area_level_1', 'postal_town']),
    neighborhood: component(row, ['sublocality', 'sublocality_level_1', 'neighborhood', 'administrative_area_level_2']),
    fetchedAt: nowIso,
    expiresAt: new Date(Date.parse(nowIso) + Math.min(ttlDays, 30) * 86_400_000).toISOString(),
    queryText,
  };
}

/** Cache girdisi → matcher adayı. venueId olarak "google:<place_id>" kullanılır; eşleşme onayında ayrı venue_id üretilir (§16.1 madde 8). */
export function candidateFromCache(e: PlacesCacheEntry): VenueCandidate {
  return {
    venueId: `google:${e.placeId}`,
    name: e.name,
    aliases: [],
    city: e.city ?? '',
    neighborhood: e.neighborhood,
    category: categoryFromTypes(e.types),
    status: e.businessStatus === 'CLOSED_PERMANENTLY' ? 'permanently_closed' : e.businessStatus === 'OPERATIONAL' ? 'open' : 'unknown',
  };
}

export class GooglePlacesClient {
  private readonly base: string;
  private readonly fetchImpl: NonNullable<GooglePlacesConfig['fetchImpl']>;
  constructor(private readonly cfg: GooglePlacesConfig) {
    this.base = (cfg.baseUrl ?? 'https://places.googleapis.com').replace(/\/$/, '');
    this.fetchImpl = cfg.fetchImpl ?? (globalThis.fetch as unknown as NonNullable<GooglePlacesConfig['fetchImpl']>);
  }

  /** Sınırlı aday araması: metin = "<isim> <mahalle> <şehir>"; en fazla 5 sonuç. Coğrafi ipucu yoksa çağrı yapılmaz (isim tek başına yetmez, §16.2). */
  async searchText(input: { name: string; cityHint: string | null; areaHint: string | null; languageCode: 'tr' | 'en'; regionCode?: string; maxResults?: number; locationBias?: { lat: number; lng: number; radiusMeters: number } | null }): Promise<PlacesSearchResult> {
    if (this.cfg.usdPer1kRequests === null) return { ok: false, code: 'places_budget_unknown', status: null };
    if (!input.cityHint && !input.areaHint && !input.locationBias) return { ok: true, entries: [], requestCostUsd: 0 };
    const textQuery = [input.name, input.areaHint, input.cityHint].filter(Boolean).join(' ');
    const body: Record<string, unknown> = { textQuery, languageCode: input.languageCode, pageSize: Math.min(input.maxResults ?? 5, 5) };
    if (input.regionCode) body.regionCode = input.regionCode;
    if (input.locationBias) body.locationBias = { circle: { center: { latitude: input.locationBias.lat, longitude: input.locationBias.lng }, radius: input.locationBias.radiusMeters } };
    let res: Awaited<ReturnType<NonNullable<GooglePlacesConfig['fetchImpl']>>>;
    try {
      res = await this.fetchImpl(`${this.base}/v1/places:searchText`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': this.cfg.apiKey, 'X-Goog-FieldMask': PLACES_FIELD_MASK }, body: JSON.stringify(body) });
    } catch {
      return { ok: false, code: 'places_error', status: null };
    }
    if (res.status === 401 || res.status === 403) return { ok: false, code: 'places_auth', status: res.status };
    if (res.status === 429) return { ok: false, code: 'places_rate_limited', status: 429 };
    if (!res.ok) return { ok: false, code: 'places_error', status: res.status };
    const json = (await res.json()) as { places?: unknown[] };
    const nowIso = (this.cfg.now ?? (() => new Date().toISOString()))();
    const entries: PlacesCacheEntry[] = [];
    for (const raw of json.places ?? []) {
      const p = PlaceRow.safeParse(raw);
      if (p.success) entries.push(toCacheEntry(p.data, textQuery, nowIso, this.cfg.cacheTtlDays ?? 30));
    }
    return { ok: true, entries, requestCostUsd: this.cfg.usdPer1kRequests / 1000 };
  }
}

/** Süresi dolmuş cache girdileri kullanılmaz; koordinat expires_at sonrası gizlenir/yenilenir (§16.4). */
export function isCacheEntryValid(e: PlacesCacheEntry, nowIso: string): boolean {
  return Date.parse(e.expiresAt) > Date.parse(nowIso);
}
