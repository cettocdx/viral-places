import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ApiError, ok, parseOr422, readJson, route } from '@/lib/http';
import { mapItemsForIds } from '@/lib/public-reads';

const SaveBody = z.object({ venueId: z.string().uuid(), collectionId: z.string().uuid() });
const UnsaveBody = z.object({ venueId: z.string().uuid(), collectionId: z.string().uuid().optional() });

/** Kaydedilenler: koleksiyon üyeliği + yayımlanmış mekan kartı (yayından kalkan mekan listede görünmez, kayıt korunur). */
export const GET = route(async (req, _ctx, requestId) => {
  const { db } = await requireUser(req);
  const { data, error } = await db.from('saved_places').select('id, venue_id, collection_id, created_at').order('created_at', { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const items = await mapItemsForIds(db, Array.from(new Set(rows.map((r) => r.venue_id))));
  const byVenue = new Map(items.map((i) => [i.id, i]));
  return ok({ requestId, items: rows.map((r) => ({ id: r.id, venueId: r.venue_id, collectionId: r.collection_id, savedAt: r.created_at, place: byVenue.get(r.venue_id) ?? null })) }, requestId, { cache: 'private' });
});

export const POST = route(async (req, _ctx, requestId) => {
  const { db, userId } = await requireUser(req);
  const body = parseOr422(SaveBody, await readJson(req));
  // saved_places'ta update policy yok (bilinçli): tekrar kayıt ON CONFLICT DO NOTHING; mevcut satır okunup döndürülür.
  // RLS: yayımlanmamış mekan veya başkasının koleksiyonu → 42501 (403). Var olmayan → 23503 (422).
  const ins = await db.from('saved_places').upsert({ owner_id: userId, venue_id: body.venueId, collection_id: body.collectionId }, { onConflict: 'owner_id,venue_id,collection_id', ignoreDuplicates: true }).select('id, created_at').maybeSingle();
  if (ins.error) throw ins.error;
  const row = ins.data ?? (await db.from('saved_places').select('id, created_at').eq('venue_id', body.venueId).eq('collection_id', body.collectionId).single()).data;
  if (!row) throw new ApiError(500, 'INTERNAL', 'Save could not be read back', true);
  return ok({ requestId, id: row.id, savedAt: row.created_at }, requestId, { status: 201, cache: 'private' });
});

export const DELETE = route(async (req, _ctx, requestId) => {
  const { db } = await requireUser(req);
  const body = parseOr422(UnsaveBody, await readJson(req));
  let q = db.from('saved_places').delete({ count: 'exact' }).eq('venue_id', body.venueId);
  if (body.collectionId) q = q.eq('collection_id', body.collectionId);
  const { error, count } = await q;
  if (error) throw error;
  if (!count) throw new ApiError(404, 'NOT_FOUND', 'Save not found');
  return ok({ requestId, removed: count }, requestId, { cache: 'private' });
});
