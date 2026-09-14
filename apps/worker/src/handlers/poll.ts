/** Tarama işleri (§13.3): poll.dispatch → poll.account → metrics.refresh; Apify webhook → ingest.provider_event. */
import { DEFAULT_POLLING_POLICY, ProviderError, dispatchDue, metricsRefreshIntervalHours, nextPollAfterFailure, nextPollAfterSuccess, type MonitoredAccount, type PollingPolicy, type SocialSourceAdapter } from '@viral-places/pipeline';
import { mayPerform } from '@viral-places/policy';
const policyMayPerform = mayPerform;
import { reconcile, reserve } from '../budget-gate.ts';
import { env } from '../env.ts';
import { ingestPage } from './ingest.ts';
import { RETRY, type Ctx, type Handler } from './types.ts';

function pollingPolicy(ctx: Ctx): PollingPolicy {
  return { ...DEFAULT_POLLING_POLICY, activeIntervalHours: ctx.policy.polling.proposalIntervalHours, maxConcurrentCreatorRuns: ctx.policy.polling.maxConcurrentCreatorRuns, maxControlledAttempts: ctx.policy.polling.maxControlledAttempts, liveIngestionEnabled: ctx.policy.features.liveIngestion || ctx.dataMode === 'demo' };
}

/** Sağlayıcı fiyat kartından tahmin; birim bilinmiyorsa null → ücretli iş yok (§27.4). Demo/fixture ücretsiz. */
export function estimatePollCostUsd(provider: string, maxPosts: number): number | null {
  if (provider === 'fixture' || provider === 'instagram_graph') return 0;
  if (provider === 'scrapecreators') {
    const p = env.priceScrapeCreatorsPerCredit();
    return p === null ? null : Math.ceil(maxPosts / 20) * p;
  }
  if (provider === 'ensembledata') {
    const p = env.priceEnsemblePerUnit();
    return p === null ? null : Math.ceil(maxPosts / 10) * p;
  }
  if (provider === 'apify') return null; // sonuç başına fiyat plan kademesine bağlı; run sonrası usageTotalUsd ile uzlaştırılır — ön tahmin için PRICE_APIFY_USD_PER_RESULT eklenmeli
  return null;
}

export const pollDispatch: Handler = async (ctx) => {
  const rows = await ctx.db.listMonitoring();
  const now = ctx.now();
  const accounts: MonitoredAccount[] = rows.map((r) => ({ accountId: r.account_id, platform: r.platform, enabled: r.enabled, nextPollAt: r.next_poll_at, leaseUntil: r.lease_until, postsLast30d: r.posts_last_30d, lastPolledAt: r.last_polled_at, consecutiveFailures: r.consecutive_failures, rightsPolicyId: r.rights_policy_id }));
  const running = accounts.filter((a) => a.leaseUntil && a.leaseUntil > now).length;
  const d = dispatchDue(accounts, now, pollingPolicy(ctx), running);
  let queued = 0;
  for (const s of d.selected) {
    if (!(await ctx.db.leaseMonitoring(s.accountId, s.leaseUntil))) continue;
    const r = await ctx.db.enqueue('poll.account', { accountId: s.accountId, leaseUntil: s.leaseUntil }, `poll.account:${s.accountId}:${s.leaseUntil}`);
    if (r.inserted) queued += 1;
  }
  return { ok: true, note: `queued=${queued} skipped=${d.skipped.length}` };
};

