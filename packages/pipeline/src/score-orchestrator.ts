/**
 * Skor orkestratörü (§17): uygun içerik kümesi → snapshot hızları → cohort yüzdelik (M) → D/F/O → packages/scoring kapıları.
 * Saf fonksiyon; DB okuması/yazması worker'da. Aynı girdi + aynı sürüm + aynı asOf = aynı sonuç. LLM yok.
 */
import { computeViralScore, diversityComponent, freshnessComponent, isTrending, median, outperformanceForCreator, viewVelocity, type Snapshot, type TrendConfig } from '@viral-places/scoring';

export const NORMALIZATION_VERSION_PREFIX = 'cohort-v1';

export interface ScoringPost {
  postId: string;
  creatorId: string;
  platform: 'tiktok' | 'instagram';
  publishedAt: string;
  /** Kronolojik snapshot'lar (observedAt artan). */
  snapshots: Snapshot[];
  availability: 'available' | 'private' | 'deleted' | 'geo_restricted' | 'unknown';
  rightsValid: boolean;
  linkApproved: boolean;
  stance: 'recommend' | 'neutral' | 'avoid' | 'unclear';
  sponsoredStatus: 'declared' | 'none_declared' | 'unknown';
  isDuplicateOfOtherPost: boolean;
  /** Creator'ın yaş-eşlenmiş geçmiş gönderilerinin izlenme medyanı için örnek (en az 5). */
  creatorHistoryViews: number[];
}

export interface CohortTable {
  /** Karşılaştırma grubu kimliği: platform × yaş kovası × kapsam (örn. "tiktok:24-72h:istanbul/food"). */
  scope: string;
  version: string; // günlük sürüm, örn. cohort-v1-2026-09-13
  /** Sıralı hız gözlemleri (views/hour); winsorize edilmiş. */
  velocities: number[];
  observations: number;
}

export interface VenueScoreInput {
  venueId: string;
  asOf: string;
  posts: ScoringPost[];
  cohortFor: (platform: 'tiktok' | 'instagram', ageBucket: string) => CohortTable | null;
  config: TrendConfig;
  lastSuccessfulObservationAt: string | null;
  rightsOrHealthBlocked?: boolean;
}

export interface VenueScoreOutput {
  venueId: string;
  score: number | null;
  status: 'ready' | 'insufficient_data' | 'stale' | 'withheld';
  trending: boolean;
  scoreVersion: string;
  normalizationVersion: string;
  asOf: string;
  windowStart: string;
  windowEnd: string;
  components: { momentum: number | null; diversity: number; freshness: number; outperformance: number | null };
  distinctCreators: number;
  eligiblePosts: number;
  metricsCoverage: number;
  baselinePartial: boolean;
  baselineScope: string | null;
  reasonCodes: string[];
  evidenceSnapshotIds: string[];
  accessibleViews: number | null;
  excluded: Array<{ postId: string; reason: string }>;
}

export function ageBucketOf(ageHours: number): string {
  if (ageHours < 24) return '0-24h';
  if (ageHours < 72) return '24-72h';
  if (ageHours < 168) return '72-168h';
  return '168h+';
}

/** Yüzdelik konum (0–1), mid-rank; boş cohort → null. */
export function percentileRank(sortedAsc: number[], value: number): number | null {
  const n = sortedAsc.length;
  if (n === 0) return null;
  let below = 0;
  let equal = 0;
  for (const v of sortedAsc) {
    if (v < value) below += 1;
    else if (v === value) equal += 1;
  }
  return (below + equal / 2) / n;
}

/** Winsorization: uçlar sürümlü eşikle kırpılır (p01/p99). */
export function winsorize(values: number[], lowerQ = 0.01, upperQ = 0.99): number[] {
  if (values.length < 3) return [...values].sort((a, b) => a - b);
  const s = [...values].sort((a, b) => a - b);
  const lo = s[Math.floor(lowerQ * (s.length - 1))]!;
  const hi = s[Math.ceil(upperQ * (s.length - 1))]!;
  return s.map((v) => Math.min(hi, Math.max(lo, v)));
}

