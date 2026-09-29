/**
 * Deterministik mekan/şube eşleştirme (§16.1–16.3). AI isim ve ipucu üretir; karar burada verilir.
 * MatchEvidence = .40 isim + .25 açık şehir + .20 adres/mahalle + .15 kategori. İsim dışında coğrafi kanıt yoksa auto-publish yok.
 */
export interface MentionInput {
  rawPlaceName: string;
  cityHint: string | null;
  neighborhoodOrAddressHint: string | null;
  categoryCandidates: string[];
  /** Kanıt türleri (caption/transcript/video_frame/creator_supplied) — en az iki tür gerekir. */
  evidenceKinds: string[];
}

export interface VenueCandidate {
  venueId: string;
  name: string;
  aliases: string[];
  city: string;
  neighborhood: string | null;
  category: string;
  status: 'open' | 'permanently_closed' | 'unknown';
}

export interface MatchConfig {
  autoMinScore: number;
  autoMinTopTwoGap: number;
  reviewMinScore: number;
  minEvidenceKinds: number;
  requireGeographicEvidence: boolean;
  autoPublishEnabled: boolean;
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  autoMinScore: 0.92,
  autoMinTopTwoGap: 0.12,
  reviewMinScore: 0.8,
  minEvidenceKinds: 2,
  requireGeographicEvidence: true,
  autoPublishEnabled: false, // pilot doğrulaması geçmeden kapalı (§16.2)
};

