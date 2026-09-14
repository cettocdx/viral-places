import { describe, expect, it } from 'vitest';
import { buildDailyReport, expireStaleReservations, reconcileReservation, reserveBudget, type BudgetPolicy, type LedgerDay } from '../budget';
import { DEFAULT_POLLING_POLICY, dispatchDue, metricsRefreshIntervalHours, nextPollAfterFailure, nextPollAfterSuccess, type MonitoredAccount } from '../scheduler';

const now = '2026-09-13T12:00:00.000Z';
const policy: BudgetPolicy = { approvedBy: 'owner', dailyHardLimitUsd: 10, monthlyHardLimitUsd: 100, perJobMaxUsd: 2, maxNewPostsPerDay: 100, maxVideoMinutesPerDay: 30, alertsAtFractions: [0.5, 0.8, 1], blockWhenUnset: true, lateBillingBufferFraction: 0 };
const day: LedgerDay = { day: '2026-09-13', spentUsd: 4, newPosts: 10, videoMinutes: 5, reservations: [] };
const month = { month: '2026-09', spentUsd: 40 };

describe('reserveBudget', () => {
  it('limit bilinmiyorsa (null) ücretli iş yok; onay yoksa yok', () => {
    expect(reserveBudget({ ...policy, dailyHardLimitUsd: null }, day, month, { id: 'j', jobKind: 'extract', estimatedUsd: 0.1, newPosts: 0, videoMinutes: 0, nowIso: now })).toMatchObject({ allowed: false, code: 'budget_unset' });
    expect(reserveBudget({ ...policy, approvedBy: null }, day, month, { id: 'j', jobKind: 'extract', estimatedUsd: 0.1, newPosts: 0, videoMinutes: 0, nowIso: now })).toMatchObject({ allowed: false, code: 'budget_not_approved' });
  });
  it('rezervasyonlar hard limite sayılır; %50 uyarısı bir kez; hak silme muaf', () => {
    const r1 = reserveBudget(policy, day, month, { id: 'a', jobKind: 'extract', estimatedUsd: 1.5, newPosts: 1, videoMinutes: 0, nowIso: now });
    expect(r1.allowed && r1.alerts).toEqual([0.5]);
    const dayWithRes: LedgerDay = { ...day, reservations: r1.allowed ? [r1.reservation] : [] };
    const r2 = reserveBudget({ ...policy, perJobMaxUsd: 6 }, dayWithRes, month, { id: 'b', jobKind: 'extract', estimatedUsd: 5, newPosts: 1, videoMinutes: 0, nowIso: now });
    expect(r2).toMatchObject({ allowed: false, code: 'daily_exceeded' });
    expect(reserveBudget(policy, dayWithRes, month, { id: 'c', jobKind: 'takedown', estimatedUsd: 50, newPosts: 0, videoMinutes: 0, exemptFromBudget: true, nowIso: now }).allowed).toBe(true);
    expect(reserveBudget(policy, day, month, { id: 'd', jobKind: 'video', estimatedUsd: 3, newPosts: 0, videoMinutes: 1, nowIso: now })).toMatchObject({ code: 'per_job_exceeded' });
    expect(reserveBudget(policy, day, month, { id: 'e', jobKind: 'video', estimatedUsd: 0.1, newPosts: 0, videoMinutes: 26, nowIso: now })).toMatchObject({ code: 'daily_video_minutes_exceeded' });
  });
  it('uzlaştırma gerçekleşeni harcamaya yazar; crash rezervasyonu lease sonunda serbest kalır', () => {
    const r = reserveBudget(policy, day, month, { id: 'a', jobKind: 'x', estimatedUsd: 1, newPosts: 0, videoMinutes: 0, nowIso: now, leaseMinutes: 10 });
    const d1: LedgerDay = { ...day, reservations: r.allowed ? [r.reservation] : [] };
    const d2 = reconcileReservation(d1, 'a', 0.7, now);
    expect(d2.spentUsd).toBeCloseTo(4.7);
    expect(reconcileReservation(d2, 'a', 0.7, now).spentUsd).toBeCloseTo(4.7); // ikinci uzlaştırma çift saymaz
    const later = '2026-09-13T12:30:00.000Z';
    const { day: d3, expired } = expireStaleReservations(d1, later);
    expect(expired).toEqual(['a']);
    expect(d3.spentUsd).toBe(4);
    expect(buildDailyReport({ day: '2026-09-13', newPosts: 10, duplicates: 2, videoMinutes: 0, correctNewVenues: 4, aiCostUsd: 2, reviewCostUsd: 1, providerCostUsd: 1 }).costPerCorrectVenueUsd).toBe(1);
  });
});

describe('scheduler', () => {
  const acct = (id: string, extra: Partial<MonitoredAccount> = {}): MonitoredAccount => ({ accountId: id, platform: 'tiktok', enabled: true, nextPollAt: '2026-09-13T11:00:00.000Z', leaseUntil: null, postsLast30d: 20, lastPolledAt: null, consecutiveFailures: 0, rightsPolicyId: 'pol', ...extra });
  const live = { ...DEFAULT_POLLING_POLICY, liveIngestionEnabled: true };
  it('liveIngestion kapalıyken hiç seçim yok', () => {
    expect(dispatchDue([acct('a')], now, DEFAULT_POLLING_POLICY, 0).selected).toEqual([]);
  });
  it('vade + lease + hak + concurrency birlikte; deterministik sıra', () => {
    const r = dispatchDue([acct('c', { nextPollAt: '2026-09-13T11:30:00.000Z' }), acct('a'), acct('b', { leaseUntil: '2026-09-13T12:10:00.000Z' }), acct('d', { rightsPolicyId: null }), acct('e', { nextPollAt: '2026-09-13T13:00:00.000Z' }), acct('f', { enabled: false })], now, live, 0);
    expect(r.selected.map((s) => s.accountId)).toEqual(['a', 'c']);
    expect(r.skipped).toEqual(expect.arrayContaining([{ accountId: 'b', reason: 'leased' }, { accountId: 'd', reason: 'no_rights_policy' }, { accountId: 'e', reason: 'not_due' }, { accountId: 'f', reason: 'disabled' }]));
    expect(dispatchDue([acct('a'), acct('c')], now, live, 1).selected.length).toBe(1);
  });
  it('aktif 6 saat, az paylaşan 24 saat; retry üstel ve sınırlı; hak reddi retry almaz', () => {
    expect(nextPollAfterSuccess(acct('a'), now, live)).toBe('2026-09-13T18:00:00.000Z');
    expect(nextPollAfterSuccess(acct('a', { postsLast30d: 2 }), now, live)).toBe('2026-09-14T12:00:00.000Z');
    expect(nextPollAfterFailure(acct('a', { consecutiveFailures: 1 }), now, live, true)).toEqual({ nextPollAt: '2026-09-13T12:30:00.000Z', disabled: false });
    expect(nextPollAfterFailure(acct('a', { consecutiveFailures: 4 }), now, live, true).disabled).toBe(true);
    expect(nextPollAfterFailure(acct('a'), now, live, false).disabled).toBe(true);
    expect(metricsRefreshIntervalHours([10, 20], 10)).toBe(1);
    expect(metricsRefreshIntervalHours([10, 11], 10)).toBe(6);
    expect(metricsRefreshIntervalHours([], 200)).toBe(24);
  });
});
