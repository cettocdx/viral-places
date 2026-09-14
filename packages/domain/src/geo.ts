export interface GeoPoint {
  lat: number;
  lng: number;
}

/** bbox sırası sabit: west,south,east,north (§19.3) */
export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function isValidLat(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}
export function isValidLng(lng: number): boolean {
  return Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

export function bboxContains(b: BBox, p: GeoPoint): boolean {
  const inLat = p.lat >= b.south && p.lat <= b.north;
  if (b.west <= b.east) return inLat && p.lng >= b.west && p.lng <= b.east;
  // antimeridyen: iki aralığa böl
  return inLat && (p.lng >= b.west || p.lng <= b.east);
}

/** Kuş uçuşu mesafe (metre). Yürüyüş mesafesi değildir; UI böyle etiketler (§21.2). */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Sahte hassasiyet vermeden yuvarlanmış kuş uçuşu etiketi için ham değer. */
export function roundDistanceMeters(m: number): { value: number; unit: 'm' | 'km' } {
  if (m < 950) return { value: Math.round(m / 50) * 50, unit: 'm' };
  return { value: Math.round((m / 1000) * 10) / 10, unit: 'km' };
}
