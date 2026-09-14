import { z } from 'zod';
import { ApiError, ok, parseOr422, route } from '@/lib/http';
import { anonClient } from '@/lib/supabase';
import { creatorDetailDto, sourceDto, type Row } from '@/lib/mappers';
import { mapItemsForIds } from '@/lib/public-reads';

const Params = z.object({ id: z.string().uuid() });

export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, ctx, requestId) => {
  const { id } = parseOr422(Params, await ctx.params);
  const db = anonClient();
  const [c, a, src] = await Promise.all([
    db.from('creators').select('*').eq('id', id).eq('status', 'active').maybeSingle(),
    db.from('creator_accounts').select('*').eq('creator_id', id).order('observed_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('venue_sources').select('*').eq('creator_id', id).order('published_at', { ascending: false }).limit(50),
  ]);
  for (const r of [c, a, src]) if (r.error) throw r.error;
  if (!c.data || !a.data) throw new ApiError(404, 'NOT_FOUND', 'Creator not found');
  const sources: Row[] = src.data ?? [];
  const venueIds = Array.from(new Set(sources.map((s) => s.venue_id)));
  const places = await mapItemsForIds(db, venueIds); // yalnız yayımlanmış + onaylı projeksiyon
  const cityCounts = new Map<string, number>();
  for (const p of places) cityCounts.set(p.cityId, (cityCounts.get(p.cityId) ?? 0) + 1);
  const cityRows = cityCounts.size ? (await db.from('cities').select('id, name').in('id', Array.from(cityCounts.keys()))).data ?? [] : [];
  const body = creatorDetailDto({
    requestId,
    creator: c.data,
    account: a.data,
    cities: cityRows.map((r: Row) => ({ id: r.id, name: r.name, placeCount: cityCounts.get(r.id) ?? 0 })),
    categories: Array.from(new Set(places.map((p) => p.category))),
    places,
    posts: sources.map((s) => sourceDto(s, c.data!, a.data)),
  });
  return ok(body, requestId, { cache: 'public' });
});
