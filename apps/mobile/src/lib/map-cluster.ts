/**
 * Harita pin kümeleme (§7.2): "yoğun alanda küme göster; aynı koordinattaki farklı mekanlarda seçim listesi".
 * Saf modül: React Native veya harita SDK'sına bağımlı değildir; Google yüzeyi Web Mercator izdüşümüyle,
 * DEMO yüzeyi kendi izdüşümüyle aynı çekirdeği kullanır. Sonuç girdi sırasından bağımsız (deterministik).
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

export type ClusterNode<T> =
  | { type: 'place'; item: T }
  | { type: 'cluster'; id: string; center: GeoPoint; items: T[] };

/** Google/OSM tile boyutu; zoom z'de dünya genişliği TILE·2^z piksel. */
const TILE = 256;
const MAX_LAT = 85.05112878;

/** Ekranda iki pin merkezinin çakışmadan durabileceği en küçük mesafe (pin 36 + kenar). */
export const CLUSTER_RADIUS_PX = 44;
/** Kısa skor rozeti bu zoom'dan itibaren ve pin sayısı bu sınırı aşmadığında gösterilir. */
export const LABEL_MIN_ZOOM = 11;
export const LABEL_MAX_PINS = 12;
/** Bu zoom'da hâlâ ayrışmayan mekanlar "aynı nokta" sayılır → seçim listesi. */
export const SAME_SPOT_ZOOM = 18;

export function mercatorPx(p: GeoPoint, zoom: number): PixelPoint {
  const scale = TILE * Math.pow(2, zoom);
  const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, p.lat));
  const latRad = (lat * Math.PI) / 180;
  const x = ((p.lng + 180) / 360) * scale;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  return { x, y };
}

function distance(a: PixelPoint, b: PixelPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Kısa, kararlı küme kimliği: üyeler aynı kaldıkça aynı id (Marker key'i için). */
function clusterId(memberIds: string[]): string {
  let h = 5381;
  const s = memberIds.join('|');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `cluster:${memberIds.length}:${(h >>> 0).toString(36)}`;
}

function centroid(points: GeoPoint[]): GeoPoint {
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / points.length, lng: lng / points.length };
}

/**
 * Piksel uzayında açgözlü kümeleme. Öğeler id'ye göre sıralanır; her atanmamış öğe bir çapa olur,
 * yarıçap içindeki komşuları alır, sonra kümenin ağırlık merkezine yakın kalanları da tek geçişte katar.
 * O(n²); harita sorgusu en çok 200 öğe döndürür (§19.3 limit), yeterlidir.
 */
export function clusterByPixels<T extends { id: string; location: GeoPoint }>(
  items: readonly T[],
  project: (item: T) => PixelPoint,
  radiusPx: number = CLUSTER_RADIUS_PX,
): ClusterNode<T>[] {
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const px = sorted.map(project);
  const assigned = new Array<boolean>(sorted.length).fill(false);
  const out: ClusterNode<T>[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (assigned[i]) continue;
    assigned[i] = true;
    const members: number[] = [i];
    for (let j = i + 1; j < sorted.length; j++) {
      if (!assigned[j] && distance(px[i]!, px[j]!) <= radiusPx) {
        assigned[j] = true;
        members.push(j);
      }
    }
    if (members.length > 1) {
      // Ağırlık merkezi geçişi: çapaya uzak ama kümenin gövdesine yakın kalan pin, kümenin üstüne çizilmesin.
      const c = { x: members.reduce((s, m) => s + px[m]!.x, 0) / members.length, y: members.reduce((s, m) => s + px[m]!.y, 0) / members.length };
      for (let j = i + 1; j < sorted.length; j++) {
        if (!assigned[j] && distance(c, px[j]!) <= radiusPx) {
          assigned[j] = true;
          members.push(j);
        }
      }
    }
    if (members.length === 1) {
      out.push({ type: 'place', item: sorted[i]! });
    } else {
      const memberItems = members.map((m) => sorted[m]!);
      out.push({ type: 'cluster', id: clusterId(memberItems.map((m) => m.id)), center: centroid(memberItems.map((m) => m.location)), items: memberItems });
    }
  }
  return out;
}

/** Google yüzeyi: verilen zoom'daki Web Mercator izdüşümüyle kümele. */
export function clusterPlaces<T extends { id: string; location: GeoPoint }>(items: readonly T[], zoom: number, radiusPx: number = CLUSTER_RADIUS_PX): ClusterNode<T>[] {
  return clusterByPixels(items, (i) => mercatorPx(i.location, zoom), radiusPx);
}

/** Üyelerin verilen zoom'da ekranda ne kadar yayıldığı (en uzak çiftin piksel mesafesi). */
export function spreadPx(points: readonly GeoPoint[], zoom: number): number {
  const px = points.map((p) => mercatorPx(p, zoom));
  let max = 0;
  for (let i = 0; i < px.length; i++) for (let j = i + 1; j < px.length; j++) max = Math.max(max, distance(px[i]!, px[j]!));
  return max;
}

/** Yakınlaşınca da ayrışmayacak mekanlar: aynı bina/kapı. Yakınlaştırmak yerine seçim listesi açılır (§7.2). */
export function isSameSpot(points: readonly GeoPoint[], zoom: number = SAME_SPOT_ZOOM, radiusPx: number = CLUSTER_RADIUS_PX): boolean {
  return spreadPx(points, zoom) <= radiusPx;
}

/** Kısa skor rozeti politikası: her pine uzun etiket çizip haritayı kapatma (§7.2). */
export function shouldShowScoreLabels(input: { zoom: number; placeCount: number }): boolean {
  return input.zoom >= LABEL_MIN_ZOOM && input.placeCount <= LABEL_MAX_PINS;
}

export function boundsOf(points: readonly GeoPoint[]): { west: number; south: number; east: number; north: number } | null {
  if (points.length === 0) return null;
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const p of points) {
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
  }
  return { west, south, east, north };
}
