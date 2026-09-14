import { describe, expect, it } from 'vitest';
import { estimatePollCostUsd } from '../src/handlers/poll.ts';
import { scopeKeys } from '../src/handlers/venue.ts';
import { runOnce, scheduleTicks } from '../src/main.ts';
import type { Ctx } from '../src/handlers/types.ts';

describe('scopeKeys', () => {
  it('şehir/kategori → global/kategori → global sırası (§17.4 referans grubu)', () => {
    expect(scopeKeys('tiktok', '24-72h', 'c1', 'food')).toEqual(['tiktok:24-72h:c1/food', 'tiktok:24-72h:global/food', 'tiktok:24-72h:global']);
    expect(scopeKeys('instagram', '0-24h', null, null)).toEqual(['instagram:0-24h:global']);
  });
});

describe('estimatePollCostUsd', () => {
  it('fixture/graph ücretsiz; fiyat env yoksa null (ücretli iş planlanmaz)', () => {
    expect(estimatePollCostUsd('fixture', 100)).toBe(0);
    expect(estimatePollCostUsd('instagram_graph', 100)).toBe(0);
    delete process.env.PRICE_SCRAPECREATORS_USD_PER_CREDIT;
    expect(estimatePollCostUsd('scrapecreators', 100)).toBeNull();
    process.env.PRICE_SCRAPECREATORS_USD_PER_CREDIT = '0.002';
    expect(estimatePollCostUsd('scrapecreators', 100)).toBeCloseTo(0.01);
    expect(estimatePollCostUsd('apify', 100)).toBeNull();
  });
});

function fakeCtx(overrides: Partial<Record<string, unknown>> = {}): { ctx: Ctx; calls: string[] } {
  const calls: string[] = [];
  const db = {
    enqueue: async (kind: string, _p: unknown, key: string) => { calls.push(`enqueue:${kind}:${key}`); return { jobId: 'j', inserted: true }; },
    listQueuedImports: async () => [{ id: 'imp1' }],
    claimJobs: async () => [{ id: 'job1', kind: 'unknown.kind', payload: {}, attempt_count: 1, correlation_id: null, idempotency_key: 'k' }],
    finishJob: async (id: string, ok: boolean, opts?: { errorCode?: string; retryAfterSeconds?: number | null }) => { calls.push(`finish:${id}:${ok}:${opts?.errorCode ?? ''}:${opts?.retryAfterSeconds ?? 'null'}`); },
    ...overrides,
  };
  const ctx = { db, adapters: { get: () => null, primaryFor: () => null, available: () => [], scrapeCreators: null, apify: null }, policy: { features: { liveIngestion: false, autoPublish: false }, polling: { maxControlledAttempts: 4, proposalIntervalHours: 6, maxConcurrentCreatorRuns: 2, sampleLiveCreatorsMax: 20 } }, now: () => '2026-09-13T12:07:00.000Z', log: () => {}, dataMode: 'demo' } as unknown as Ctx;
  return { ctx, calls };
}

describe('scheduleTicks / runOnce', () => {
  it('tik anahtarları zaman kovasına bağlı (5 dk dispatch, günlük cohort/bakım) ve kuyruktaki importlar işe dönüşür', async () => {
    const { ctx, calls } = fakeCtx();
    await scheduleTicks(ctx);
    expect(calls).toEqual(['enqueue:poll.dispatch:poll.dispatch:2026-09-13T12:05', 'enqueue:import.process:import.process:imp1', 'enqueue:cohorts.build:cohorts.build:2026-09-13', 'enqueue:maintenance.daily:maintenance.daily:2026-09-13']);
  });
  it('bilinmeyen iş türü retry almadan kapanır (dead)', async () => {
    const { ctx, calls } = fakeCtx();
    const n = await runOnce(ctx, 5);
    expect(n).toBe(1);
    expect(calls).toContain('finish:job1:false:unknown_kind:null');
  });
  it('handler hatası üstel backoff ile failed; başarılı iş done', async () => {
    const { ctx, calls } = fakeCtx({ claimJobs: async () => [{ id: 'job2', kind: 'poll.dispatch', payload: {}, attempt_count: 2, correlation_id: null, idempotency_key: 'k' }], listMonitoring: async () => { throw new Error('db down'); } });
    await runOnce(ctx, 5);
    expect(calls.find((c) => c.startsWith('finish:job2'))).toBe('finish:job2:false:exception:240');
    const ok = fakeCtx({ claimJobs: async () => [{ id: 'job3', kind: 'poll.dispatch', payload: {}, attempt_count: 1, correlation_id: null, idempotency_key: 'k' }], listMonitoring: async () => [], leaseMonitoring: async () => true });
    await runOnce(ok.ctx, 5);
    expect(ok.calls).toContain('finish:job3:true::null');
  });
});