export const pollAccount: Handler = async (ctx, job) => {
  const accountId = String(job.payload.accountId ?? '');
  const row = (await ctx.db.listMonitoring()).find((r) => r.account_id === accountId);
  if (!row) return { ok: false, code: 'account_not_found', retryAfterSeconds: RETRY.none };
  const pp = pollingPolicy(ctx);
  const acct: MonitoredAccount = { accountId, platform: row.platform, enabled: row.enabled, nextPollAt: row.next_poll_at, leaseUntil: row.lease_until, postsLast30d: row.posts_last_30d, lastPolledAt: row.last_polled_at, consecutiveFailures: row.consecutive_failures, rightsPolicyId: row.rights_policy_id };
  const rights = await ctx.db.getRights(row.rights_policy_id);
  if (!policyMayPerform(rights, 'may_collect_metadata', ctx.now())) {
    await ctx.db.updateMonitoringAfterPoll(accountId, { nextPollAt: null, consecutiveFailures: row.consecutive_failures, lastErrorCode: 'rights_denied', disabledReason: 'may_collect_metadata=false' });
    return { ok: true, note: 'rights_denied' };
  }
  const adapter: SocialSourceAdapter | null = ctx.dataMode === 'demo' ? ctx.adapters.get('fixture') : (ctx.adapters.get(row.provider) ?? ctx.adapters.primaryFor(row.platform));
  if (!adapter) {
    await ctx.db.updateMonitoringAfterPoll(accountId, { nextPollAt: nextPollAfterSuccess(acct, ctx.now(), pp), consecutiveFailures: row.consecutive_failures, lastErrorCode: 'provider_unavailable' });
    return { ok: true, note: 'no_adapter' };
  }
  const firstScan = row.watermark.newestPublishedAt === null;
  const maxPosts = Math.min(firstScan ? 100 : 30, ctx.policy.polling.sampleLiveCreatorsMax > 0 ? 100 : 30);
  const estimate = estimatePollCostUsd(adapter.provider, maxPosts);
  if (estimate === null && ctx.dataMode !== 'demo') {
    await ctx.db.updateMonitoringAfterPoll(accountId, { nextPollAt: nextPollAfterSuccess(acct, ctx.now(), pp), consecutiveFailures: row.consecutive_failures, lastErrorCode: 'budget_unset' });
    return { ok: true, note: 'price_unit_unknown' };
  }
  const res = await reserve(ctx, { id: `poll-${job.id}`, jobKind: 'provider.poll', estimatedUsd: estimate ?? 0, newPosts: 0, videoMinutes: 0, outboxId: job.id });
  if (!res.ok) {
    await ctx.db.updateMonitoringAfterPoll(accountId, { nextPollAt: nextPollAfterSuccess(acct, ctx.now(), pp), consecutiveFailures: row.consecutive_failures, lastErrorCode: res.code });
    return { ok: true, note: `budget:${res.code}` };
  }
  const newerThan = row.watermark.newestPublishedAt ? new Date(Date.parse(row.watermark.newestPublishedAt) - 24 * 3_600_000).toISOString() : null;
  try {
    const page = await adapter.listRecentPosts({ platform: row.platform, handle: row.handle, platformCreatorId: row.platform_user_id, maxPosts, newerThan, cursor: null, rightsPolicyId: row.rights_policy_id ?? 'deny-by-default', dataMode: ctx.dataMode === 'demo' ? 'synthetic' : 'live' });
    const runUuid = await ctx.db.createProviderRun({ provider: adapter.provider, runId: page.providerRunId, platform: row.platform, accountId, status: 'succeeded', costMicroUsd: page.costMicroUsd, correlationId: job.id });
    const stats = await ingestPage(ctx, accountId, page, row.watermark, runUuid);
    await ctx.db.createProviderRun({ provider: adapter.provider, runId: page.providerRunId, platform: row.platform, accountId, status: 'succeeded', costMicroUsd: page.costMicroUsd, stats: { seen: stats.seen, new: stats.new, edited: stats.edited, rejected: stats.rejected, coverageGap: stats.coverageGap }, correlationId: job.id });
    await reconcile(ctx, res.reservationId, page.costMicroUsd === null ? null : page.costMicroUsd / 1e6, { kind: 'provider.poll', provider: adapter.provider, unitKind: 'run', units: 1, ref: { runId: page.providerRunId, accountId, seen: stats.seen } });
    const postsLast30d = await ctx.db.countPostsLast30d(accountId);
    await ctx.db.updateMonitoringAfterPoll(accountId, { watermark: stats.nextWatermark, nextPollAt: nextPollAfterSuccess({ ...acct, postsLast30d }, ctx.now(), pp), postsLast30d, consecutiveFailures: 0, lastErrorCode: null });
    // Metrik yenileme: aktif pencere gönderileri için ayrı iş (§13.3: sinyali artan gönderiye saatlik ölçüm)
    const hours = metricsRefreshIntervalHours([], 0);
    const runAfter = new Date(Date.parse(ctx.now()) + hours * 3_600_000).toISOString();
    await ctx.db.enqueue('metrics.refresh', { accountId }, `metrics.refresh:${accountId}:${runAfter.slice(0, 13)}`, job.id, runAfter);
    return { ok: true, note: `seen=${stats.seen} new=${stats.new} edited=${stats.edited} extract=${stats.extractQueued} gap=${stats.coverageGap}` };
  } catch (e) {
    const pe = e instanceof ProviderError ? e : null;
    await reconcile(ctx, res.reservationId, null, { kind: 'provider.poll_failed', provider: adapter.provider, unitKind: 'run', units: 1, ref: { accountId, code: pe?.code ?? 'unknown' } });
    const next = nextPollAfterFailure(acct, ctx.now(), pp, pe?.retryable ?? false);
    await ctx.db.updateMonitoringAfterPoll(accountId, { nextPollAt: next.nextPollAt, consecutiveFailures: row.consecutive_failures + 1, lastErrorCode: pe?.code ?? 'unknown', disabledReason: next.disabled ? `poll_failed:${pe?.code ?? 'unknown'}` : null });
    await ctx.db.createProviderRun({ provider: adapter.provider, runId: `failed-${job.id}`, platform: row.platform, accountId, status: 'failed', costMicroUsd: null, errorCode: pe?.code ?? 'unknown', correlationId: job.id });
    // Yeniden deneme hesap programında (next_poll_at) yapılır; iş kuyruğu tekrar denemez → retry çarpanı yok (vp-source-ingestion)
    return { ok: true, note: `provider_failed:${pe?.code ?? 'unknown'}` };
  }
};

