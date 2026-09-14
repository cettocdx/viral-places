/**
 * /api/v1 HTTP istemcisi (§19, §21). Mobil ve admin aynı sözleşmeyi kullanır.
 * - Her yanıt contracts Zod şemasından geçer (sınır doğrulaması).
 * - Hata zarfı {error:{code,message,retryable,requestId}} → ApiError.
 * - Idempotency-Key yalnız POST /imports; GET'lerde retryable hatada tek yeniden deneme.
 * - Token sağlayıcı enjekte edilir; istemci secret bilmez.
 */
import { z } from 'zod';
import {
  ApiErrorDto,
  CityDto,
  CreatorDetailDto,
  MapPlaceItemDto,
  MapPlacesResponse,
  PlaceDetailDto,
  type MapPlacesQuery,
} from '@viral-places/contracts';

export class ApiError extends Error {
  constructor(readonly code: string, message: string, readonly retryable: boolean, readonly status: number, readonly requestId: string | null = null) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Mobil istemci sözleşmesi; FixtureApiClient (demo) ve HttpApiClient (live) bunu uygular. */
export interface ApiClient {
  readonly mode: 'demo' | 'live';
  getCity(): Promise<CityDto>;
  getMapPlaces(query: MapPlacesQuery): Promise<MapPlacesResponse>;
  getPlace(id: string): Promise<PlaceDetailDto>;
  getCreator(id: string): Promise<CreatorDetailDto>;
  searchPlaces(text: string): Promise<MapPlaceItemDto[]>;
  getPlacesByIds(ids: string[]): Promise<MapPlaceItemDto[]>;
}

export interface HttpApiClientOptions {
  baseUrl: string;
  /** Oturum varsa access token; misafirde null. */
  getAccessToken?: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  locale?: 'tr' | 'en';
}

const ImportAccepted = z.object({ importId: z.string(), status: z.string(), normalizedUrl: z.string(), createdAt: z.string(), note: z.string().nullable() });
export type ImportAccepted = z.infer<typeof ImportAccepted>;

export class HttpApiClient implements ApiClient {
  readonly mode = 'live' as const;
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly locale: 'tr' | 'en';
  private readonly getAccessToken: () => Promise<string | null>;
  private cityCache: CityDto | null = null;

  constructor(opts: HttpApiClientOptions) {
    this.base = opts.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.locale = opts.locale ?? 'tr';
    this.getAccessToken = opts.getAccessToken ?? (async () => null);
  }

