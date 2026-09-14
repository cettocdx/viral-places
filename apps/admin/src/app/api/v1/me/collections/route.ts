import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, parseOr422, readJson, route } from '@/lib/http';

const CreateBody = z.object({ title: z.string().trim().min(1).max(80) });

export const GET = route(async (req, _ctx, requestId) => {
  const { db } = await requireUser(req);
  const { data, error } = await db.from('collections').select('id, title, created_at, saved_places(count)').order('created_at');
  if (error) throw error;
  const items = (data ?? []).map((c: any) => ({ id: c.id, title: c.title, createdAt: c.created_at, placeCount: c.saved_places?.[0]?.count ?? 0 }));
  return ok({ requestId, items }, requestId, { cache: 'private' });
});

export const POST = route(async (req, _ctx, requestId) => {
  const { db, userId } = await requireUser(req);
  const body = parseOr422(CreateBody, await readJson(req));
  const { data, error } = await db.from('collections').insert({ owner_id: userId, title: body.title }).select('id, title, created_at').single();
  if (error) throw error;
  return ok({ requestId, id: data.id, title: data.title, createdAt: data.created_at, placeCount: 0 }, requestId, { status: 201, cache: 'private' });
});