export const metricsRefresh: Handler = async (ctx, job) => {
  const accountId = String(job.payload.accountId ?? '');
  const row = (await ctx.db.listMonitoring()).find((r) => r.account_id === accountId);
  if (!row) return { ok: false, code: 'account_not_found', retryAfterSeconds: RETRY.none };
  const rights = await ctx.db.getRights(row.rights_policy_id);
  if (!mayPerform(rights, 'may_store_metrics', ctx.now())) return { ok: true, note: 'rights_denied' };
  const adapter = ctx.dataMode === 'demo' ? ctx.adapters.get('fixture') : (ctx.adapters.get(row.provider) ?? ctx.adapters.primaryFor(row.platform));
  if (!adapter) return { ok: true, note: 'no_adapter' };
  const windowStart = new Date(Date.parse(ctx.now()) - ctx.policy.trend.windowDays * 86_400_000).toISOString();
  const posts = await ctx.db.postsForAccountInWindow(accountId, windowStart);
  const due = posts.filter((p) => !p.last_observed_at || Date.parse(ctx.now()) - Date.parse(p.last_observed_at) >= 3_600_000);
  if (due.length === 0) return { ok: true, note: 'nothing_due' };
  const estimate = adapter.provider === 'scrapecreators' ? (env.priceScrapeCreatorsPerCredit() === null ? null : due.length * env.priceScrapeCreatorsPerCredit()!) : adapter.provider === 'fixture' || adapter.provider === 'instagram_graph' ? 0 : null;
  if (estimate === null && ctx.dataMode !== 'demo') return { ok: true, note: 'price_unit_unknown' };
  const res = await reserve(ctx, { id: `metrics-${job.id}`, jobKind: 'provider.metrics', estimatedUsd: estimate ?? 0, newPosts: 0, videoMinutes: 0, outboxId: job.id });
  if (!res.ok) return { ok: true, note: `budget:${res.code}` };
  try {
    const obs = await adapter.refreshMetrics({ platform: row.platform, posts: due.map((p) => ({ platformPostId: p.platform_post_id, canonicalUrl: p.canonical_url })), rightsPolicyId: row.rights_policy_id ?? 'deny-by-default', dataMode: ctx.dataMode === 'demo' ? 'synthetic' : 'live' });
    const byId = new Map(due.map((p) => [p.platform_post_id, p.id]));
    const touched = new Set<string>();
    for (const o of obs) {
      const postId = byId.get(o.platformPostId);
      if (!postId) continue;
      await ctx.db.insertMetrics(postId, null, o.observedAt, { views: o.views, likes: o.likes, comments: o.comments, shares: o.shares, saves: o.saves });
      for (const v of await ctx.db.venuesLinkedToPost(postId)) touched.add(v);
    }
    await reconcile(ctx, res.reservationId, estimate, { kind: 'provider.metrics', provider: adapter.provider, unitKind: 'request', units: due.length, ref: { accountId, observed: obs.length } });
    for (const venueId of touched) await ctx.db.enqueue('venue.refresh', { venueId, reason: 'metrics' }, `venue.refresh:${venueId}:${ctx.now().slice(0, 13)}`, job.id);
    const next = new Date(Date.parse(ctx.now()) + 6 * 3_600_000).toISOString();
    await ctx.db.enqueue('metrics.refresh', { accountId }, `metrics.refresh:${accountId}:${next.slice(0, 13)}`, job.id, next);
    return { ok: true, note: `observed=${obs.length} venues=${touched.size}` };
  } catch (e) {
    const pe = e instanceof ProviderError ? e : null;
    await reconcile(ctx, res.reservationId, null, { kind: 'provider.metrics_failed', provider: adapter.provider, unitKind: 'request', units: 0, ref: { accountId, code: pe?.code } });
    return pe?.retryable ? { ok: false, code: pe.code, retryAfterSeconds: RETRY.provider } : { ok: true, note: `provider_failed:${pe?.code ?? 'unknown'}` };
  }
};