/** Küçük harf (tr), aksan/noktalama temizliği; jenerik kelimeler KALIR (handle karşılaştırması için). */
function normalizeBase(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ığüşöç\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeName(s: string): string {
  return normalizeBase(s)
    .replace(/\b(the|cafe|kafe|restaurant|restoran|bar|coffee|kahve)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "holecoffeeco" ↔ ["hole","coffee","matcha","co"]: handle, adayın kelimelerinin sıralı bir alt dizisinin birleşimi mi? */
function handleMatchesTokens(handle: string, tokens: string[]): boolean {
  if (handle.length < 6 || tokens.length < 2) return false;
  let pos = 0;
  for (const t of tokens) {
    if (handle.startsWith(t, pos)) pos += t.length;
    if (pos === handle.length) return true;
  }
  return pos === handle.length;
}

/**
 * Ad karşılaştırmasında anlam taşımayan coğrafi/şube kelimeleri (şehir, ilçe, "şube", "moda" gibi konum ekleri Google adında
 * sık görülür: "Taico - Moda", "Limon Lokal İstanbul", "Dali Burger Kadıköy"). Liste kapsam şehirleriyle büyür (§12.4).
 */
const GEO_WORDS = ['İstanbul', 'Türkiye', 'Turkey', 'şube', 'branch',
  'Kadıköy', 'Beşiktaş', 'Beyoğlu', 'Üsküdar', 'Şişli', 'Sarıyer', 'Fatih', 'Bakırköy', 'Ataşehir', 'Maltepe', 'Kartal', 'Pendik',
  'Beykoz', 'Eyüp', 'Bağcılar', 'Moda', 'Nişantaşı', 'Karaköy', 'Cihangir', 'Bebek', 'Arnavutköy', 'Yeniköy', 'Caddebostan',
  'Fenerbahçe', 'Bostancı', 'Altunizade', 'Balat', 'Ortaköy', 'Taksim', 'Galata', 'Heybeliada', 'Büyükada', 'Adalar'];

/** İstanbul'un 39 ilçesi: ipucu bir ilçeyse ve aday başka bir ilçedeyse şehir çelişkisi sayılır. */
export const ISTANBUL_DISTRICTS = ['Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar', 'Bahçelievler', 'Bakırköy', 'Başakşehir', 'Bayrampaşa',
  'Beşiktaş', 'Beykoz', 'Beylikdüzü', 'Beyoğlu', 'Büyükçekmece', 'Çatalca', 'Çekmeköy', 'Esenler', 'Esenyurt', 'Eyüpsultan', 'Fatih',
  'Gaziosmanpaşa', 'Güngören', 'Kadıköy', 'Kağıthane', 'Kartal', 'Küçükçekmece', 'Maltepe', 'Pendik', 'Sancaktepe', 'Sarıyer', 'Silivri',
  'Sultanbeyli', 'Sultangazi', 'Şile', 'Şişli', 'Tuzla', 'Ümraniye', 'Üsküdar', 'Zeytinburnu'];
/** Şehir ipucunda İstanbul'u işaret eden semt/bölge kelimeleri (ad karşılaştırmasından ATILMAZ; yalnız ipucu yorumunda). */
export const ISTANBUL_HINT_WORDS = [...ISTANBUL_DISTRICTS, 'İstanbul', 'Türkiye', 'Turkey', 'Moda', 'Nişantaşı', 'Karaköy', 'Cihangir', 'Bebek',
  'Yeniköy', 'Caddebostan', 'Fenerbahçe', 'Bostancı', 'Altunizade', 'Balat', 'Ortaköy', 'Taksim', 'Galata', 'Heybeliada', 'Büyükada',
  'Eyüp', 'Tarabya', 'Emirgan', 'Rumelihisarı', 'Anadoluhisarı', 'Kandilli', 'Çengelköy', 'Kuzguncuk', 'Beylerbeyi', 'Suadiye', 'Göztepe',
  'Erenköy', 'Kalamış', 'Levent', 'Etiler', 'Maslak', 'Mecidiyeköy', 'Sirkeci', 'Eminönü', 'Sultanahmet', 'Kumkapı', 'Yeşilköy', 'Florya',
  'Ataköy', 'Kurtuluş', 'Tophane', 'Tünel', 'Kilyos', 'Rumeli', 'Anadolu', 'Avrupa', 'Asya', 'Yakası', 'Boğaz', 'Bosphorus', 'Kozyatağı',
  'Acıbadem', 'Harbiye', 'Teşvikiye', 'Kasımpaşa', 'Feriköy', 'Bomonti', 'Fener', 'Aksaray', 'Laleli', 'Beyazıt', 'Cağaloğlu'];
const foldDotless = (s: string) => s.replace(/ı/g, 'i');
// Liste, adlarla aynı normalizasyondan geçer (ö→o, ş→s; ı kalır) ve ı/i katlanmış biçimiyle de tutulur.
const tokenSet = (words: string[]) => new Set(words.flatMap((w) => { const b = normalizeBase(w); return [b, foldDotless(b)]; }));
const GEO_TOKENS = tokenSet(GEO_WORDS);
const DISTRICT_TOKENS = tokenSet(ISTANBUL_DISTRICTS);
const ISTANBUL_HINT_TOKENS = tokenSet(ISTANBUL_HINT_WORDS);
const ISTANBUL_TOKENS = tokenSet(['İstanbul', 'Türkiye', 'Turkey']);
const inSet = (set: Set<string>, t: string) => set.has(t) || set.has(foldDotless(t));

function contentTokens(normalized: string): string[] {
  return normalized.split(' ').filter((t) => t && !GEO_TOKENS.has(t) && !GEO_TOKENS.has(foldDotless(t)));
}

/**
 * Basit ve şeffaf (kalibre edilecek): coğrafi kelimeler atıldıktan sonra token Jaccard; bir ad diğerinin tüm
 * kelimelerini içeriyorsa (Google adında şube/konum eki: "ÇiÇi Beşiktaş" ↔ "Çi Çi") kapsama puanı 0.9; boşluksuz
 * "handle" biçimi ("holecoffeeco" ↔ "Hole Coffee Co") için sıkıştırılmış karşılaştırma. Tam eşleşme 1.
 */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a.replace(/^@/, ''));
  const nb = normalizeName(b.replace(/^@/, ''));
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ca = contentTokens(na);
  const cb = contentTokens(nb);
  if (ca.length === 0 || cb.length === 0) return 0;
  const compactA = ca.join('');
  const compactB = cb.join('');
  if (compactA === compactB) return 1;
  const ta = new Set(ca);
  const tb = new Set(cb);
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  const jaccard = union === 0 ? 0 : inter / union;
  const containsAll = (ta.size > 0 && [...ta].every((t) => tb.has(t))) || (tb.size > 0 && [...tb].every((t) => ta.has(t)));
  const compactContains = Math.min(compactA.length, compactB.length) >= 4 && (compactA.includes(compactB) || compactB.includes(compactA));
  // Handle biçimi: jenerik kelimeler dahil taban kelimelerle karşılaştır ("holecoffeeco" ↔ "Hole Coffee & Matcha Co.").
  const baseA = contentTokens(normalizeBase(a.replace(/^@/, '')));
  const baseB = contentTokens(normalizeBase(b.replace(/^@/, '')));
  const handleMatch = (baseA.length === 1 && handleMatchesTokens(baseA[0]!, baseB)) || (baseB.length === 1 && handleMatchesTokens(baseB[0]!, baseA));
  if (containsAll || compactContains || handleMatch) return Math.max(jaccard, 0.9);
  return jaccard;
}

export interface ScoredCandidate {
  venueId: string;
  score: number;
  components: { name: number; city: number | null; area: number | null; category: number | null };
  hardConflicts: string[];
}

/** "Altunizade, Oymacı Sk. No:20, Üsküdar / İstanbul" ↔ "Üsküdar": adres ipucu mahalle/ilçe adını kelime olarak içeriyorsa alan eşleşir. */
function areaMatches(hint: string, neighborhood: string): boolean {
  const h = normalizeName(hint);
  const n = normalizeName(neighborhood);
  if (!h || !n) return false;
  if (h === n) return true;
  const ht = new Set(h.split(' '));
  return n.split(' ').every((t) => ht.has(t));
}

export function scoreCandidate(m: MentionInput, c: VenueCandidate): ScoredCandidate {
  const name = Math.max(nameSimilarity(m.rawPlaceName, c.name), ...c.aliases.map((a) => nameSimilarity(m.rawPlaceName, a)));
  // Çıkarım "şehir" ipucu olarak sık sık ilçe verir (Kadıköy, Beşiktaş); adayın şehri ya da mahallesi/ilçesi ile eşleşiyorsa çelişki değildir.
  const cityHintNorm = m.cityHint ? normalizeName(m.cityHint) : null;
  const cityHintIsDistrict = cityHintNorm !== null && c.neighborhood !== null && cityHintNorm === normalizeName(c.neighborhood);
  // "Fatih, İstanbul", "Tarabya", "Avrupa Yakası": şehri içeren ya da yalnız o şehrin ilçe/semt kelimelerinden oluşan ipucu çelişki değildir.
  const cityNorm = normalizeName(c.city);
  const hintTokens = cityHintNorm ? cityHintNorm.split(' ').filter(Boolean) : [];
  const hintNamesCity = cityNorm !== '' && (hintTokens.includes(cityNorm) || hintTokens.map(foldDotless).includes(foldDotless(cityNorm)));
  const hintOnlyIstanbulPlaces = hintTokens.length > 0 && hintTokens.every((t) => inSet(ISTANBUL_HINT_TOKENS, t));
  const candidateInIstanbul = inSet(ISTANBUL_TOKENS, cityNorm);
  // İpucu bir ilçe adı içeriyor ve aday bilinen BAŞKA bir ilçedeyse (Kadıköy ↔ Beşiktaş) gerçek çelişki.
  const hintDistricts = hintTokens.filter((t) => inSet(DISTRICT_TOKENS, t));
  const candDistrict = c.neighborhood ? normalizeName(c.neighborhood).split(' ').find((t) => inSet(DISTRICT_TOKENS, t)) ?? null : null;
  const districtConflict = hintDistricts.length > 0 && candDistrict !== null && !hintDistricts.some((t) => foldDotless(t) === foldDotless(candDistrict));
  const city = cityHintNorm ? (cityHintNorm === cityNorm || cityHintIsDistrict || ((hintNamesCity || (hintOnlyIstanbulPlaces && candidateInIstanbul)) && !districtConflict) ? 1 : 0) : null;
  const areaHint = m.neighborhoodOrAddressHint ?? (cityHintIsDistrict ? m.cityHint : null);
  // Adres/semt ipucu Google'ın mahalle adıyla nadiren birebir örtüşür ("4. Levent" ↔ "Şişli"): eşleşme artı puandır;
  // yalnız ipucu açıkça BAŞKA bir ilçeyi söylüyorsa 0, aksi halde bilinmiyor (yeniden ağırlıklandırılır).
  const areaHintDistricts = areaHint ? normalizeName(areaHint).split(' ').filter((t) => inSet(DISTRICT_TOKENS, t)) : [];
  const areaConflict = areaHintDistricts.length > 0 && candDistrict !== null && !areaHintDistricts.some((t) => foldDotless(t) === foldDotless(candDistrict));
  const area = areaHint && c.neighborhood ? (areaMatches(areaHint, c.neighborhood) ? 1 : areaConflict ? 0 : null) : null;
  // Aday kategorisi bilinmiyorsa (Google türü eşlenmemiş) ceza yerine yeniden ağırlıklandır.
  const categoryKnown = c.category !== '' && c.category !== 'other' && c.category !== 'unknown';
  const category = m.categoryCandidates.length > 0 && categoryKnown ? (m.categoryCandidates.includes(c.category) ? 1 : 0) : null;
  const hardConflicts: string[] = [];
  if (city === 0) hardConflicts.push('city_mismatch');
  if (c.status === 'permanently_closed') hardConflicts.push('permanently_closed');
  // Eksik özellikler yeniden ağırlıklandırılır; ama coğrafi kanıt yoksa yayın kapısı ayrıca engeller.
  const weights: Array<[number, number | null]> = [
    [0.4, name],
    [0.25, city],
    [0.2, area],
    [0.15, category],
  ];
  const available = weights.filter(([, v]) => v !== null);
  const wsum = available.reduce((a, [w]) => a + w, 0);
  const score = available.reduce((a, [w, v]) => a + w * (v as number), 0) / wsum;
  return { venueId: c.venueId, score: Number(score.toFixed(4)), components: { name, city, area, category }, hardConflicts };
}

export type Resolution =
  | { status: 'auto_match'; venueId: string; score: number; gap: number }
  | { status: 'review_required'; venueId: string | null; score: number | null; reasons: string[] }
  | { status: 'unresolved'; reasons: string[] };

export function resolveMention(m: MentionInput, candidates: VenueCandidate[], cfg: MatchConfig = DEFAULT_MATCH_CONFIG): Resolution {
  if (candidates.length === 0) return { status: 'unresolved', reasons: ['no_candidates'] };
  const scored = candidates.map((c) => scoreCandidate(m, c)).sort((a, b) => b.score - a.score);
  const top = scored[0]!;
  const second = scored[1];
  const gap = second ? top.score - second.score : 1;
  const reasons: string[] = [];
  const hasGeo = m.cityHint !== null || m.neighborhoodOrAddressHint !== null;
  if (top.hardConflicts.length > 0) reasons.push(...top.hardConflicts.map((c) => `hard_conflict:${c}`));
  if (cfg.requireGeographicEvidence && !hasGeo) reasons.push('no_geographic_evidence');
  if (m.evidenceKinds.length < cfg.minEvidenceKinds) reasons.push('insufficient_evidence_kinds');
  if (gap < cfg.autoMinTopTwoGap) reasons.push('top_two_gap_small');
  if (top.score < cfg.reviewMinScore) return { status: 'unresolved', reasons: ['low_score', ...reasons] };
  if (top.score >= cfg.autoMinScore && reasons.length === 0) {
    if (!cfg.autoPublishEnabled) return { status: 'review_required', venueId: top.venueId, score: top.score, reasons: ['auto_publish_disabled'] };
    return { status: 'auto_match', venueId: top.venueId, score: top.score, gap };
  }
  return { status: 'review_required', venueId: top.venueId, score: top.score, reasons: reasons.length ? reasons : ['below_auto_threshold'] };
}
