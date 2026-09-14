/**
 * Sayı biçimleme merkezidir (§26 yerelleştirme). Büyük sayaçlar decimal string olarak gelir
 * (bigint güvenliği, §18.1). null -> veri yok; "0" -> gerçek sıfır.
 */
export type Locale = 'tr' | 'en';

const decimalSeparator: Record<Locale, string> = { tr: ',', en: '.' };

export function formatCompactCount(value: string | number | null | undefined, locale: Locale): string | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  const sep = decimalSeparator[locale];
  const fmt = (v: number, suffix: string) => {
    const rounded = Math.round(v * 10) / 10;
    const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', sep);
    return `${text}${suffix}`;
  };
  if (n >= 1_000_000_000) return fmt(n / 1_000_000_000, locale === 'tr' ? ' Mr' : 'B');
  if (n >= 1_000_000) return fmt(n / 1_000_000, 'M');
  if (n >= 1_000) return fmt(n / 1_000, 'K');
  return String(Math.round(n));
}

export function formatDistanceLabel(meters: number, locale: Locale): string {
  const sep = decimalSeparator[locale];
  if (meters < 950) return `${Math.round(meters / 50) * 50} m`;
  const km = Math.round((meters / 1000) * 10) / 10;
  return `${String(km).replace('.', sep)} km`;
}

/** Göreli tazelik: saat cinsinden yaş. Tarih formatı UI katmanında çevrilir. */
export function ageHours(fromIso: string, nowIso: string): number {
  const from = Date.parse(fromIso);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(from) || !Number.isFinite(now)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now - from) / 3_600_000);
}
