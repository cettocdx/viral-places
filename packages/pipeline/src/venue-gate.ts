/**
 * Yayın kapısı (ürün sahibi, 21.09.2026): yalnız gerçek yeme-içme işletmeleri yayına girer.
 * Canlı veride semtler ("Beşiktaş", "İstanbul"), köprü, park, AVM ve mekanın kendi hesabından gelen reklamlar
 * mekan olarak yayına girmişti. Saf fonksiyon: DB/ağ bağımlılığı yok, testten çalışır.
 */
import { ISTANBUL_HINT_WORDS, nameSimilarity, normalizeName } from './matcher';

/** Yeme-içme işletmesi olduğunu gösteren Google türleri. */
const FOOD_DRINK = /restaurant|(^|_)cafe($|_)|cafeteria|coffee|bakery|(^|_)bar($|_)|(^|_)pub($|_)|wine_bar|brewery|dessert|confectionery|ice_cream|meal_takeaway|meal_delivery|food_court|tea_house|juice|sandwich|pastry|bistro|diner|steak_house|kebab|donut|chocolate|patisserie/;

/** Hiçbir koşulda mekan sayılmayan türler (idari bölge, yol, doğa alanı). */
const NEVER = new Set(['political', 'locality', 'sublocality', 'sublocality_level_1', 'sublocality_level_2', 'neighborhood', 'administrative_area_level_1', 'administrative_area_level_2', 'administrative_area_level_3', 'country', 'postal_code', 'route', 'street_address', 'natural_feature', 'bridge', 'transit_station', 'bus_station', 'ferry_terminal', 'airport']);

/** Birincil türü bunlardan biriyse işletme değil yerdir (içinde kafe olsa bile). */
const NOT_PRIMARY = new Set(['park', 'national_park', 'shopping_mall', 'tourist_attraction', 'beach', 'marina', 'plaza', 'lodging', 'hotel', 'museum', 'mosque', 'church', 'place_of_worship', 'university', 'school', 'hospital', 'stadium', 'amusement_park', 'zoo', 'aquarium', 'store', 'supermarket', 'grocery_store', 'electronics_store', 'clothing_store']);

const DISTRICT_NAMES = new Set(ISTANBUL_HINT_WORDS.map((w) => normalizeName(w)));

export type VenueGateReason =
  | 'not_food_drink'
  | 'administrative_or_route'
  | 'primary_type_not_venue'
  | 'not_operational'
  | 'name_is_district'
  | 'self_promotion';

export interface VenueGateInput {
  name: string;
  /** Google Places türleri, birincil tür ilk sırada. */
  types: string[];
  businessStatus: string | null;
  /** Öneren hesabın kullanıcı adı ve görünen adı (kendi reklamı kontrolü). */
  creatorHandle?: string | null;
  creatorDisplayName?: string | null;
}

export function venueGate(v: VenueGateInput): { ok: true } | { ok: false; reasons: VenueGateReason[] } {
  const reasons: VenueGateReason[] = [];
  const types = v.types.map((t) => t.toLowerCase());
  if (types.some((t) => NEVER.has(t))) reasons.push('administrative_or_route');
  if (types[0] && NOT_PRIMARY.has(types[0])) reasons.push('primary_type_not_venue');
  if (!types.some((t) => FOOD_DRINK.test(t))) reasons.push('not_food_drink');
  if (v.businessStatus && v.businessStatus !== 'OPERATIONAL') reasons.push('not_operational');

  const norm = normalizeName(v.name);
  if (norm === '' || DISTRICT_NAMES.has(norm)) reasons.push('name_is_district');

  // Kendi reklamı: öneren hesap mekanın kendisi ("@kokorecitekinusta" → "Kokoreççi Tekin Usta", "@burgerkingtr" → "Burger King").
  for (const who of [v.creatorHandle, v.creatorDisplayName]) {
    if (who && isSameBrand(who, v.name)) {
      reasons.push('self_promotion');
      break;
    }
  }
  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

/** Mekan yaratmadan önce yeterli olan kaba kontrol (isim/öneren henüz bilinmeyebilir). */
export function isFoodDrinkPlace(types: string[], businessStatus: string | null): boolean {
  const lower = types.map((t) => t.toLowerCase());
  if (lower.some((t) => NEVER.has(t))) return false;
  if (lower[0] && NOT_PRIMARY.has(lower[0])) return false;
  if (businessStatus && businessStatus !== 'OPERATIONAL') return false;
  return lower.some((t) => FOOD_DRINK.test(t));
}

/** Türkçe harfleri katla, harf dışını at, tekrar eden harfleri tekle: "Kokoreççi Tekin Usta" → "kokorecitekinusta". */
function foldCompact(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/(.)\1+/g, '$1');
}

function isSameBrand(account: string, venueName: string): boolean {
  if (nameSimilarity(account, venueName) >= 0.9) return true;
  const a = foldCompact(account.replace(/^@/, ''));
  const b = foldCompact(venueName);
  if (a.length < 5 || b.length < 5) return false;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 6 && longer.includes(shorter)) return true;
  let prefix = 0;
  while (prefix < shorter.length && a[prefix] === b[prefix]) prefix += 1;
  return prefix >= 8;
}
