import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { ok, parseOr422, readJson, route } from '@/lib/http';
import { serviceClient } from '@/lib/supabase';

const KINDS = ['poll.dispatch', 'poll.account', 'metrics.refresh', 'post.extract', 'mention.resolve', 'venue.refresh', 'cohorts.build', 'import.process', 'maintenance.daily'] as const;
const Body = z.object({ kind: z.enum(KINDS), payload: z.record(z.string(), z.unknown()).default({}), idempotencyKey: z.string().min(8).max(200) });

/** POST /internal/jobs/dispatch (§19.2): idempotent iş kuyruğu girişi; worker tüketir. */
export const POST = route(async (req, _ctx, requestId) => {
  requireAdmin(req);
  const body = parseOr422(Body, await readJson(req));
  const { data, error } = await serviceClient().rpc('enqueue_job', { p_kind: body.kind, p_payload: body.payload, p_idempotency_key: body.idempotencyKey, p_correlation_id: null, p_run_after: new Date().toISOString() }).single();
  if (error) throw error;
  const r = data as { job_id: string; inserted: boolean };
  return ok({ requestId, jobId: r.job_id, inserted: r.inserted }, requestId, { status: r.inserted ? 202 : 200, cache: 'private' });
});

export const GET = route(async (req, _ctx, requestId) => {
  requireAdmin(req);
  const { data, error } = await serviceClient().rpc('admin_job_stats');
  if (error) throw error;
  return ok({ requestId, stats: data ?? [] }, requestId, { cache: 'private' });
});
