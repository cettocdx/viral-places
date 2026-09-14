/** Public okuma sorguları (anon RLS). Tek yerde: route'lar ince kalır, mapper'lar test edilebilir. */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MapPlaceItemDto } from '@viral-places/contracts';
import { ApiError } from './http';
import { mapItem, type Row } from './mappers';

export async function loadVenuesWithLocations(db: SupabaseClient, ids: string[]): Promise<{ venues: Row[]; locs: Map<string, Row>; scores: Map<string, Row>; heroes: Map<string, Row> }> {
  if (ids.length === 0) return { venues: [], locs: new Map(), scores: new Map(), heroes: new Map() };
  const [v, l, s, h] = await Promise.all([
    db.from('venues').select('id, own_name, neighborhood, city_id, primary_category, family_supported, data_mode').in('id', ids).eq('status', 'published'),
    db.rpc('venue_locations_public', { p_ids: ids }),
    db.from('venue_scores').select('*').in('venue_id', ids),
    db.from('venue_sources').select('venue_id, render_mode, thumbnail_url, rank').in('venue_id', ids).eq('rank', 0),
  ]);
  for (const r of [v, l, s, h]) if (r.error) throw r.error;
  return {
    venues: v.data ?? [],
    locs: new Map((l.data ?? []).map((r: Row) => [r.venue_id, r])),
    scores: new Map((s.data ?? []).map((r: Row) => [r.venue_id, r])),
    heroes: new Map((h.data ?? []).map((r: Row) => [r.venue_id, r])),
  };
}

export async function mapItemsForIds(db: SupabaseClient, ids: string[]): Promise<MapPlaceItemDto[]> {
  const { venues, locs, scores, heroes } = await loadVenuesWithLocations(db, ids);
  const out: MapPlaceItemDto[] = [];
  for (const venue of venues) {
    const loc = locs.get(venue.id);
    if (!loc) continue; // konumu olmayan/süresi dolmuş mekan haritada yer almaz
    const score = scores.get(venue.id) ?? null;
    const hero = heroes.get(venue.id);
    out.push(mapItem(venue, loc, score, hero?.render_mode && hero.render_mode !== 'unavailable' ? hero.thumbnail_url : null, hero?.render_mode ?? 'unavailable', score?.last_successful_observation_at ?? null));
  }
  return out;
}

export async function loadCity(db: SupabaseClient, cityId: string): Promise<Row> {
  const { data, error } = await db.from('cities').select('*').eq('id', cityId).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, 'NOT_FOUND', 'City not found');
  return data;
}
