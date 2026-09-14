import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ApiError, ok, parseOr422, readJson, route } from '@/lib/http';
import { planDto } from '../route';

const Params = z.object({ id: z.string().uuid() });
const PatchBody = z.object({
  expectedRevision: z.number().int().min(1),
  title: z.string().trim().min(1).max(80).optional(),
  dateLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timezone: z.string().min(1).max(64).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, ctx, requestId) => {
  const { db } = await requireUser(req);
  const { id } = parseOr422(Params, await ctx.params);
  const [p, items] = await Promise.all([
    db.from('plans').select('*').eq('id', id).maybeSingle(),
    db.from('plan_items').select('id, venue_id, position, intended_time, duration_minutes, note').eq('plan_id', id).order('position'),
  ]);
  if (p.error) throw p.error;
  if (items.error) throw items.error;
  if (!p.data) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
  return ok({ requestId, ...planDto(p.data), items: (items.data ?? []).map((i) => ({ id: i.id, venueId: i.venue_id, position: i.position, intendedTime: i.intended_time, durationMinutes: i.duration_minutes, note: i.note })) }, requestId, { cache: 'private' });
});

/** Optimistic concurrency: expectedRevision eşleşmezse 409 (§19.4 / §20). */
export const PATCH = route<Ctx>(async (req, ctx, requestId) => {
  const { db } = await requireUser(req);
  const { id } = parseOr422(Params, await ctx.params);
  const body = parseOr422(PatchBody, await readJson(req));
  const patch: Record<string, unknown> = { revision: body.expectedRevision + 1 };
  if (body.title !== undefined) patch.title = body.title;
  if (body.dateLocal !== undefined) patch.date_local = body.dateLocal;
  if (body.timezone !== undefined) patch.timezone = body.timezone;
  const { data, error } = await db.from('plans').update(patch).eq('id', id).eq('revision', body.expectedRevision).select('*').maybeSingle();
  if (error) throw error;
  if (!data) {
    const exists = await db.from('plans').select('id').eq('id', id).maybeSingle();
    if (!exists.data) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
    throw new ApiError(409, 'PLAN_REVISION_CONFLICT', 'Plan was modified elsewhere; reload and retry');
  }
  return ok({ requestId, ...planDto(data) }, requestId, { cache: 'private' });
});

export const DELETE = route<Ctx>(async (req, ctx, requestId) => {
  const { db } = await requireUser(req);
  const { id } = parseOr422(Params, await ctx.params);
  const { error, count } = await db.from('plans').delete({ count: 'exact' }).eq('id', id);
  if (error) throw error;
  if (!count) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
  return ok({ requestId, deleted: true }, requestId, { cache: 'private' });
});
