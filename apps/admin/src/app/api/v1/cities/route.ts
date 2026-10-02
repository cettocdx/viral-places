import { CitiesResponse } from '@viral-places/contracts';
import { ok, route } from '@/lib/http';
import { anonClient } from '@/lib/supabase';
import { cityDto } from '@/lib/mappers';

/** Şehir listesi (çok şehir, 02.10.2026): kapsamı olanlar önce, sonra ada göre. Kapsam "none" şehirler "yakında" gösterilir. */
const COVERAGE_ORDER: Record<string, number> = { covered: 0, growing: 1, pilot: 2, none: 3 };

export const GET = route(async (_req, _ctx, requestId) => {
  const db = anonClient();
  const { data, error } = await db.from('cities').select('*');
  if (error) throw error;
  const rows = (data ?? []).sort((a, b) => (COVERAGE_ORDER[a.coverage_status] ?? 9) - (COVERAGE_ORDER[b.coverage_status] ?? 9) || String(a.name).localeCompare(String(b.name), 'tr'));
  return ok(CitiesResponse.parse({ requestId, items: rows.map((c) => cityDto(c, null, null)) }), requestId, { cache: 'public' });
});
