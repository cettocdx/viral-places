import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, parseOr422, readJson, route } from '@/lib/http';

const Params = z.object({ id: z.string().uuid() });
const AddBody = z.object({ venueId: z.string().uuid(), expectedRevision: z.number().int().min(1) });
const ReorderBody = z.object({ orderedItemIds: z.array(z.string().uuid()).max(50), expectedRevision: z.number().int().min(1) });
type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, ctx, requestId) => {
  const { db } = await requireUser(req);
  const { id } = parseOr422(Params, await ctx.params);
  const body = parseOr422(AddBody, await readJson(req));
  const { data, error } = await db.rpc('append_plan_item', { p_plan_id: id, p_venue_id: body.venueId, p_expected_revision: body.expectedRevision }).single();
  if (error) throw error;
  const item: any = data;
  return ok({ requestId, id: item.id, venueId: item.venue_id, position: item.position, revision: body.expectedRevision + 1 }, requestId, { status: 201, cache: 'private' });
});

/** Tam sıralama; DB fonksiyonu revision'ı kilit altında doğrular (P0001 → 409). */
export const PUT = route<Ctx>(async (req, ctx, requestId) => {
  const { db } = await requireUser(req);
  const { id } = parseOr422(Params, await ctx.params);
  const body = parseOr422(ReorderBody, await readJson(req));
  const { data, error } = await db.rpc('reorder_plan_items', { p_plan_id: id, p_ordered_item_ids: body.orderedItemIds, p_expected_revision: body.expectedRevision });
  if (error) throw error;
  return ok({ requestId, revision: data }, requestId, { cache: 'private' });
});
