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

export function normalizeName(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ığüşöç\s]/g, ' ')
    .replace(/\b(the|cafe|kafe|restaurant|restoran|bar|coffee|kahve)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jaro-Winkler yerine basit ve şeffaf: token Jaccard + tam eşleşme bonusu (kalibre edilecek). */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : inter / union;
}

export interface ScoredCandidate {
  venueId: string;
  score: number;
  components: { name: number; city: number | null; area: number | null; category: number | null };
  hardConflicts: string[];
}

export function scoreCandidate(m: MentionInput, c: VenueCandidate): ScoredCandidate {
  const name = Math.max(nameSimilarity(m.rawPlaceName, c.name), ...c.aliases.map((a) => nameSimilarity(m.rawPlaceName, a)));
  const city = m.cityHint ? (normalizeName(m.cityHint) === normalizeName(c.city) ? 1 : 0) : null;
  const area = m.neighborhoodOrAddressHint && c.neighborhood ? (normalizeName(m.neighborhoodOrAddressHint) === normalizeName(c.neighborhood) ? 1 : 0) : null;
  const category = m.categoryCandidates.length > 0 ? (m.categoryCandidates.includes(c.category) ? 1 : 0) : null;
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
