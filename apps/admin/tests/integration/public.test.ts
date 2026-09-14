import { describe, expect, it } from 'vitest';
import { MapPlacesResponse, PlaceDetailDto, CreatorDetailDto, ApiErrorDto } from '@viral-places/contracts';
import { GET as mapGet } from '@/app/api/v1/map/places/route';
import { GET as placeGet } from '@/app/api/v1/places/[id]/route';
import { GET as creatorGet } from '@/app/api/v1/creators/[id]/route';
import { GET as health } from '@/app/api/v1/health/route';
import { CREATOR_A, VENUE_PUBLISHED, VENUE_UNPUBLISHED, call } from './helpers';

describe('public /api/v1 (anon, RLS)', () => {
  it('health', async () => {
    const r = await call(health, { path: '/api/v1/health' });
    expect(r.status).toBe(200);
    expect(r.json.dataMode).toBe('demo');
  });

  it('map/places: İstanbul bbox → 7 yayımlanmış DEMO mekan, sözleşmeye uygun', async () => {
    const r = await call(mapGet, { path: '/api/v1/map/places?west=28.8&south=40.9&east=29.2&north=41.2&zoom=12' });
    expect(r.status).toBe(200);
    const body = MapPlacesResponse.parse(r.json);
    expect(body.dataStatus).toBe('demo');
    expect(body.items.filter((i) => i.type === 'place').length).toBe(7);
    expect(body.items.some((i) => i.id === VENUE_UNPUBLISHED)).toBe(false);
    expect(r.headers.get('cache-control')).toContain('s-maxage');
    const trending = body.items.filter((i) => i.type === 'place' && i.trend.trending);
    expect(trending.map((i) => i.id)).toEqual([VENUE_PUBLISHED]);
  });

  it('map/places: filtreler ve bbox doğrulaması', async () => {
    const t = await call(mapGet, { path: '/api/v1/map/places?west=28.8&south=40.9&east=29.2&north=41.2&zoom=12&trendingOnly=true' });
    expect(t.json.items.length).toBe(1);
    const c = await call(mapGet, { path: '/api/v1/map/places?west=28.8&south=40.9&east=29.2&north=41.2&zoom=12&categories=coffee' });
    expect(c.json.items.every((i: any) => i.category === 'coffee')).toBe(true);
    const bad = await call(mapGet, { path: '/api/v1/map/places?west=10&south=10&east=50&north=50&zoom=3' });
    expect(bad.status).toBe(422);
    expect(ApiErrorDto.parse(bad.json).error.code).toBe('BBOX_TOO_LARGE');
    const missing = await call(mapGet, { path: '/api/v1/map/places?west=x' });
    expect(missing.status).toBe(422);
  });

  it('places/{id}: detay + 3 kaynak; hak yoksa link/thumbnail yok', async () => {
    const r = await call(placeGet, { path: `/api/v1/places/${VENUE_PUBLISHED}`, params: { id: VENUE_PUBLISHED } });
    expect(r.status).toBe(200);
    const d = PlaceDetailDto.parse(r.json);
    expect(d.trend.score).toBe(82);
    expect(d.trend.trending).toBe(true);
    expect(d.sources.length).toBe(3);
    const unavailable = d.sources.find((s) => s.media.mode === 'unavailable')!;
    expect(unavailable.media.sourceUrl).toBeNull();
    expect(d.sources[0]!.media.mode).toBe('link_only');
    expect(d.sources[0]!.views).toBe('184000');
    expect(d.summary.items.length).toBe(2);
    expect(d.externalRating).toBeNull();
  });

  it('places/{id}: yayımlanmamış → 404, geçersiz id → 422', async () => {
    const r = await call(placeGet, { path: `/api/v1/places/${VENUE_UNPUBLISHED}`, params: { id: VENUE_UNPUBLISHED } });
    expect(r.status).toBe(404);
    expect(ApiErrorDto.parse(r.json).error.requestId).toBeTruthy();
    const bad = await call(placeGet, { path: '/api/v1/places/nope', params: { id: 'nope' } });
    expect(bad.status).toBe(422);
  });

  it('creators/{id}: yalnız onaylı projeksiyondan mekanlar', async () => {
    const r = await call(creatorGet, { path: `/api/v1/creators/${CREATOR_A}`, params: { id: CREATOR_A } });
    expect(r.status).toBe(200);
    const d = CreatorDetailDto.parse(r.json);
    expect(d.places.map((p) => p.id)).toContain(VENUE_PUBLISHED);
    expect(d.avatarUrl).toBeNull();
    expect(d.compiledFromPublicPostsNoticeKey).toBe('creator.compiledFromPublicPosts');
  });

  it('x-request-id başlığı yansıtılır', async () => {
    const r = await call(health, { path: '/api/v1/health', headers: { 'x-request-id': 'req-abc' } });
    expect(r.headers.get('x-request-id')).toBe('req-abc');
  });
});
