import { describe, expect, it } from 'vitest';
import { MapClusterItemDto, MapPlaceItemDto, MapPlacesResponse } from '@viral-places/contracts';
import { SERVER_CLUSTER_BELOW_ZOOM } from '@viral-places/domain';
import { demoMapItems } from '@viral-places/test-fixtures';
import { toMapItems } from '@/lib/map-items';

const sumCount = (items: ReturnType<typeof toMapItems>) => items.reduce((s, i) => s + (i.type === 'cluster' ? i.count : 1), 0);

describe('toMapItems (§19.3 sunucu kümeleme)', () => {
  it('şehir zoom ve üstünde mekanlar tek tek döner (mobil ekran-uzayı kümelemesi devralır)', () => {
    for (const zoom of [SERVER_CLUSTER_BELOW_ZOOM, 12, 15.5, 22]) {
      const items = toMapItems(demoMapItems, zoom);
      expect(items).toHaveLength(demoMapItems.length);
      expect(items.every((i) => i.type === 'place')).toBe(true);
    }
  });

  it('bölge zoom\'unda DEMO mekanlar kümelenir; hiçbir mekan sessizce düşmez ve küme DEMO kökenini gizlemez', () => {
    const items = toMapItems(demoMapItems, 9);
    const clusters = items.filter((i): i is MapClusterItemDto => i.type === 'cluster');
    expect(clusters.length).toBeGreaterThanOrEqual(1);
    expect(items.length).toBeLessThan(demoMapItems.length);
    expect(sumCount(items)).toBe(demoMapItems.length);
    for (const c of clusters) {
      expect(MapClusterItemDto.parse(c)).toEqual(c);
      expect(c.location.origin).toBe('synthetic');
      expect(c.id.startsWith('cluster:z9:')).toBe(true);
    }
    // Aynı koordinattaki iki Karaköy mekanı (demo-venue-001/008) her zaman aynı kümededir.
    expect(items.some((i) => i.type === 'place' && (i.id === 'demo-venue-001' || i.id === 'demo-venue-008'))).toBe(false);
  });

  it('filtre kümelemeden önce uygulanır: filtreli girdiyle küme sayısı yalnız kalanları sayar', () => {
    const coffee = demoMapItems.filter((i) => i.category === 'coffee');
    const items = toMapItems(coffee, 8);
    expect(sumCount(items)).toBe(coffee.length);
  });

  it('küme kimliği istekten isteğe kararlı ve mekan kimliği sızdırmaz; girdi sırasından bağımsız', () => {
    const a = toMapItems(demoMapItems, 9.4);
    const b = toMapItems([...demoMapItems].reverse(), 9.9);
    expect(a).toEqual(b);
    for (const i of a) if (i.type === 'cluster') expect(i.id).not.toMatch(/demo-venue/);
  });

  it('yanıt zarfı ayrıştırılmış birleşimi (place | cluster) kabul eder', () => {
    const body = MapPlacesResponse.parse({
      requestId: 'r1',
      asOf: '2026-09-17T18:00:00Z',
      dataStatus: 'demo',
      coverage: { status: 'pilot', cityId: 'c', cityName: 'Demo', noteKey: 'coverage.pilot', monitoredCreators: null, lastSuccessfulObservationAt: null },
      items: toMapItems(demoMapItems, 9),
      truncated: false,
      nextCursor: null,
    });
    expect(body.items.some((i) => i.type === 'cluster')).toBe(true);
    for (const i of body.items) if (i.type === 'place') expect(MapPlaceItemDto.parse(i)).toEqual(i);
  });
});
