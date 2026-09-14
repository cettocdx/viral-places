import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { ApiError, ok, parseOr422, readJson, route } from '@/lib/http';
import { serviceClient } from '@/lib/supabase';

const Body = z.object({ decision: z.enum(['approve', 'reject']), venueId: z.string().uuid().nullable().optional(), reason: z.string().max(500).optional() });

/** POST /admin/reviews/{id}/decision (§19.2): tek transaction (RPC) — mention + link + audit + venue.refresh işi. Skor elle değiştirilemez. */
export const POST = route(async (req, ctx: { params: Promise<{ id: string }> }, requestId) => {
  const { actorId } = requireAdmin(req);
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(422, 'VALIDATION_FAILED', 'id must be uuid');
  const body = parseOr422(Body, await readJson(req));
  const { data, error } = await serviceClient().rpc('decide_review_task', { p_task_id: id, p_decision: body.decision, p_venue_id: body.venueId ?? null, p_actor: actorId, p_reason: body.reason ?? null }).single();
  if (error) {
    const msg = String((error as { message?: string }).message ?? '');
    if (msg.includes('REVIEW_TASK_NOT_FOUND')) throw new ApiError(404, 'NOT_FOUND', 'Review task not found');
    if (msg.includes('REVIEW_TASK_CLOSED')) throw new ApiError(409, 'REVIEW_TASK_CLOSED', 'Task already decided');
    if (msg.includes('VENUE_REQUIRED')) throw new ApiError(422, 'VENUE_REQUIRED', 'approve requires venueId');
    throw error;
  }
  const t = data as { id: string; status: string; decision: unknown; decided_at: string };
  return ok({ requestId, taskId: t.id, status: t.status, decision: t.decision, decidedAt: t.decided_at }, requestId, { cache: 'private' });
});