  private async request<T>(schema: z.ZodType<T>, path: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; auth?: boolean; retry?: boolean } = {}): Promise<T> {
    const attempt = async (): Promise<T> => {
      const headers: Record<string, string> = { accept: 'application/json', 'accept-language': this.locale, ...init.headers };
      if (init.body !== undefined) headers['content-type'] = 'application/json';
      if (init.auth !== false) {
        const token = await this.getAccessToken();
        if (token) headers.authorization = `Bearer ${token}`;
      }
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      let res: Response;
      try {
        res = await this.fetchImpl(`${this.base}${path}`, { method: init.method ?? 'GET', headers, body: init.body === undefined ? null : JSON.stringify(init.body), signal: ctrl.signal });
      } catch (e) {
        throw new ApiError('NETWORK', (e as Error)?.name === 'AbortError' ? 'İstek zaman aşımına uğradı.' : 'Ağ hatası.', true, 0);
      } finally {
        clearTimeout(timer);
      }
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        throw new ApiError('BAD_RESPONSE', 'Sunucu yanıtı çözümlenemedi.', res.status >= 500, res.status, res.headers.get('x-request-id'));
      }
      if (!res.ok) {
        const env = ApiErrorDto.safeParse(json);
        if (env.success) throw new ApiError(env.data.error.code, env.data.error.message, env.data.error.retryable, res.status, env.data.error.requestId);
        throw new ApiError('HTTP_' + res.status, 'Sunucu hatası.', res.status >= 500 || res.status === 429, res.status, res.headers.get('x-request-id'));
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success) throw new ApiError('CONTRACT_MISMATCH', 'Sunucu yanıtı sözleşmeye uymuyor.', false, res.status, res.headers.get('x-request-id'));
      return parsed.data;
    };
    try {
      return await attempt();
    } catch (e) {
      if (init.retry !== false && (init.method ?? 'GET') === 'GET' && e instanceof ApiError && e.retryable) return attempt();
      throw e;
    }
  }

  async getCity(): Promise<CityDto> {
    if (this.cityCache) return this.cityCache;
    // M2: tek şehir; kapsam map/places yanıtından türetilir (ayrı /cities ucu M3).
    const r = await this.getMapPlaces({ bbox: { west: 28.8, south: 40.9, east: 29.2, north: 41.2 }, zoom: 11, categories: [], trendingOnly: false, familyOnly: false, locale: this.locale, limit: 1 });
    this.cityCache = CityDto.parse({ id: r.coverage.cityId, name: r.coverage.cityName, countryCode: 'TR', timezone: 'Europe/Istanbul', center: { lat: 41.02, lng: 28.98 }, coverage: r.coverage });
    return this.cityCache;
  }

  getMapPlaces(q: MapPlacesQuery): Promise<MapPlacesResponse> {
    const p = new URLSearchParams({ west: String(q.bbox.west), south: String(q.bbox.south), east: String(q.bbox.east), north: String(q.bbox.north), zoom: String(q.zoom), limit: String(q.limit), locale: q.locale });
    if (q.categories.length) p.set('categories', q.categories.join(','));
    if (q.trendingOnly) p.set('trendingOnly', 'true');
    if (q.familyOnly) p.set('familyOnly', 'true');
    return this.request(MapPlacesResponse, `/api/v1/map/places?${p.toString()}`, { auth: false });
  }

  getPlace(id: string): Promise<PlaceDetailDto> {
    return this.request(PlaceDetailDto, `/api/v1/places/${encodeURIComponent(id)}`, { auth: false });
  }

  getCreator(id: string): Promise<CreatorDetailDto> {
    return this.request(CreatorDetailDto, `/api/v1/creators/${encodeURIComponent(id)}`, { auth: false });
  }

  /** M2: sunucu tarafı arama ucu yok; şehir bbox'ı içinde isim/mahalle filtresi (istemci). */
  async searchPlaces(text: string): Promise<MapPlaceItemDto[]> {
    const q = text.trim().toLocaleLowerCase('tr');
    if (q.length < 2) return [];
    const r = await this.getMapPlaces({ bbox: { west: 28.8, south: 40.9, east: 29.2, north: 41.2 }, zoom: 11, categories: [], trendingOnly: false, familyOnly: false, locale: this.locale, limit: 200 });
    return r.items.filter((i): i is MapPlaceItemDto => i.type === 'place').filter((i) => i.name.toLocaleLowerCase('tr').includes(q) || (i.neighborhood ?? '').toLocaleLowerCase('tr').includes(q));
  }

  async getPlacesByIds(ids: string[]): Promise<MapPlaceItemDto[]> {
    const set = new Set(ids);
    if (set.size === 0) return [];
    const r = await this.getMapPlaces({ bbox: { west: 28.8, south: 40.9, east: 29.2, north: 41.2 }, zoom: 11, categories: [], trendingOnly: false, familyOnly: false, locale: this.locale, limit: 200 });
    return r.items.filter((i): i is MapPlaceItemDto => i.type === 'place' && set.has(i.id));
  }

  /** POST /imports — 202; Idempotency-Key çağıran tarafından üretilir (aynı link → aynı anahtar). */
  submitImport(url: string, idempotencyKey: string): Promise<ImportAccepted> {
    return this.request(ImportAccepted, '/api/v1/imports', { method: 'POST', body: { url }, headers: { 'idempotency-key': idempotencyKey }, retry: false });
  }
}
