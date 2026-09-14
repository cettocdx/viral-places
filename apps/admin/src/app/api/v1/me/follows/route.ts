import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ApiError, ok, parseOr422, readJson, route } from '@/lib/http';

const Body = z.object({ creatorId: z.string().uuid() });

export const GET = route(async (req, _ctx, requestId) => {
  const { db } = await requireUser(req);
  const { data, error } = await db.from('creator_follows').select('creator_id, created_at, creators(id, display_name, claim_status)').order('created_at', { ascending: false });
  if (error) throw error;
  const items = (data ?? []).map((r: any) => ({ creatorId: r.creator_id, followedAt: r.created_at, displayName: r.creators?.display_name ?? null }));
  return ok({ requestId, items }, requestId, { cache: 'private' });
});

export const POST = route(async (req, _ctx, requestId) => {
  const { db, userId } = await requireUser(req);
  const body = parseOr422(Body, await readJson(req));
  const { error } = await db.from('creator_follows').upsert({ owner_id: userId, creator_id: body.creatorId }, { onConflict: 'owner_id,creator_id', ignoreDuplicates: true });
  if (error) throw error;
  return ok({ requestId, creatorId: body.creatorId, following: true }, requestId, { status: 201, cache: 'private' });
});

export const DELETE = route(async (req, _ctx, requestId) => {
  const { db } = await requireUser(req);
  const body = parseOr422(Body, await readJson(req));
  const { error, count } = await db.from('creator_follows').delete({ count: 'exact' }).eq('creator_id', body.creatorId);
  if (error) throw error;
  if (!count) throw new ApiError(404, 'NOT_FOUND', 'Follow not found');
  return ok({ requestId, creatorId: body.creatorId, following: false }, requestId, { cache: 'private' });
});
