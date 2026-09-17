import { describe, expect, it } from 'vitest';
import {
  SERVER_CLUSTER_BELOW_ZOOM,
  clusterOrigin,
  earliestExpiry,
  gridClusterAtZoom,
  shouldClusterOnServer,
  webMercatorPx,
  type Clusterable,
} from './map-clustering';

const place = (id: string, lat: number, lng: number, origin: Clusterable['location']['origin'] = 'own_verified', expiresAt: string | null = null): Clusterable => ({
  id,
  location: { lat, lng, origin, expiresAt },
});

// Sentetik İstanbul noktaları (demo fixture ile aynı ölçek); gerçek işletme iddiası değil.
const taksim = place('v-taksim', 41.0369, 28.985);
const cihangir = place('v-cihangir', 41.0318, 28.9829);
const karakoy = place('v-karakoy', 41.0242, 28.9769);
const karakoy2 = place('v-karakoy-2', 41.0242, 28.9769);
const kadikoy = place('v-kadikoy', 40.9835, 29.0258);
const balat = place('v-balat', 41.0295, 28.9488);

describe('webMercatorPx', () => {
  it('projects the antimeridian/equator origin to the tile corner and clamps polar latitude', () => {
    expect(webMercatorPx({ lat: 0, lng: -180 }, 0)).toEqual({ x: 0, y: 128 });
    const clamped = webMercatorPx({ lat: 89.9, lng: 0 }, 0);
    expect(clamped.y).toBeCloseTo(0, 6); // kutup enlemi MAX_LAT'a kırpılır; sonsuza gitmez
    expect(Number.isFinite(clamped.y)).toBe(true);
  });
});

describe('shouldClusterOnServer', () => {
  it('clusters only below the mobile label threshold', () => {
    expect(shouldClusterOnServer(SERVER_CLUSTER_BELOW_ZOOM - 0.01)).toBe(true);
    expect(shouldClusterOnServer(SERVER_CLUSTER_BELOW_ZOOM)).toBe(false);
    expect(shouldClusterOnServer(15)).toBe(false);
  });
});

describe('gridClusterAtZoom', () => {
  it('is deterministic regardless of input order', () => {
    const a = gridClusterAtZoom([taksim, cihangir, karakoy, kadikoy, balat], 9);
    const b = gridClusterAtZoom([balat, kadikoy, karakoy, cihangir, taksim], 9);
    expect(a).toEqual(b);
  });

  it('merges dense city-center points at region zoom and keeps distant points as places', () => {
    const nodes = gridClusterAtZoom([taksim, cihangir, karakoy, kadikoy, balat], 9);
    const clusters = nodes.filter((n) => n.type === 'cluster');
    const places = nodes.filter((n) => n.type === 'place');
    expect(clusters.length).toBeGreaterThanOrEqual(1);
    const total = clusters.reduce((s, c) => s + c.count, 0) + places.length;
    expect(total).toBe(5); // hiçbir mekan sessizce düşmez
    for (const c of clusters) expect(c.members.length).toBe(c.count);
  });

  it('keeps every point separate once the grid is fine enough', () => {
    const nodes = gridClusterAtZoom([taksim, cihangir, karakoy, kadikoy, balat], 16);
    expect(nodes.every((n) => n.type === 'place')).toBe(true);
  });

  it('same-coordinate places always share a cell, and the cluster id is a stable cell key without venue ids', () => {
    const nodes = gridClusterAtZoom([karakoy, karakoy2], 10.7);
    expect(nodes).toHaveLength(1);
    const c = nodes[0]!;
    expect(c.type).toBe('cluster');
    if (c.type !== 'cluster') return;
    expect(c.count).toBe(2);
    expect(c.id).toMatch(/^cluster:z10:\d+:\d+$/); // tam sayı zoom ile kararlı
    expect(c.id).not.toContain('karakoy');
    expect(c.location.lat).toBeCloseTo(41.0242, 6);
    expect(c.location.lng).toBeCloseTo(28.9769, 6);
  });

  it('centroid is the mean of member coordinates', () => {
    const nodes = gridClusterAtZoom([place('a', 41.0, 28.0), place('b', 41.002, 28.002)], 8);
    const c = nodes[0]!;
    expect(c.type).toBe('cluster');
    if (c.type !== 'cluster') return;
    expect(c.location.lat).toBeCloseTo(41.001, 9);
    expect(c.location.lng).toBeCloseTo(28.001, 9);
  });

  it('returns an empty list for no input', () => {
    expect(gridClusterAtZoom([], 5)).toEqual([]);
  });
});

describe('cluster provenance', () => {
  it('least-trusted origin wins; synthetic (DEMO) is never hidden inside a cluster', () => {
    expect(clusterOrigin(['own_verified', 'own_verified'])).toBe('own_verified');
    expect(clusterOrigin(['own_verified', 'creator_supplied'])).toBe('creator_supplied');
    expect(clusterOrigin(['own_verified', 'google_cache'])).toBe('google_cache');
    expect(clusterOrigin(['google_cache', 'synthetic'])).toBe('synthetic');
    expect(clusterOrigin([])).toBe('own_verified');
  });

  it('cluster expiry is the earliest member expiry; null when no member expires', () => {
    expect(earliestExpiry([null, null])).toBeNull();
    expect(earliestExpiry(['2026-10-01T00:00:00Z', null, '2026-09-20T00:00:00Z'])).toBe('2026-09-20T00:00:00Z');
    const nodes = gridClusterAtZoom(
      [place('a', 41.0, 28.0, 'google_cache', '2026-10-01T00:00:00.000Z'), place('b', 41.0001, 28.0001, 'own_verified', null)],
      8,
    );
    const c = nodes[0]!;
    expect(c.type).toBe('cluster');
    if (c.type !== 'cluster') return;
    expect(c.location.origin).toBe('google_cache');
    expect(c.location.expiresAt).toBe('2026-10-01T00:00:00.000Z');
  });
});
