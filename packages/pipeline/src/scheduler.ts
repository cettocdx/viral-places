/**
 * Tarama dispatcher'ı (§13.3): 200 hesap için ayrı platform schedule yerine next_poll_at + sınırlı concurrency + lease.
 * Aktif creator 6 saatte bir; az paylaşan günde bir; sinyali artan gönderiler kısa süreli saatlik ölçüm.
 */
export interface MonitoredAccount {
  accountId: string;
  platform: 'tiktok' | 'instagram';
  enabled: boolean;
  nextPollAt: string | null;
  leaseUntil: string | null;
  /** Son 30 günde gözlenen gönderi sayısı (üretim sıklığı). */
  postsLast30d: number;
  lastPolledAt: string | null;
  consecutiveFailures: number;
  rightsPolicyId: string | null;
}

export interface PollingPolicy {
  activeIntervalHours: number; // 6
  lowFrequencyIntervalHours: number; // 24
  /** Aylık bu sayının altında paylaşan hesap "az paylaşan"dır. */
  lowFrequencyThresholdPostsPer30d: number; // 8
  maxConcurrentCreatorRuns: number; // 2
  leaseMinutes: number; // 20
  maxControlledAttempts: number; // 4
  backoffBaseMinutes: number; // 15
  liveIngestionEnabled: boolean;
}

export const DEFAULT_POLLING_POLICY: PollingPolicy = {
  activeIntervalHours: 6,
  lowFrequencyIntervalHours: 24,
  lowFrequencyThresholdPostsPer30d: 8,
  maxConcurrentCreatorRuns: 2,
  leaseMinutes: 20,
  maxControlledAttempts: 4,
  backoffBaseMinutes: 15,
  liveIngestionEnabled: false,
};

export function pollIntervalHours(a: MonitoredAccount, p: PollingPolicy): number {
  return a.postsLast30d < p.lowFrequencyThresholdPostsPer30d ? p.lowFrequencyIntervalHours : p.activeIntervalHours;
}

export function nextPollAfterSuccess(a: MonitoredAccount, nowIso: string, p: PollingPolicy): string {
  return new Date(Date.parse(nowIso) + pollIntervalHours(a, p) * 3_600_000).toISOString();
}

/** Kontrollü retry: 429/timeout için üstel; hak reddi/kimlik hatası retry almaz (§13.6). */
export function nextPollAfterFailure(a: MonitoredAccount, nowIso: string, p: PollingPolicy, retryable: boolean): { nextPollAt: string | null; disabled: boolean } {
  if (!retryable) return { nextPollAt: null, disabled: true };
  const attempts = a.consecutiveFailures + 1;
  if (attempts > p.maxControlledAttempts) return { nextPollAt: null, disabled: true };
  const minutes = p.backoffBaseMinutes * 2 ** (attempts - 1);
  return { nextPollAt: new Date(Date.parse(nowIso) + minutes * 60_000).toISOString(), disabled: false };
}

export interface DispatchResult {
  selected: Array<{ accountId: string; leaseUntil: string }>;
  skipped: Array<{ accountId: string; reason: 'not_due' | 'disabled' | 'leased' | 'no_rights_policy' | 'concurrency' | 'live_ingestion_off' }>;
}

/** Vadesi gelen hesapları seç; hesap başına tek aktif lease; toplam concurrency sınırı. Deterministik (nextPollAt sırası). */
export function dispatchDue(accounts: MonitoredAccount[], nowIso: string, p: PollingPolicy, currentlyRunning: number): DispatchResult {
  const selected: DispatchResult['selected'] = [];
  const skipped: DispatchResult['skipped'] = [];
  if (!p.liveIngestionEnabled) return { selected, skipped: accounts.map((a) => ({ accountId: a.accountId, reason: 'live_ingestion_off' as const })) };
  let slots = Math.max(0, p.maxConcurrentCreatorRuns - currentlyRunning);
  const leaseUntil = new Date(Date.parse(nowIso) + p.leaseMinutes * 60_000).toISOString();
  const ordered = [...accounts].sort((x, y) => (x.nextPollAt ?? '').localeCompare(y.nextPollAt ?? ''));
  for (const a of ordered) {
    if (!a.enabled) skipped.push({ accountId: a.accountId, reason: 'disabled' });
    else if (!a.rightsPolicyId) skipped.push({ accountId: a.accountId, reason: 'no_rights_policy' });
    else if (a.leaseUntil && a.leaseUntil > nowIso) skipped.push({ accountId: a.accountId, reason: 'leased' });
    else if (a.nextPollAt && a.nextPollAt > nowIso) skipped.push({ accountId: a.accountId, reason: 'not_due' });
    else if (slots <= 0) skipped.push({ accountId: a.accountId, reason: 'concurrency' });
    else {
      selected.push({ accountId: a.accountId, leaseUntil });
      slots -= 1;
    }
  }
  return { selected, skipped };
}

/** Sinyali artan gönderi için kısa süreli saatlik metrik ölçümü (§13.3): son 48 saatte hız artıyorsa 1 saat, değilse 6 saat. */
export function metricsRefreshIntervalHours(recentVelocities: number[], ageHours: number): number {
  if (ageHours > 7 * 24) return 24;
  const last = recentVelocities.at(-1);
  const prev = recentVelocities.at(-2);
  if (last !== undefined && prev !== undefined && last > prev * 1.5 && ageHours <= 48) return 1;
  return 6;
}
