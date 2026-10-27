/**
 * İçerik kalite kapısı (ürün sahibi, 27.10.2026): "yalnız gerçekten mekan önerdiği videolar, evde yemek değil;
 * çok kaliteli olacak; aynı videodan birden çok mekan olmayacak". Saf fonksiyonlar; çıkarımdan ve indirmeden önce/sonra
 * çağrılır. Sınırlar ürün kararıdır, değiştirilecekse burada ve testte birlikte değişir.
 */

/** TikTok'un en yüksek yükleme kalitesi 1080×1920; 720p ve altı "kalitesiz" sayılır. */
export const MIN_SHORT_SIDE_PX = 1080;
export const MIN_DURATION_S = 6;
export const MAX_DURATION_S = 120;
/** "En iyi 10" listeleri: bir video en fazla bu kadar mekana kanıt olur; fazlası liste sayılır ve elenir. */
export const MAX_VENUES_PER_VIDEO = 2;

export type QualityRejection = 'low_resolution' | 'not_vertical' | 'too_short' | 'too_long' | 'unknown_format';

export interface VideoFormat { width?: number | null; height?: number | null; durationS?: number | null }

/** Videonun kendisi yeterince kaliteli mi (çözünürlük, dikey, süre). Bilinmeyen boyut geçmez. */
export function videoQuality(v: VideoFormat): { ok: true } | { ok: false; reason: QualityRejection } {
  const w = v.width ?? 0;
  const h = v.height ?? 0;
  if (!w || !h) return { ok: false, reason: 'unknown_format' };
  if (h <= w) return { ok: false, reason: 'not_vertical' };
  if (Math.min(w, h) < MIN_SHORT_SIDE_PX) return { ok: false, reason: 'low_resolution' };
  if (v.durationS != null && v.durationS < MIN_DURATION_S) return { ok: false, reason: 'too_short' };
  if (v.durationS != null && v.durationS > MAX_DURATION_S) return { ok: false, reason: 'too_long' };
  return { ok: true };
}

/** Bir videodan çıkan mekan sayısı: liste videoları (3+) hiçbir mekana kanıt olmaz. */
export function venueFocus(venueCount: number): { ok: true } | { ok: false; reason: 'list_video' | 'no_venue' } {
  if (venueCount <= 0) return { ok: false, reason: 'no_venue' };
  if (venueCount > MAX_VENUES_PER_VIDEO) return { ok: false, reason: 'list_video' };
  return { ok: true };
}

/** Aynı kaynak video yalnız bir kez kullanılır; ikinci mekana bağlanmaz. */
export function claimVideo(used: Set<string>, sourceUrl: string): boolean {
  if (used.has(sourceUrl)) return false;
  used.add(sourceUrl);
  return true;
}
