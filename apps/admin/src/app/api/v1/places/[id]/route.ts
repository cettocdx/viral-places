import { z } from 'zod';
import { ApiError, ok, parseOr422, route } from '@/lib/http';
import { anonClient } from '@/lib/supabase';
import { placeDetailDto, type Row } from '@/lib/mappers';
import { loadCity } from '@/lib/public-reads';

const Params = z.object({ id: z.string().uuid() });

export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, ctx, requestId) => {
  const { id } = parseOr422(Params, await ctx.params);
  const db = anonClient();
  const [v, l, s, sm, src] = await Promise.all([
    db.from('venues').select('*').eq('id', id).eq('status', 'published').maybeSingle(),
    db.rpc('venue_locations_public', { p_ids: [id] }),
    db.from('venue_scores').select('*').eq('venue_id', id).maybeSingle(),
    db.from('venue_summaries').select('*').eq('venue_id', id).eq('locale', 'tr').maybeSingle(),
    db.from('venue_sources').select('*').eq('venue_id', id).order('rank'),
  ]);
  for (const r of [v, l, s, sm, src]) if (r.error) throw r.error;
  const venue = v.data;
  const loc: Row | undefined = l.data?.[0];
  if (!venue || !loc) throw new ApiError(404, 'NOT_FOUND', 'Place not found');
  const sources: Row[] = src.data ?? [];
  const creatorIds = Array.from(new Set(sources.map((x) => x.creator_id)));
  const [cr, acc, city] = await Promise.all([
    creatorIds.length ? db.from('creators').select('*').in('id', creatorIds) : Promise.resolve({ data: [], error: null }),
    creatorIds.length ? db.from('creator_accounts').select('*').in('creator_id', creatorIds) : Promise.resolve({ data: [], error: null }),
    loadCity(db, venue.city_id),
  ]);
  if (cr.error) throw cr.error;
  if (acc.error) throw acc.error;
  const body = placeDetailDto({
    requestId,
    venue,
    city,
    loc,
    score: s.data ?? null,
    summary: sm.data ?? null,
    sources,
    creators: new Map((cr.data ?? []).map((c: Row) => [c.id, c])),
    accounts: new Map((acc.data ?? []).map((a: Row) => [`${a.creator_id}:${a.platform}`, a])),
    monitoredCreators: null,
  });
  return ok(body, requestId, { cache: 'public' });
});
