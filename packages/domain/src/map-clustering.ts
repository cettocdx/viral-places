/**
 * Sunucu tarafı harita kümeleme (§19.3): düşük zoom'da "yüz binlerce pin göndermek yerine cluster döndür".
 * Saf ve deterministik: aynı girdi + zoom → aynı hücre kimlikleri ve aynı sıra. DB veya HTTP bağımlılığı yok;
 * API route'u ve testler aynı çekirdeği kullanır. Mobil ekran-uzayı kümelemesinden (apps/mobile/src/lib/map-cluster.ts)
 * farkı: burada hücre ızgarası kullanılır ki küme kimliği istekten isteğe kararlı kalsın ve sonuç O(n) üretilsin.
 */
import type { LocationOrigin } from './enums';
import type { GeoPoint } from './geo';

/** Bu zoom'un altında sunucu kümeler; mobil kısa skor rozetini de bu zoom'dan itibaren gösterir (tutarlı eşik). */
export const SERVER_CLUSTER_BELOW_ZOOM = 11;
/** Web Mercator piksel uzayında hücre kenarı (tile 256 px). Bir hücredeki ≥2 mekan tek küme pini olur. */
export const SERVER_CLUSTER_CELL_PX = 64;

const TILE = 256;
const MAX_LAT = 85.05112878;

export function webMercatorPx(p: GeoPoint, zoom: number): { x: number; y: number } {
  const scale = TILE * Math.pow(2, zoom);
  const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, p.lat));
  const latRad = (lat * Math.PI) / 180;
  return {
    x: ((p.lng + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale,
  };
}

export interface ClusterableLocation extends GeoPoint {
  origin: LocationOrigin;
  expiresAt: string | null;
}

export interface Clusterable {
  id: string;
  location: ClusterableLocation;
}

export type GridClusterNode<T extends Clusterable> =
  | { type: 'place'; item: T }
  | { type: 'cluster'; id: string; location: ClusterableLocation; count: number; members: T[] };

/** Güven sırası: en az güvenilen kaynak kümenin kaynağı olur; DEMO/synthetic üye varsa küme de synthetic'tir. */
const ORIGIN_PRECEDENCE: readonly LocationOrigin[] = ['synthetic', 'google_cache', 'creator_supplied', 'own_verified'];

export function clusterOrigin(origins: readonly LocationOrigin[]): LocationOrigin {
  for (const o of ORIGIN_PRECEDENCE) if (origins.includes(o)) return o;
  return 'own_verified';
}

/** Üyelerden birinin konumu sona erince küme de bayatlar: en erken bitiş. */
export function earliestExpiry(values: readonly (string | null)[]): string | null {
  let out: string | null = null;
  for (const v of values) if (v !== null && (out === null || v < out)) out = v;
  return out;
}

export function shouldClusterOnServer(zoom: number): boolean {
  return zoom < SERVER_CLUSTER_BELOW_ZOOM;
}

/**
 * Izgara kümeleme. Hücre indeksi tam sayı zoom'a göre hesaplanır; böylece küme kimliği
 * (`cluster:z{zoom}:{cx}:{cy}`) aynı görünüm için kararlıdır ve mekan kimliklerini sızdırmaz.
 * Tek üyeli hücre mekan olarak kalır. Çıktı id'ye göre sıralıdır.
 */
export function gridClusterAtZoom<T extends Clusterable>(items: readonly T[], zoom: number, cellPx: number = SERVER_CLUSTER_CELL_PX): GridClusterNode<T>[] {
  const z = Math.max(0, Math.floor(zoom));
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const cells = new Map<string, T[]>();
  for (const item of sorted) {
    const px = webMercatorPx(item.location, z);
    const key = `cluster:z${z}:${Math.floor(px.x / cellPx)}:${Math.floor(px.y / cellPx)}`;
    const bucket = cells.get(key);
    if (bucket) bucket.push(item);
    else cells.set(key, [item]);
  }
  const out: GridClusterNode<T>[] = [];
  for (const [id, members] of cells) {
    if (members.length === 1) {
      out.push({ type: 'place', item: members[0]! });
      continue;
    }
    const lat = members.reduce((s, m) => s + m.location.lat, 0) / members.length;
    const lng = members.reduce((s, m) => s + m.location.lng, 0) / members.length;
    out.push({
      type: 'cluster',
      id,
      location: { lat, lng, origin: clusterOrigin(members.map((m) => m.location.origin)), expiresAt: earliestExpiry(members.map((m) => m.location.expiresAt)) },
      count: members.length,
      members,
    });
  }
  return out.sort((a, b) => {
    const ia = a.type === 'place' ? a.item.id : a.id;
    const ib = b.type === 'place' ? b.item.id : b.id;
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  });
}
