/**
 * Ürün sahibinin seçtiği şehirler (27.10.2026): seçicide önce bunlar, bu sırayla gelir; ilk şehir varsayılandır.
 * 28.10.2026: mekanı olan diğer şehirler de gösterilir, öne çıkanların ardından mekan sayısına göre.
 * Eşleşme ad varyantlarıyla yapılır; veritabanında karşılığı olmayan şehir (ör. Lizbon) veri gelene kadar görünmez.
 */
export interface FeaturedCity {
  key: string;
  names: readonly string[];
  label: { tr: string; en: string };
}

export const FEATURED_CITIES: readonly FeaturedCity[] = [
  { key: 'istanbul', names: ['İstanbul', 'Istanbul'], label: { tr: 'İstanbul', en: 'Istanbul' } },
  { key: 'paris', names: ['Paris'], label: { tr: 'Paris', en: 'Paris' } },
  { key: 'london', names: ['Londra', 'London'], label: { tr: 'Londra', en: 'London' } },
  { key: 'milan', names: ['Milano', 'Milan'], label: { tr: 'Milano', en: 'Milan' } },
  { key: 'new-york', names: ['New York', 'New York City'], label: { tr: 'New York', en: 'New York' } },
  { key: 'los-angeles', names: ['Los Angeles'], label: { tr: 'Los Angeles', en: 'Los Angeles' } },
  { key: 'madrid', names: ['Madrid'], label: { tr: 'Madrid', en: 'Madrid' } },
  { key: 'barcelona', names: ['Barselona', 'Barcelona'], label: { tr: 'Barselona', en: 'Barcelona' } },
  { key: 'rome', names: ['Roma', 'Rome'], label: { tr: 'Roma', en: 'Rome' } },
  { key: 'florence', names: ['Firenze', 'Floransa', 'Florence'], label: { tr: 'Floransa', en: 'Florence' } },
  { key: 'ankara', names: ['Ankara'], label: { tr: 'Ankara', en: 'Ankara' } },
  { key: 'lisbon', names: ['Lizbon', 'Lisboa', 'Lisbon'], label: { tr: 'Lizbon', en: 'Lisbon' } },
  { key: 'izmir', names: ['İzmir', 'Izmir'], label: { tr: 'İzmir', en: 'Izmir' } },
  { key: 'tokyo', names: ['Tokyo', 'Tōkyō'], label: { tr: 'Tokyo', en: 'Tokyo' } },
  { key: 'amsterdam', names: ['Amsterdam'], label: { tr: 'Amsterdam', en: 'Amsterdam' } },
];

const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').toLowerCase().trim();

/**
 * Önce seçili şehirler (liste sırasıyla, ad yerel etiketle), sonra mekanı olan diğerleri: mekan sayısı çoktan aza,
 * eşitlikte ada göre. Mekanı olmayan şehir gösterilmez.
 */
export function curateCities<T extends { name: string; placeCount?: number }>(cities: readonly T[], locale: 'tr' | 'en'): T[] {
  const featured: T[] = [];
  const used = new Set<T>();
  for (const f of FEATURED_CITIES) {
    const keys = f.names.map(norm);
    const match = cities.find((c) => !used.has(c) && keys.includes(norm(c.name)));
    if (match) { used.add(match); featured.push({ ...match, name: f.label[locale] }); }
  }
  const rest = cities
    .filter((c) => !used.has(c) && (c.placeCount ?? 0) > 0)
    .sort((a, b) => (b.placeCount ?? 0) - (a.placeCount ?? 0) || a.name.localeCompare(b.name, locale));
  return [...featured, ...rest];
}

/** Seçicide "Diğer şehirler" ayracı için: ad, seçili şehirlerden birinin yerel etiketi mi. */
export function isFeaturedCityName(name: string): boolean {
  const n = norm(name);
  return FEATURED_CITIES.some((f) => norm(f.label.tr) === n || norm(f.label.en) === n);
}
