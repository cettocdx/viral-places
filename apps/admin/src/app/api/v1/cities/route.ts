import { CitiesResponse } from '@viral-places/contracts';
import { ok, route } from '@/lib/http';
import { anonClient } from '@/lib/supabase';
import { cityDto } from '@/lib/mappers';

/** Şehir listesi (çok şehir, 02.10.2026): kapsamı olanlar önce, sonra ada göre. Kapsam "none" şehirler "yakında" gösterilir. */
const COVERAGE_ORDER: Record<string, number> = { covered: 0, growing: 1, pilot: 2, none: 3 };

export const GET = route(async (_req, _ctx, requestId) => {
  const db = anonClient();
  // Şehir seçici sıralaması ve "N mekan" için yayındaki mekan sayısı (28.10.2026). PostgREST sayfa sınırı 1000:
  // sayfalanarak okunur.
  const countVenues = async () => {
    const counts = new Map<string, number>();
    for (let from = 0; from < 50_000; from += 1000) {
      const { data: page } = await db.from('venues').select('city_id').eq('status', 'published').order('id').range(from, from + 999);
      for (const v of page ?? []) counts.set(v.city_id, (counts.get(v.city_id) ?? 0) + 1);
      if (!page || page.length < 1000) break;
    }
    return counts;
  };
  const [{ data, error }, counts] = await Promise.all([db.from('cities').select('*'), countVenues()]);
  if (error) throw error;
  const rows = (data ?? []).map((c) => ({ ...c, place_count: counts.get(c.id) ?? 0 })).sort((a, b) => (COVERAGE_ORDER[a.coverage_status] ?? 9) - (COVERAGE_ORDER[b.coverage_status] ?? 9) || String(a.name).localeCompare(String(b.name), 'tr'));
  return ok(CitiesResponse.parse({ requestId, items: rows.map((c) => cityDto(c, null, null)) }), requestId, { cache: 'public' });
});
