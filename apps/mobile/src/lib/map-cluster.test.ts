import { describe, expect, it } from 'vitest';
import { boundsOf, clusterByPixels, clusterPlaces, isSameSpot, mercatorPx, shouldShowScoreLabels, spreadPx, type ClusterNode } from './map-cluster';

type P = { id: string; location: { lat: number; lng: number } };
const p = (id: string, lat: number, lng: number): P => ({ id, location: { lat, lng } });
function asCluster<T>(node: ClusterNode<T> | undefined): Extract<ClusterNode<T>, { type: 'cluster' }> {
  if (!node || node.type !== 'cluster') throw new Error('expected cluster');
  return node;
}

// Sentetik DEMO fixture koordinatları (packages/test-fixtures): Cihangir ↔ Beyoğlu barı ≈ 500 m.
const cihangir = p('demo-lokanta-cihangir', 41.0318, 28.9829);
const beyoglu = p('demo-bar-beyoglu', 41.0336, 28.9776);
const karakoy = p('demo-kafe-karakoy', 41.0242, 28.9769);
const moda = p('demo-park-kafe-moda', 40.9835, 29.0258);

describe('mercatorPx', () => {
  it('projects the origin to the world centre and scales with zoom', () => {
    expect(mercatorPx({ lat: 0, lng: 0 }, 0)).toEqual({ x: 128, y: 128 });
    expect(mercatorPx({ lat: 0, lng: 0 }, 3)).toEqual({ x: 1024, y: 1024 });
  });
  it('clamps polar latitudes instead of producing Infinity', () => {
    expect(Number.isFinite(mercatorPx({ lat: 90, lng: 0 }, 5).y)).toBe(true);
  });
});

describe('clusterPlaces', () => {
  it('returns nothing for no items and a single place for one item', () => {
    expect(clusterPlaces([], 12)).toEqual([]);
    expect(clusterPlaces([karakoy], 12)).toEqual([{ type: 'place', item: karakoy }]);
  });

  it('clusters Cihangir and Beyoğlu at city zoom but separates them when zoomed in', () => {
    const city = clusterPlaces([cihangir, beyoglu, moda], 12);
    expect(city.map((n) => n.type)).toEqual(['cluster', 'place']);
    const cluster = asCluster(city[0]);
    expect(cluster.items.map((i) => i.id).sort()).toEqual(['demo-bar-beyoglu', 'demo-lokanta-cihangir']);
    expect(cluster.center.lat).toBeCloseTo((41.0318 + 41.0336) / 2, 6);
    expect(cluster.center.lng).toBeCloseTo((28.9829 + 28.9776) / 2, 6);

    const street = clusterPlaces([cihangir, beyoglu, moda], 16);
    expect(street.every((n) => n.type === 'place')).toBe(true);
    expect(street).toHaveLength(3);
  });

  it('is deterministic regardless of input order', () => {
    const a = clusterPlaces([cihangir, beyoglu, karakoy, moda], 12);
    const b = clusterPlaces([moda, karakoy, beyoglu, cihangir], 12);
    expect(a).toEqual(b);
  });

  it('keeps the cluster id stable while membership is unchanged and changes it otherwise', () => {
    const two = asCluster(clusterPlaces([cihangir, beyoglu], 12)[0]);
    const twoAgain = asCluster(clusterPlaces([beyoglu, cihangir], 12)[0]);
    const three = asCluster(clusterPlaces([cihangir, beyoglu, p('demo-x', 41.0325, 28.98)], 12)[0]);
    expect(two.id).toBe(twoAgain.id);
    expect(two.id).toMatch(/^cluster:2:/);
    expect(three.id).toMatch(/^cluster:3:/);
    expect(three.id).not.toBe(two.id);
  });

  it('keeps identical coordinates clustered even at maximum zoom (same-spot case)', () => {
    const a = p('a', 41.0, 29.0);
    const b = p('b', 41.0, 29.0);
    const nodes = clusterPlaces([a, b], 21);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.type).toBe('cluster');
    expect(isSameSpot([a.location, b.location])).toBe(true);
    expect(isSameSpot([cihangir.location, beyoglu.location])).toBe(false);
  });
});

describe('clusterByPixels', () => {
  const px = (id: string, x: number, y: number) => ({ id, location: { lat: y, lng: x }, x, y });
  const project = (i: { x: number; y: number }) => ({ x: i.x, y: i.y });

  it('absorbs a point that is near the cluster centroid but outside the anchor radius', () => {
    // a–b 40px (küme), c çapaya 70px ama ağırlık merkezine 50px → 60px yarıçapla üçü tek küme.
    const nodes = clusterByPixels([px('a', 0, 0), px('b', 40, 0), px('c', 70, 0)], project, 60);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.type).toBe('cluster');
  });

  it('leaves clearly separated points as individual places', () => {
    const nodes = clusterByPixels([px('a', 0, 0), px('b', 100, 0), px('c', 0, 100)], project, 44);
    expect(nodes.map((n) => n.type)).toEqual(['place', 'place', 'place']);
  });
});

describe('label policy and helpers', () => {
  it('shows short score badges only from city zoom and when the map is not crowded (§7.2)', () => {
    expect(shouldShowScoreLabels({ zoom: 12, placeCount: 7 })).toBe(true);
    expect(shouldShowScoreLabels({ zoom: 11, placeCount: 7 })).toBe(true);
    expect(shouldShowScoreLabels({ zoom: 10, placeCount: 7 })).toBe(false);
    expect(shouldShowScoreLabels({ zoom: 14, placeCount: 13 })).toBe(false);
  });

  it('measures spread and bounds', () => {
    expect(spreadPx([cihangir.location], 12)).toBe(0);
    expect(spreadPx([cihangir.location, beyoglu.location], 16)).toBeGreaterThan(44);
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([cihangir.location, moda.location])).toEqual({ west: 28.9829, south: 40.9835, east: 29.0258, north: 41.0318 });
  });
});