/** Gönderi için en iyi (en güncel geçerli) snapshot çifti hızı; geriye düşen sayaç aralığı atlanır ama işaretlenir. */
export function bestVelocity(snapshots: Snapshot[], config: TrendConfig): { viewsPerHour: number; pair: [number, number] } | { invalid: string } {
  if (snapshots.length < 2) return { invalid: 'single_snapshot' };
  let reason = 'no_valid_pair';
  for (let j = snapshots.length - 1; j >= 1; j--) {
    for (let i = j - 1; i >= 0; i--) {
      const v = viewVelocity(snapshots[i]!, snapshots[j]!, 1, 48);
      if (v.kind === 'ok') return { viewsPerHour: v.viewsPerHour, pair: [i, j] };
      if (v.reason === 'counter_reset_or_revision') reason = 'counter_reset_or_revision';
      if (v.reason === 'too_far') break;
    }
  }
  return { invalid: reason };
}

export function scoreVenue(input: VenueScoreInput): VenueScoreOutput {
  const { config, asOf } = input;
  const asOfMs = Date.parse(asOf);
  const windowStart = new Date(asOfMs - config.windowDays * 86_400_000).toISOString();
  const excluded: VenueScoreOutput['excluded'] = [];
  const eligible: ScoringPost[] = [];
  for (const p of input.posts) {
    const pub = Date.parse(p.publishedAt);
    if (pub < asOfMs - config.windowDays * 86_400_000 || pub > asOfMs) excluded.push({ postId: p.postId, reason: 'outside_window' });
    else if (p.availability !== 'available') excluded.push({ postId: p.postId, reason: `availability_${p.availability}` });
    else if (!p.rightsValid) excluded.push({ postId: p.postId, reason: 'rights_invalid' });
    else if (!p.linkApproved) excluded.push({ postId: p.postId, reason: 'link_not_approved' });
    else if (p.stance !== 'recommend') excluded.push({ postId: p.postId, reason: `stance_${p.stance}` });
    else if (p.sponsoredStatus === 'declared') excluded.push({ postId: p.postId, reason: 'sponsored_declared' });
    else if (p.isDuplicateOfOtherPost) excluded.push({ postId: p.postId, reason: 'duplicate' });
    else eligible.push(p);
  }

  const creators = new Map<string, ScoringPost[]>();
  for (const p of eligible) creators.set(p.creatorId, [...(creators.get(p.creatorId) ?? []), p]);
  const distinctCreators = creators.size;

  // M: gönderi hızı → cohort yüzdeliği; creator içi medyan; creatorlar arası eşit ağırlıklı ortalama
  const creatorMomentum: number[] = [];
  let postsWithMomentum = 0;
  const scopes = new Set<string>();
  const versions = new Set<string>();
  const evidenceSnapshotIds: string[] = [];
  let cohortObservationsMin = Number.POSITIVE_INFINITY;
  for (const [, posts] of creators) {
    const pcts: number[] = [];
    for (const p of posts) {
      const v = bestVelocity(p.snapshots, config);
      if ('invalid' in v) continue;
      const ageHours = (asOfMs - Date.parse(p.publishedAt)) / 3_600_000;
      const cohort = input.cohortFor(p.platform, ageBucketOf(ageHours));
      if (!cohort) continue;
      cohortObservationsMin = Math.min(cohortObservationsMin, cohort.observations);
      const pct = percentileRank(cohort.velocities, v.viewsPerHour);
      if (pct === null) continue;
      pcts.push(pct);
      postsWithMomentum += 1;
      scopes.add(cohort.scope);
      versions.add(cohort.version);
      evidenceSnapshotIds.push(`${p.postId}#${v.pair[0]}`, `${p.postId}#${v.pair[1]}`);
    }
    const m = median(pcts);
    if (m !== null) creatorMomentum.push(m);
  }
  const M = creatorMomentum.length > 0 ? creatorMomentum.reduce((a, b) => a + b, 0) / creatorMomentum.length : null;
  const momentumCoverage = eligible.length > 0 ? postsWithMomentum / eligible.length : 0;

  // D, F
  const D = diversityComponent(distinctCreators, config.creatorDiversitySaturation);
  const newestAges = Array.from(creators.values()).map((posts) => Math.min(...posts.map((p) => (asOfMs - Date.parse(p.publishedAt)) / 3_600_000)));
  const F = newestAges.length > 0 ? freshnessComponent(newestAges, config.freshnessDecayHours) : 0;

  // O: creator başına son snapshot izlenmesi / geçmiş medyan (≥5 gönderi); creatorlar arası medyan
  const oValues: number[] = [];
  for (const [, posts] of creators) {
    const perPost: number[] = [];
    for (const p of posts) {
      const last = p.snapshots.at(-1);
      if (!last || last.views === null) continue;
      const expected = median(p.creatorHistoryViews);
      const o = outperformanceForCreator(last.views, expected, p.creatorHistoryViews.length, 5);
      if (o !== null) perPost.push(o);
    }
    const m = median(perPost);
    if (m !== null) oValues.push(m);
  }
  const O = median(oValues);

  const lastObsAge = input.lastSuccessfulObservationAt ? (asOfMs - Date.parse(input.lastSuccessfulObservationAt)) / 3_600_000 : Number.POSITIVE_INFINITY;
  const result = computeViralScore(
    { M, D, F, O },
    { eligiblePosts: eligible.length, distinctCreators, momentumCoverage, lastObservationAgeHours: lastObsAge, cohortObservations: Number.isFinite(cohortObservationsMin) ? cohortObservationsMin : 0, ...(input.rightsOrHealthBlocked !== undefined ? { rightsOrHealthBlocked: input.rightsOrHealthBlocked } : {}) },
    config,
  );
  const newestAgeHours = newestAges.length > 0 ? Math.min(...newestAges) : Number.POSITIVE_INFINITY;
  const accessibleViews = eligible.reduce<number | null>((acc, p) => {
    const v = p.snapshots.at(-1)?.views ?? null;
    return v === null ? acc : (acc ?? 0) + v;
  }, null);
  const normalizationVersion = versions.size > 0 ? Array.from(versions).sort().join('+') : `${NORMALIZATION_VERSION_PREFIX}-none`;
  return {
    venueId: input.venueId,
    score: result.score,
    status: result.status,
    trending: isTrending(result, distinctCreators, newestAgeHours, config),
    scoreVersion: result.scoreVersion,
    normalizationVersion,
    asOf,
    windowStart,
    windowEnd: asOf,
    components: result.components,
    distinctCreators,
    eligiblePosts: eligible.length,
    metricsCoverage: Number(momentumCoverage.toFixed(3)),
    baselinePartial: result.baselinePartial,
    baselineScope: scopes.size > 0 ? Array.from(scopes).sort().join('|') : null,
    reasonCodes: result.reasonCodes,
    evidenceSnapshotIds: Array.from(new Set(evidenceSnapshotIds)),
    accessibleViews,
    excluded,
  };
}

/** Günlük cohort tablosu üretimi: platform × yaş kovası × kapsam; ≥minObservations yoksa üst kapsama düşülür (çağıran katman sırayı verir). */
export function buildCohortTable(scope: string, dateKey: string, velocities: number[], minObservations: number): CohortTable | null {
  if (velocities.length < minObservations) return null;
  return { scope, version: `${NORMALIZATION_VERSION_PREFIX}-${dateKey}`, velocities: winsorize(velocities), observations: velocities.length };
}
