/**
 * Bütçe kapısı ve rezervasyon defteri (§27.4). Limit bilinmiyorsa ücretli iş yok. Rezervasyon → gerçekleşen uzlaştırma;
 * crash'te rezervasyon süresi dolar (lease). Hak silme/güvenlik işleri bütçe kesicisinden bağımsızdır.
 */
export interface BudgetPolicy {
  approvedBy: string | null;
  dailyHardLimitUsd: number | null;
  monthlyHardLimitUsd: number | null;
  perJobMaxUsd: number | null;
  maxNewPostsPerDay: number | null;
  maxVideoMinutesPerDay: number | null;
  alertsAtFractions: number[];
  blockWhenUnset: boolean;
  /** Gecikmeli faturalandıran sağlayıcılar için tampon (0–1, örn. 0.15). */
  lateBillingBufferFraction: number;
}

export interface Reservation {
  id: string;
  jobKind: string;
  estimatedUsd: number;
  reservedAt: string;
  leaseUntil: string;
  actualUsd: number | null;
  reconciledAt: string | null;
}

export interface LedgerDay {
  day: string; // YYYY-MM-DD (UTC)
  spentUsd: number;
  newPosts: number;
  videoMinutes: number;
  reservations: Reservation[];
}

export interface LedgerMonth {
  month: string; // YYYY-MM
  spentUsd: number;
}

export type BudgetDecision =
  | { allowed: true; reservation: Reservation; alerts: number[] }
  | { allowed: false; code: 'budget_unset' | 'budget_not_approved' | 'per_job_exceeded' | 'daily_exceeded' | 'monthly_exceeded' | 'daily_posts_exceeded' | 'daily_video_minutes_exceeded'; detail: string };

export interface JobCostRequest {
  id: string;
  jobKind: string;
  estimatedUsd: number;
  newPosts: number;
  videoMinutes: number;
  /** Hak silme / takedown / güvenlik: bütçe kesicisinden muaf (§27.4). */
  exemptFromBudget?: boolean;
  nowIso: string;
  leaseMinutes?: number;
}

export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function openReservedUsd(day: LedgerDay, nowIso: string): number {
  return day.reservations.filter((r) => r.reconciledAt === null && r.leaseUntil > nowIso).reduce((a, r) => a + r.estimatedUsd, 0);
}

/** Yeni ücretli iş için karar + rezervasyon. Defter değiştirilmez; çağıran katman döneni kalıcılaştırır. */
export function reserveBudget(policy: BudgetPolicy, day: LedgerDay, month: LedgerMonth, req: JobCostRequest): BudgetDecision {
  const lease = new Date(Date.parse(req.nowIso) + (req.leaseMinutes ?? 30) * 60_000).toISOString();
  const reservation: Reservation = { id: req.id, jobKind: req.jobKind, estimatedUsd: req.estimatedUsd, reservedAt: req.nowIso, leaseUntil: lease, actualUsd: null, reconciledAt: null };
  if (req.exemptFromBudget) return { allowed: true, reservation, alerts: [] };
  if (policy.blockWhenUnset && (policy.dailyHardLimitUsd === null || policy.perJobMaxUsd === null || policy.monthlyHardLimitUsd === null)) {
    return { allowed: false, code: 'budget_unset', detail: 'daily/monthly/perJob limit unknown' };
  }
  if (!policy.approvedBy) return { allowed: false, code: 'budget_not_approved', detail: 'approvedBy empty' };
  const perJob = policy.perJobMaxUsd ?? Number.POSITIVE_INFINITY;
  const daily = policy.dailyHardLimitUsd ?? Number.POSITIVE_INFINITY;
  const monthly = policy.monthlyHardLimitUsd ?? Number.POSITIVE_INFINITY;
  const buffered = req.estimatedUsd * (1 + policy.lateBillingBufferFraction);
  if (buffered > perJob) return { allowed: false, code: 'per_job_exceeded', detail: `${buffered.toFixed(4)} > ${perJob}` };
  const projectedDay = day.spentUsd + openReservedUsd(day, req.nowIso) + buffered;
  if (projectedDay > daily) return { allowed: false, code: 'daily_exceeded', detail: `${projectedDay.toFixed(4)} > ${daily}` };
  if (month.spentUsd + buffered > monthly) return { allowed: false, code: 'monthly_exceeded', detail: `${(month.spentUsd + buffered).toFixed(4)} > ${monthly}` };
  if (policy.maxNewPostsPerDay !== null && day.newPosts + req.newPosts > policy.maxNewPostsPerDay) return { allowed: false, code: 'daily_posts_exceeded', detail: `${day.newPosts + req.newPosts} > ${policy.maxNewPostsPerDay}` };
  if (policy.maxVideoMinutesPerDay !== null && day.videoMinutes + req.videoMinutes > policy.maxVideoMinutesPerDay) return { allowed: false, code: 'daily_video_minutes_exceeded', detail: `${day.videoMinutes + req.videoMinutes} > ${policy.maxVideoMinutesPerDay}` };
  const alerts = policy.alertsAtFractions.filter((f) => (day.spentUsd + openReservedUsd(day, req.nowIso)) / daily < f && projectedDay / daily >= f);
  return { allowed: true, reservation, alerts };
}

/** Gerçekleşen kullanım ile uzlaştırma: fark harcamaya işlenir; rezervasyon kapanır. */
export function reconcileReservation(day: LedgerDay, reservationId: string, actualUsd: number, nowIso: string): LedgerDay {
  const reservations = day.reservations.map((r) => (r.id === reservationId ? { ...r, actualUsd, reconciledAt: nowIso } : r));
  const wasOpen = day.reservations.some((r) => r.id === reservationId && r.reconciledAt === null);
  return { ...day, spentUsd: wasOpen ? day.spentUsd + actualUsd : day.spentUsd, reservations };
}

/** Süresi dolan (crash) rezervasyonlar: sonsuza dek kilitli kalmaz; tahmin harcama sayılmaz, yalnız serbest bırakılır ve işaretlenir. */
export function expireStaleReservations(day: LedgerDay, nowIso: string): { day: LedgerDay; expired: string[] } {
  const expired: string[] = [];
  const reservations = day.reservations.map((r) => {
    if (r.reconciledAt === null && r.leaseUntil <= nowIso) {
      expired.push(r.id);
      return { ...r, reconciledAt: nowIso, actualUsd: r.actualUsd ?? 0 };
    }
    return r;
  });
  return { day: { ...day, reservations }, expired };
}

/** Günlük rapor satırı (§27.4): doğru yayımlanan mekan başına maliyet; "harcama düştü ama doğruluk düştü" görünür kalır. */
export interface DailyReport {
  day: string;
  newPosts: number;
  duplicates: number;
  videoMinutes: number;
  correctNewVenues: number;
  aiCostUsd: number;
  reviewCostUsd: number;
  providerCostUsd: number;
  costPerCorrectVenueUsd: number | null;
}
export function buildDailyReport(input: Omit<DailyReport, 'costPerCorrectVenueUsd'>): DailyReport {
  const total = input.aiCostUsd + input.reviewCostUsd + input.providerCostUsd;
  return { ...input, costPerCorrectVenueUsd: input.correctNewVenues > 0 ? Number((total / input.correctNewVenues).toFixed(4)) : null };
}
