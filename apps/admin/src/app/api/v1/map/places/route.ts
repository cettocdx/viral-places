import { MapPlacesQuery, MapPlacesResponse } from '@viral-places/contracts';
import { ApiError, ok, parseOr422, route } from '@/lib/http';
import { anonClient } from '@/lib/supabase';
import { coverageOf, dataStatusOf, type Row } from '@/lib/mappers';
import { loadCity, mapItemsForIds } from '@/lib/public-reads';

// Kaba sınır (§19.3): yalnız dünya/kıta ölçeği reddedilir. 2° idi; iPhone'da İstanbul'a uzaktan bakınca aşılıyor,
// istek reddediliyor ve harita boş kalıyordu (02.10.2026). Sonuç zaten p_limit (≤200) ile sınırlı.
const MAX_BBOX_DEG = 40;

export const GET = route(async (req, _ctx, requestId) => {
  const u = new URL(req.url);
  const num = (k: string) => (u.searchParams.get(k) === null ? undefined : Number(u.searchParams.get(k)));
  const q = parseOr422(MapPlacesQuery, {
    bbox: { west: num('west'), south: num('south'), east: num('east'), north: num('north') },
    zoom: num('zoom') ?? 12,
    categories: u.searchParams.get('categories')?.split(',').filter(Boolean) ?? [],
    trendingOnly: u.searchParams.get('trendingOnly') === 'true',
    familyOnly: u.searchParams.get('familyOnly') === 'true',
    locale: u.searchParams.get('locale') ?? 'tr',
    limit: num('limit') ?? 100,
  });
  if (q.bbox.east <= q.bbox.west || q.bbox.north <= q.bbox.south) throw new ApiError(422, 'VALIDATION_FAILED', 'bbox is empty');
  if (q.bbox.east - q.bbox.west > MAX_BBOX_DEG || q.bbox.north - q.bbox.south > MAX_BBOX_DEG) throw new ApiError(422, 'BBOX_TOO_LARGE', 'Zoom in to load places');

  const db = anonClient();
  const { data, error } = await db.rpc('map_places', { p_west: q.bbox.west, p_south: q.bbox.south, p_east: q.bbox.east, p_north: q.bbox.north, p_limit: q.limit + 1 });
  if (error) throw error;
  const rows: Row[] = data ?? [];
  const truncated = rows.length > q.limit;
  const page = rows.slice(0, q.limit);
  let items = await mapItemsForIds(db, page.map((r) => r.id));
  if (q.categories.length) items = items.filter((i) => q.categories.includes(i.category));
  if (q.trendingOnly) items = items.filter((i) => i.trend.trending);
  if (q.familyOnly) items = items.filter((i) => i.familySupported);

  // Kapsam: bbox merkezinin düştüğü şehir (yarıçap içinde en yakın); yoksa sonuçtaki ilk mekanın şehri, o da yoksa ilk şehir.
  const centerLat = (q.bbox.north + q.bbox.south) / 2;
  const centerLng = (q.bbox.east + q.bbox.west) / 2;
  const { data: pointCity } = await db.rpc('city_for_point', { p_lat: centerLat, p_lng: centerLng });
  const cityId = (pointCity as string | null) ?? page[0]?.city_id ?? (await db.from('cities').select('id').order('created_at').limit(1).maybeSingle()).data?.id;
  if (!cityId) throw new ApiError(404, 'NO_COVERAGE', 'No city coverage');
  const city = await loadCity(db, cityId);
  const lastObs = items.reduce<string | null>((acc, i) => (i.freshness.lastObservedAt && (!acc || i.freshness.lastObservedAt > acc) ? i.freshness.lastObservedAt : acc), null);
  const body = MapPlacesResponse.parse({
    requestId,
    asOf: new Date().toISOString(),
    dataStatus: dataStatusOf([city, ...page]),
    coverage: coverageOf(city, null, lastObs),
    items,
    truncated,
    nextCursor: null,
  });
  return ok(body, requestId, { cache: 'public' });
});
