/**
 * Ürün sahibinin seçtiği şehirler (27.10.2026): uygulama yalnız bunları, bu sırayla gösterir; ilk şehir varsayılandır.
 * Sunucudaki diğer şehir kayıtları (creator/mekan konumundan oluşan pilotlar) silinmez, yalnız istemcide gizlenir.
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

/** Sunucu şehirlerini seçili listeye indirger, liste sırasıyla döner ve adı yerel etiketle değiştirir. */
export function curateCities<T extends { name: string }>(cities: readonly T[], locale: 'tr' | 'en'): T[] {
  const out: T[] = [];
  for (const featured of FEATURED_CITIES) {
    const keys = featured.names.map(norm);
    const match = cities.find((c) => keys.includes(norm(c.name)));
    if (match) out.push({ ...match, name: featured.label[locale] });
  }
  return out;
}