/** Apify webhook sonrası (§13.5 madde 6): run kimliği sağlayıcı API'siyle doğrulanır; posts hesaplara göre dağıtılır. */
export const ingestProviderEvent: Handler = async (ctx, job) => {
  const inboxId = String(job.payload.inboxId ?? '');
  const runId = String(job.payload.runId ?? '');
  const eventType = String(job.payload.eventType ?? '');
  const inbox = await ctx.db.getInbox(inboxId);
  if (!inbox) return { ok: false, code: 'inbox_not_found', retryAfterSeconds: RETRY.none };
  if (inbox.processedAt) return { ok: true, note: 'already_processed' };
  if (eventType !== 'ACTOR.RUN.SUCCEEDED') {
    await ctx.db.createProviderRun({ provider: 'apify', runId, platform: null, accountId: null, status: 'failed', costMicroUsd: null, errorCode: eventType, correlationId: inboxId });
    await ctx.db.markInboxProcessed(inboxId);
    return { ok: true, note: `run_${eventType}` };
  }
  const apify = ctx.adapters.apify;
  if (!apify) return { ok: false, code: 'apify_not_configured', retryAfterSeconds: RETRY.none };
  const actId = String(((inbox.payload.eventData as Record<string, unknown> | undefined)?.actorId ?? (inbox.payload.resource as Record<string, unknown> | undefined)?.actId ?? ''));
  const platform: 'tiktok' | 'instagram' = /instagram/i.test(actId) ? 'instagram' : 'tiktok';
  try {
    const page = await apify.collectRun(runId, { platform, rightsPolicyId: 'apify-run', dataMode: 'live' });
    const runUuid = await ctx.db.createProviderRun({ provider: 'apify', runId, platform, accountId: null, status: 'succeeded', costMicroUsd: page.costMicroUsd, correlationId: inboxId });
    const byCreator = new Map<string, typeof page.posts>();
    for (const p of page.posts) byCreator.set(p.platformCreatorId, [...(byCreator.get(p.platformCreatorId) ?? []), p]);
    let totalNew = 0;
    for (const [creatorId, posts] of byCreator) {
      const account = await ctx.db.findAccountByPlatformId(platform, creatorId);
      if (!account) {
        ctx.log('warn', 'unknown_creator_in_run', { creatorId, platform, runId });
        continue;
      }
      const mon = (await ctx.db.listMonitoring()).find((m) => m.account_id === account.id);
      const rights = await ctx.db.getRights(mon?.rights_policy_id ?? null);
      if (!mayPerform(rights, 'may_collect_metadata', ctx.now())) continue;
      const stats = await ingestPage(ctx, account.id, { ...page, posts: posts.map((p) => ({ ...p, rightsPolicyId: mon!.rights_policy_id! })) }, mon?.watermark ?? { newestPublishedAt: null, seenIds: [] }, runUuid);
      totalNew += stats.new;
      await ctx.db.updateMonitoringAfterPoll(account.id, { watermark: stats.nextWatermark, nextPollAt: mon?.next_poll_at ?? null, consecutiveFailures: 0, lastErrorCode: null });
    }
    if (page.costMicroUsd !== null) await ctx.db.insertCostEvent({ kind: 'provider.run', provider: 'apify', unitKind: 'run', units: 1, microUsd: page.costMicroUsd, ref: { runId } });
    await ctx.db.markInboxProcessed(inboxId);
    return { ok: true, note: `posts=${page.posts.length} new=${totalNew}` };
  } catch (e) {
    const pe = e instanceof ProviderError ? e : null;
    return pe?.retryable ? { ok: false, code: pe.code, retryAfterSeconds: RETRY.provider } : { ok: false, code: pe?.code ?? 'unknown', detail: (e as Error).message, retryAfterSeconds: RETRY.none };
  }
};
