/**
 * Deterministik viral endeks (§17). Ağ/LLM çağrısı yok. Aynı girdi + aynı sürüm = aynı sonuç.
 * Bu paket bileşen aritmetiğini ve kapıları uygular; cohort normalizasyonu (M/O üretimi) M4 işidir.
 */
export const SCORE_VERSION = 'viral_score_v1-proposal';

export interface TrendWeights {
  momentum: number;
  diversity: number;
  freshness: number;
  outperformance: number;
}

export interface TrendConfig {
  version: string;
  windowDays: number;
  weights: TrendWeights;
  creatorDiversitySaturation: number;
  freshnessDecayHours: number;
  minimumIndependentCreators: number;
  minimumPosts: number;
  minimumMomentumCoverage: number;
  minimumNormalizationObservations: number;
  freshObservationAgeHoursExclusive: number;
  trendingBadge: {
    minimumScore: number;
    minimumMomentum: number;
    minimumCreators: number;
    newestPostAgeHoursExclusive: number;
  };
}

export interface ScoreComponents {
  /** Momentum zorunlu; yoksa sayısal skor yok. */
  M: number | null;
  D: number;
  F: number;
  /** Outperformance eksikse kalan ağırlıklar 1'e normalize edilir, baseline_partial işaretlenir. */
  O: number | null;
}

export interface EligibilityInput {
  eligiblePosts: number;
  distinctCreators: number;
  /** Uygun gönderilerin geçerli momentum verisi olan oranı (0–1). */
  momentumCoverage: number;
  /** Son başarılı gözlemden bu yana saat. */
  lastObservationAgeHours: number;
  /** Karşılaştırma grubu gözlem sayısı. */
  cohortObservations: number;
  /** Hak/veri sağlığı engeli varsa withheld. */
  rightsOrHealthBlocked?: boolean;
}

export type TrendStatus = 'ready' | 'insufficient_data' | 'stale' | 'withheld';

export interface ViralScoreResult {
  score: number | null;
  status: TrendStatus;
  scoreVersion: string;
  components: { momentum: number | null; diversity: number; freshness: number; outperformance: number | null };
  baselinePartial: boolean;
  reasonCodes: string[];
}

/** Şartname: pozitif değerlerde floor(x+0.5). */
export function roundScore(x: number): number {
  if (x < 0) throw new Error('roundScore expects a non-negative value');
  return Math.floor(x + 0.5);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** D = min(bağımsız creator / doyum, 1) */
export function diversityComponent(distinctCreators: number, saturation: number): number {
  return clamp01(distinctCreators / saturation);
}

/** F = ortalama(exp(-yaş_saat / decay)) her creator'ın en yeni uygun gönderisi için. */
export function freshnessComponent(newestPostAgeHoursPerCreator: number[], decayHours: number): number {
  if (newestPostAgeHoursPerCreator.length === 0) return 0;
  const sum = newestPostAgeHoursPerCreator.reduce((acc, h) => acc + Math.exp(-Math.max(0, h) / decayHours), 0);
  return clamp01(sum / newestPostAgeHoursPerCreator.length);
}

/** O per creator = clamp(log2(max(views/expected,1))/3, 0, 1); yeterli geçmiş yoksa null. */
export function outperformanceForCreator(views: number, expectedViews: number | null, comparableHistory: number, minHistory: number): number | null {
  if (expectedViews === null || expectedViews <= 0 || comparableHistory < minHistory) return null;
  return clamp01(Math.log2(Math.max(views / expectedViews, 1)) / 3);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Snapshot çiftinden hız; geriye düşen sayaç anomalidir, sıfıra kırpılmaz (§17.3). */
export interface Snapshot {
  observedAt: string;
  views: number | null;
}
export type VelocityResult =
  | { kind: 'ok'; viewsPerHour: number; elapsedHours: number }
  | { kind: 'invalid'; reason: 'single_snapshot' | 'null_counter' | 'too_close' | 'too_far' | 'counter_reset_or_revision' };

export function viewVelocity(a: Snapshot, b: Snapshot, minHours = 1, maxHours = 48): VelocityResult {
  if (a.views === null || b.views === null) return { kind: 'invalid', reason: 'null_counter' };
  const elapsedHours = (Date.parse(b.observedAt) - Date.parse(a.observedAt)) / 3_600_000;
  if (!Number.isFinite(elapsedHours) || elapsedHours <= 0) return { kind: 'invalid', reason: 'single_snapshot' };
  if (elapsedHours < minHours) return { kind: 'invalid', reason: 'too_close' };
  if (elapsedHours > maxHours) return { kind: 'invalid', reason: 'too_far' };
  const gain = b.views - a.views;
  if (gain < 0) return { kind: 'invalid', reason: 'counter_reset_or_revision' };
  return { kind: 'ok', viewsPerHour: gain / elapsedHours, elapsedHours };
}

export function computeViralScore(components: ScoreComponents, eligibility: EligibilityInput, config: TrendConfig): ViralScoreResult {
  const reasonCodes: string[] = [];
  const base: Omit<ViralScoreResult, 'score' | 'status'> = {
    scoreVersion: config.version,
    components: { momentum: components.M, diversity: components.D, freshness: components.F, outperformance: components.O },
    baselinePartial: false,
    reasonCodes,
  };

  if (eligibility.rightsOrHealthBlocked) {
    reasonCodes.push('rights_or_health_blocked');
    return { ...base, score: null, status: 'withheld' };
  }
  if (eligibility.eligiblePosts < config.minimumPosts) reasonCodes.push('too_few_posts');
  if (eligibility.distinctCreators < config.minimumIndependentCreators) reasonCodes.push('only_one_independent_creator');
  if (eligibility.momentumCoverage < config.minimumMomentumCoverage) reasonCodes.push('momentum_coverage_low');
  if (eligibility.cohortObservations < config.minimumNormalizationObservations) reasonCodes.push('cohort_too_small');
  if (components.M === null) reasonCodes.push('momentum_missing');
  if (reasonCodes.length > 0) return { ...base, score: null, status: 'insufficient_data' };

  const w = config.weights;
  const M = components.M as number;
  let subtotal = M * w.momentum + components.D * w.diversity + components.F * w.freshness;
  let baselinePartial = false;
  if (components.O === null) {
    subtotal /= 1 - w.outperformance;
    baselinePartial = true;
    reasonCodes.push('baseline_partial');
  } else {
    subtotal += components.O * w.outperformance;
  }
  const score = roundScore(100 * clamp01(subtotal));
  const stale = eligibility.lastObservationAgeHours >= config.freshObservationAgeHoursExclusive;
  if (stale) reasonCodes.push('observation_stale');
  return { ...base, baselinePartial, score, status: stale ? 'stale' : 'ready' };
}

/** "Yükselen" rozeti (§17.5): skor≥75, M≥.70, ≥3 creator, son 72 saatte yeni uygun gönderi, status ready. */
export function isTrending(result: ViralScoreResult, distinctCreators: number, newestPostAgeHours: number, config: TrendConfig): boolean {
  const t = config.trendingBadge;
  if (result.status !== 'ready' || result.score === null || result.components.momentum === null) return false;
  return (
    result.score >= t.minimumScore &&
    result.components.momentum >= t.minimumMomentum &&
    distinctCreators >= t.minimumCreators &&
    newestPostAgeHours < t.newestPostAgeHoursExclusive
  );
}
