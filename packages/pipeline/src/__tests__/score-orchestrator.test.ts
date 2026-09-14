import { describe, expect, it } from 'vitest';
import type { TrendConfig } from '@viral-places/scoring';
import { ageBucketOf, bestVelocity, buildCohortTable, percentileRank, scoreVenue, winsorize, type ScoringPost } from '../score-orchestrator';

const config: TrendConfig = { version: 'viral_score_v1-proposal', windowDays: 7, weights: { momentum: 0.45, diversity: 0.3, freshness: 0.15, outperformance: 0.1 }, creatorDiversitySaturation: 6, freshnessDecayHours: 72, minimumIndependentCreators: 2, minimumPosts: 3, minimumMomentumCoverage: 0.7, minimumNormalizationObservations: 100, freshObservationAgeHoursExclusive: 24, trendingBadge: { minimumScore: 75, minimumMomentum: 0.7, minimumCreators: 3, newestPostAgeHoursExclusive: 72 } };
const asOf = '2026-09-13T12:00:00.000Z';
const cohort = buildCohortTable('tiktok:24-72h:istanbul/coffee', '2026-09-13', Array.from({ length: 120 }, (_, i) => i * 10), 100)!;

function post(id: string, creator: string, hoursAgo: number, v1: number | null, v2: number | null, extra: Partial<ScoringPost> = {}): ScoringPost {
  const pub = new Date(Date.parse(asOf) - hoursAgo * 3_600_000).toISOString();
  const o1 = new Date(Date.parse(asOf) - 10 * 3_600_000).toISOString();
  const o2 = new Date(Date.parse(asOf) - 4 * 3_600_000).toISOString();
  return { postId: id, creatorId: creator, platform: 'tiktok', publishedAt: pub, snapshots: [{ observedAt: o1, views: v1 }, { observedAt: o2, views: v2 }], availability: 'available', rightsValid: true, linkApproved: true, stance: 'recommend', sponsoredStatus: 'unknown', isDuplicateOfOtherPost: false, creatorHistoryViews: [], ...extra };
}

describe('scoreVenue', () => {
  it('uygun küme filtreleri: pencere dışı, sponsor, eleştiri, onaysız bağlantı hariç', () => {
    const out = scoreVenue({ venueId: 'v', asOf, config, lastSuccessfulObservationAt: asOf, cohortFor: () => cohort, posts: [post('old', 'c1', 24 * 10, 0, 100), post('ad', 'c2', 30, 0, 100, { sponsoredStatus: 'declared' }), post('neg', 'c3', 30, 0, 100, { stance: 'avoid' }), post('rev', 'c4', 30, 0, 100, { linkApproved: false })] });
    expect(out.eligiblePosts).toBe(0);
    expect(out.status).toBe('insufficient_data');
    expect(out.excluded.map((e) => e.reason).sort()).toEqual(['link_not_approved', 'outside_window', 'sponsored_declared', 'stance_avoid']);
  });
  it('tek creator / tek snapshot → sayı yok; yeterli küme → ready, M cohort yüzdeliği, O yoksa baseline_partial', () => {
    const only = scoreVenue({ venueId: 'v', asOf, config, lastSuccessfulObservationAt: asOf, cohortFor: () => cohort, posts: [post('a', 'c1', 30, 0, 600), post('b', 'c1', 31, 0, 600), post('c', 'c1', 32, 0, 600)] });
    expect(only.score).toBeNull();
    expect(only.reasonCodes).toContain('only_one_independent_creator');
    const ready = scoreVenue({ venueId: 'v', asOf, config, lastSuccessfulObservationAt: asOf, cohortFor: () => cohort, posts: [post('a', 'c1', 30, 0, 6000), post('b', 'c2', 31, 0, 6000), post('c', 'c3', 40, 0, 6000)] });
    expect(ready.status).toBe('ready');
    expect(ready.components.momentum).toBeCloseTo(percentileRank(cohort.velocities, 1000)!, 5);
    expect(ready.baselinePartial).toBe(true);
    expect(ready.score).not.toBeNull();
    expect(ready.baselineScope).toBe('tiktok:24-72h:istanbul/coffee');
    expect(ready.evidenceSnapshotIds).toContain('a#0');
    expect(ready.accessibleViews).toBe(18000);
    // determinizm
    expect(scoreVenue({ venueId: 'v', asOf, config, lastSuccessfulObservationAt: asOf, cohortFor: () => cohort, posts: [post('a', 'c1', 30, 0, 6000), post('b', 'c2', 31, 0, 6000), post('c', 'c3', 40, 0, 6000)] })).toEqual(ready);
  });
  it('geriye düşen sayaç aralığı hız üretmez; eski gözlem → stale', () => {
    expect(bestVelocity([{ observedAt: '2026-09-13T00:00:00Z', views: 100 }, { observedAt: '2026-09-13T05:00:00Z', views: 50 }], config)).toEqual({ invalid: 'counter_reset_or_revision' });
    const stale = scoreVenue({ venueId: 'v', asOf, config, lastSuccessfulObservationAt: '2026-09-11T00:00:00Z', cohortFor: () => cohort, posts: [post('a', 'c1', 30, 0, 600), post('b', 'c2', 31, 0, 600), post('c', 'c3', 40, 0, 600)] });
    expect(stale.status).toBe('stale');
    expect(stale.trending).toBe(false);
  });
  it('yardımcılar: yaş kovası, yüzdelik mid-rank, winsorize, küçük cohort → null', () => {
    expect(ageBucketOf(10)).toBe('0-24h');
    expect(ageBucketOf(100)).toBe('72-168h');
    expect(percentileRank([1, 2, 2, 3], 2)).toBe(0.5);
    expect(Math.max(...winsorize([...Array.from({ length: 199 }, (_, i) => i), 100000]))).toBeLessThan(100000);
    expect(buildCohortTable('s', 'd', [1, 2], 100)).toBeNull();
  });
});
