/** Bütçe kapısı: policy dosyası + DB defteri → reserveBudget (saf) → DB'ye rezervasyon. Uzlaştırma iş sonunda. */
import { reserveBudget, dayKey, monthKey, type BudgetPolicy } from '@viral-places/pipeline';
import type { Ctx } from './handlers/types.ts';

export function budgetPolicyOf(ctx: Ctx): BudgetPolicy {
  const b = ctx.policy.budget;
  return { approvedBy: b.approvedBy, dailyHardLimitUsd: b.dailyHardLimitUsd, monthlyHardLimitUsd: b.monthlyHardLimitUsd, perJobMaxUsd: b.perJobMaxUsd, maxNewPostsPerDay: b.maxNewPostsPerDay, maxVideoMinutesPerDay: b.maxVideoMinutesPerDay, alertsAtFractions: b.alertsAtFractions, blockWhenUnset: b.blockWhenUnset, lateBillingBufferFraction: 0.15 };
}

export async function reserve(ctx: Ctx, req: { id: string; jobKind: string; estimatedUsd: number; newPosts: number; videoMinutes: number; outboxId: string | null; exempt?: boolean }): Promise<{ ok: true; reservationId: string } | { ok: false; code: string; detail: string }> {
  const nowIso = ctx.now();
  const day = dayKey(nowIso);
  if (ctx.dataMode === 'demo') return { ok: true, reservationId: `demo-${req.id}` }; // demo: ücretli sağlayıcı yok
  const ledgerDay = await ctx.db.getBudgetDay(day);
  const monthSpent = await ctx.db.getBudgetMonthSpentUsd(monthKey(nowIso));
  const decision = reserveBudget(budgetPolicyOf(ctx), { day, spentUsd: ledgerDay.spentUsd, newPosts: ledgerDay.newPosts, videoMinutes: ledgerDay.videoMinutes, reservations: ledgerDay.reservations.map((r) => ({ id: r.id, jobKind: r.jobKind, estimatedUsd: r.estimatedUsd, reservedAt: r.reservedAt, leaseUntil: r.leaseUntil, actualUsd: r.actualUsd, reconciledAt: r.reconciledAt })) }, { month: monthKey(nowIso), spentUsd: monthSpent }, { id: req.id, jobKind: req.jobKind, estimatedUsd: req.estimatedUsd, newPosts: req.newPosts, videoMinutes: req.videoMinutes, nowIso, ...(req.exempt ? { exemptFromBudget: true } : {}) });
  if (!decision.allowed) return { ok: false, code: decision.code, detail: decision.detail };
  await ctx.db.insertReservation(day, { id: decision.reservation.id, jobKind: req.jobKind, estimatedUsd: req.estimatedUsd, leaseUntil: decision.reservation.leaseUntil, outboxId: req.outboxId, newPosts: req.newPosts, videoMinutes: req.videoMinutes });
  for (const a of decision.alerts) ctx.log('warn', 'budget_alert', { fraction: a, day });
  return { ok: true, reservationId: decision.reservation.id };
}

export async function reconcile(ctx: Ctx, reservationId: string, actualUsd: number | null, cost: { kind: string; provider: string | null; unitKind: string; units: number; ref: Record<string, unknown> }): Promise<void> {
  if (ctx.dataMode === 'demo') return;
  await ctx.db.reconcileReservation(reservationId, actualUsd ?? 0);
  await ctx.db.insertCostEvent({ ...cost, microUsd: actualUsd === null ? null : Math.round(actualUsd * 1e6) });
}
