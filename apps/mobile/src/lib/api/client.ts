import type { CityDto, CreatorDetailDto, MapPlaceItemDto, MapPlacesQuery, MapPlacesResponse, PlaceDetailDto } from '@viral-places/contracts';
import { MapPlacesResponse as MapPlacesResponseSchema, PlaceDetailDto as PlaceDetailSchema, CreatorDetailDto as CreatorDetailSchema } from '@viral-places/contracts';
import { ApiError, HttpApiClient, type ApiClient } from '@viral-places/api-client';
import { bboxContains } from '@viral-places/domain';
import { DEMO_AS_OF, demoCity, demoCreatorDetail, demoMapItems, demoPlaceDetail } from '@viral-places/test-fixtures';
import { appConfig } from '../config';

export { ApiError, type ApiClient };

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let requestCounter = 0;

/**
 * DEMO fixture istemcisi. Ağ çağrısı yapmaz; yanıtları contracts şemasından geçirir
 * (M2'de gerçek API sınırındaki Zod doğrulamasıyla aynı disiplin).
 */
export class FixtureApiClient implements ApiClient {
  readonly mode = 'demo' as const;
  constructor(private readonly latencyMs = 250) {}

  async getCity(): Promise<CityDto> {
    return demoCity;
  }

  async getMapPlaces(query: MapPlacesQuery): Promise<MapPlacesResponse> {
    await delay(this.latencyMs);
    const items = demoMapItems.filter((item) => {
      if (!bboxContains(query.bbox, item.location)) return false;
      if (query.categories.length > 0 && !query.categories.includes(item.category)) return false;
      if (query.trendingOnly && !item.trend.trending) return false;
      if (query.familyOnly && !item.familySupported) return false;
      return true;
    });
    const limited = items.slice(0, query.limit);
    return MapPlacesResponseSchema.parse({
      requestId: `demo-map-${++requestCounter}`,
      asOf: DEMO_AS_OF,
      dataStatus: 'demo',
      coverage: demoCity.coverage,
      items: limited,
      truncated: limited.length < items.length,
      nextCursor: null,
    });
  }

  async getPlace(id: string): Promise<PlaceDetailDto> {
    await delay(this.latencyMs);
    const detail = demoPlaceDetail(id);
    if (!detail) throw new ApiError('PLACE_NOT_FOUND', 'Bu mekan bulunamadı veya görüntülenemiyor.', false, 404);
    return PlaceDetailSchema.parse(detail);
  }

  async getCreator(id: string): Promise<CreatorDetailDto> {
    await delay(this.latencyMs);
    const detail = demoCreatorDetail(id);
    if (!detail) throw new ApiError('CREATOR_NOT_FOUND', 'Bu creator bulunamadı.', false, 404);
    return CreatorDetailSchema.parse(detail);
  }

  async searchPlaces(text: string): Promise<MapPlaceItemDto[]> {
    const q = text.trim().toLocaleLowerCase('tr');
    if (!q) return [];
    return demoMapItems.filter((i) => i.name.toLocaleLowerCase('tr').includes(q) || (i.neighborhood ?? '').toLocaleLowerCase('tr').includes(q));
  }

  async getPlacesByIds(ids: string[]): Promise<MapPlaceItemDto[]> {
    const set = new Set(ids);
    return demoMapItems.filter((i) => set.has(i.id));
  }
}

/**
 * Seçim: EXPO_PUBLIC_API_BASE_URL tanımlıysa canlı /api/v1 istemcisi (yerel Next + yerel Supabase dahil),
 * değilse DEMO fixture. Canlı istemci de DEMO veri döndürebilir; UI etiketi yanıt içindeki dataStatus'tan gelir.
 */
export const apiClient: ApiClient = appConfig.apiBaseUrl
  ? new HttpApiClient({ baseUrl: appConfig.apiBaseUrl, getAccessToken: async () => null })
  : new FixtureApiClient();
