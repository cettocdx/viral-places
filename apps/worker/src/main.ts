/**
 * Outbox tüketicisi: claim (SKIP LOCKED + lease) → handler → finish (retry/backoff/dead). Zamanlayıcı tikleri (dispatch/cohort/bakım/import taraması) idempotent anahtarla kuyruğa girer.
 * Trigger.dev kararı (§9.1) alındığında bu döngü task'lara bölünür; sözleşme aynı kalır (job kind + payload + idempotency key).
 * Çalıştırma: DATABASE_URL=... pnpm --filter @viral-places/worker start   (tek geçiş: pnpm --filter @viral-places/worker once)
 */
import { buildAdapters } from './adapters.ts';
import { Db } from './db.ts';
import { env, loadPolicy } from './env.ts';
import { HANDLERS, JOB_KINDS } from './handlers/index.ts';
import type { Ctx } from './handlers/types.ts';

const SECRET_KEYS = ['SCRAPECREATORS_API_KEY', 'APIFY_TOKEN', 'ENSEMBLEDATA_TOKEN', 'IG_GRAPH_ACCESS_TOKEN', 'GOOGLE_PLACES_API_KEY', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'DATABASE_URL', 'APIFY_WEBHOOK_SECRET'];
function redact(s: string): string {
  let out = s;
  for (const k of SECRET_KEYS) {
    const v = process.env[k];
    if (v && v.length >= 6) out = out.split(v).join('[REDACTED]');
  }
  return out;
}
const log: Ctx['log'] = (level, msg, fields) => console.log(redact(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields })));

export function buildCtx(): Ctx {
  return { db: new Db(env.databaseUrl()), adapters: buildAdapters(), policy: loadPolicy(), now: () => new Date().toISOString(), log, dataMode: env.dataMode() };
}

/** Zamanlayıcı tikleri: 5 dk dispatch + import taraması; günlük cohort ve bakım. Anahtarlar zaman kovasına bağlı → tekrar üretmez. */
export async function scheduleTicks(ctx: Ctx): Promise<void> {
  const now = ctx.now();
  const fiveMin = `${now.slice(0, 13)}:${String(Math.floor(Number(now.slice(14, 16)) / 5) * 5).padStart(2, '0')}`;
  await ctx.db.enqueue('poll.dispatch', {}, `poll.dispatch:${fiveMin}`);
  for (const imp of await ctx.db.listQueuedImports(20)) await ctx.db.enqueue('import.process', { importId: imp.id }, `import.process:${imp.id}`);
  const day = now.slice(0, 10);
  await ctx.db.enqueue('cohorts.build', {}, `cohorts.build:${day}`);
  await ctx.db.enqueue('maintenance.daily', {}, `maintenance.daily:${day}`);
}

export async function runOnce(ctx: Ctx, batch: number): Promise<number> {
  const jobs = await ctx.db.claimJobs(batch, 300, JOB_KINDS);
  for (const job of jobs) {
    const handler = HANDLERS[job.kind];
    const started = Date.now();
    if (!handler) {
      await ctx.db.finishJob(job.id, false, { errorCode: 'unknown_kind', retryAfterSeconds: null });
      continue;
    }
    try {
      const r = await handler(ctx, job);
      if (r.ok) {
        await ctx.db.finishJob(job.id, true);
        log('info', 'job_done', { kind: job.kind, id: job.id, ms: Date.now() - started, note: r.note });
      } else {
        await ctx.db.finishJob(job.id, false, { errorCode: r.code, ...(r.detail !== undefined ? { errorDetail: r.detail } : {}), retryAfterSeconds: r.retryAfterSeconds === null ? null : r.retryAfterSeconds * 2 ** Math.max(0, job.attempt_count - 1), maxAttempts: ctx.policy.polling.maxControlledAttempts });
        log('warn', 'job_failed', { kind: job.kind, id: job.id, code: r.code, attempt: job.attempt_count, retryable: r.retryAfterSeconds !== null });
      }
    } catch (e) {
      const msg = redact(String((e as Error)?.message ?? e)).slice(0, 500);
      await ctx.db.finishJob(job.id, false, { errorCode: 'exception', errorDetail: msg, retryAfterSeconds: 120 * 2 ** Math.max(0, job.attempt_count - 1), maxAttempts: ctx.policy.polling.maxControlledAttempts });
      log('error', 'job_exception', { kind: job.kind, id: job.id, attempt: job.attempt_count, error: msg });
    }
  }
  return jobs.length;
}

async function main(): Promise<void> {
  const once = process.argv.includes('--once');
  const ctx = buildCtx();
  log('info', 'worker_start', { dataMode: ctx.dataMode, adapters: ctx.adapters.available(), liveIngestion: ctx.policy.features.liveIngestion, budgetApproved: !!ctx.policy.budget.approvedBy });
  let stopping = false;
  process.on('SIGINT', () => (stopping = true));
  process.on('SIGTERM', () => (stopping = true));
  let lastTick = 0;
  do {
    if (Date.now() - lastTick > 60_000) {
      await scheduleTicks(ctx);
      lastTick = Date.now();
    }
    const n = await runOnce(ctx, env.batchSize());
    if (once) break;
    if (n === 0) await new Promise((r) => setTimeout(r, env.pollIntervalMs()));
  } while (!stopping);
  await ctx.db.close();
  log('info', 'worker_stop', {});
}

if (process.argv[1] && /main\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(redact(String((e as Error)?.stack ?? e)));
    process.exit(1);
  });
}
