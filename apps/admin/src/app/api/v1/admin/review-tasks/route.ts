import { requireAdmin } from '@/lib/admin-auth';
import { ok, route } from '@/lib/http';
import { serviceClient } from '@/lib/supabase';

/** Açık inceleme görevleri (§16.2): mention eşleştirme, geçersiz/reddedilmiş çıkarım. service_role yalnız admin token arkasında. */
export const GET = route(async (req, _ctx, requestId) => {
  requireAdmin(req);
  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? 'open';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const { data, error } = await serviceClient().rpc('admin_list_review_tasks', { p_status: status, p_limit: limit });
  if (error) throw error;
  return ok({ requestId, items: data ?? [] }, requestId, { cache: 'private' });
});
