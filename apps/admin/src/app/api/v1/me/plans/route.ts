import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, parseOr422, readJson, route } from '@/lib/http';

const CreateBody = z.object({
  title: z.string().trim().min(1).max(80),
  dateLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().min(1).max(64),
  cityId: z.string().uuid().nullable().default(null),
});

export function planDto(p: any) {
  return { id: p.id, title: p.title, dateLocal: p.date_local, timezone: p.timezone, cityId: p.city_id, revision: p.revision, createdAt: p.created_at, updatedAt: p.updated_at };
}

export const GET = route(async (req, _ctx, requestId) => {
  const { db } = await requireUser(req);
  const { data, error } = await db.from('plans').select('*').order('date_local', { ascending: false });
  if (error) throw error;
  return ok({ requestId, items: (data ?? []).map(planDto) }, requestId, { cache: 'private' });
});

export const POST = route(async (req, _ctx, requestId) => {
  const { db, userId } = await requireUser(req);
  const body = parseOr422(CreateBody, await readJson(req));
  const { data, error } = await db.from('plans').insert({ owner_id: userId, title: body.title, date_local: body.dateLocal, timezone: body.timezone, city_id: body.cityId }).select('*').single();
  if (error) throw error;
  return ok({ requestId, ...planDto(data) }, requestId, { status: 201, cache: 'private' });
});
