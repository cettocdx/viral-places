import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeViralScore, isTrending, roundScore, viewVelocity, type EligibilityInput, type TrendConfig } from './index';

const policy = JSON.parse(readFileSync(resolve(__dirname, '../../../config/pipeline-policy.example.json'), 'utf8'));
const vectors = JSON.parse(readFileSync(resolve(__dirname, '../../../config/score-test-vectors.json'), 'utf8'));
const config: TrendConfig = policy.trend;

const passing: EligibilityInput = {
  eligiblePosts: 5,
  distinctCreators: 3,
  momentumCoverage: 1,
  lastObservationAgeHours: 2,
  cohortObservations: 200,
};

describe('score arithmetic vs config/score-test-vectors.json', () => {
  for (const v of vectors.vectors as Array<{ id: string; components: { M: number | null; D: number; F: number; O: number | null }; eligibilityPass: boolean; expectedScore: number | null; expectedFlag?: string; reason?: string }>) {
    it(`${v.id} -> ${v.expectedScore}`, () => {
      const elig: EligibilityInput = v.eligibilityPass
        ? passing
        : v.reason === 'only_one_independent_creator'
          ? { ...passing, distinctCreators: 1 }
          : { ...passing, momentumCoverage: 0 };
      const r = computeViralScore(v.components, elig, config);
      expect(r.score).toBe(v.expectedScore);
      if (v.expectedFlag === 'baseline_partial') expect(r.baselinePartial).toBe(true);
      if (!v.eligibilityPass) expect(r.status).toBe('insufficient_data');
    });
  }
});

describe('gates and status', () => {
  it('V06: observation 25h old -> stale, no trending badge', () => {
    const r = computeViralScore({ M: 0.8, D: 1, F: 0.9, O: 0.6 }, { ...passing, lastObservationAgeHours: 25 }, config);
    expect(r.status).toBe('stale');
    expect(r.score).not.toBeNull();
    expect(isTrending(r, 3, 10, config)).toBe(false);
  });
  it('V08: score 80 but M=.60 -> not trending', () => {
    const r = computeViralScore({ M: 0.6, D: 1, F: 1, O: 1 }, passing, config);
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(isTrending(r, 3, 10, config)).toBe(false);
  });
  it('V09: score>=75, M=.80, 3 creators, new post 24h -> trending', () => {
    const r = computeViralScore({ M: 0.8, D: 1, F: 1, O: 0.5 }, passing, config);
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(isTrending(r, 3, 24, config)).toBe(true);
  });
  it('withheld when rights/health blocked', () => {
    const r = computeViralScore({ M: 0.9, D: 1, F: 1, O: 1 }, { ...passing, rightsOrHealthBlocked: true }, config);
    expect(r.status).toBe('withheld');
    expect(r.score).toBeNull();
  });
  it('deterministic: same input twice gives identical output', () => {
    const a = computeViralScore({ M: 0.8, D: 0.5, F: 0.9, O: 0.6 }, passing, config);
    const b = computeViralScore({ M: 0.8, D: 0.5, F: 0.9, O: 0.6 }, passing, config);
    expect(a).toEqual(b);
  });
});

describe('velocity', () => {
  it('V05: counter dropping 10000 -> 8000 is an anomaly, not zero velocity', () => {
    const r = viewVelocity({ observedAt: '2026-09-10T00:00:00Z', views: 10000 }, { observedAt: '2026-09-10T06:00:00Z', views: 8000 });
    expect(r).toEqual({ kind: 'invalid', reason: 'counter_reset_or_revision' });
  });
  it('null counter is invalid; single snapshot is invalid', () => {
    expect(viewVelocity({ observedAt: '2026-09-10T00:00:00Z', views: null }, { observedAt: '2026-09-10T06:00:00Z', views: 10 }).kind).toBe('invalid');
    expect(viewVelocity({ observedAt: '2026-09-10T00:00:00Z', views: 5 }, { observedAt: '2026-09-10T00:00:00Z', views: 10 }).kind).toBe('invalid');
  });
  it('valid pair produces views/hour', () => {
    const r = viewVelocity({ observedAt: '2026-09-10T00:00:00Z', views: 1000 }, { observedAt: '2026-09-10T04:00:00Z', views: 1800 });
    expect(r).toEqual({ kind: 'ok', viewsPerHour: 200, elapsedHours: 4 });
  });
});

describe('rounding', () => {
  it('floor(x+0.5)', () => {
    expect(roundScore(71.5)).toBe(72);
    expect(roundScore(71.49)).toBe(71);
  });
});
