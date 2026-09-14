import { requireAdmin } from '@/lib/admin-auth';
import { ok, route } from '@/lib/http';
import { serviceClient } from '@/lib/supabase';

/** Günlük bütçe/maliyet görünümü (§27.4): tahmin ≠ fatura; kesin tutar sağlayıcı faturasıyla uzlaştırılır. */
export const GET = route(async (req, _ctx, requestId) => {
  requireAdmin(req);
  const day = new URL(req.url).searchParams.get('day') ?? new Date().toISOString().slice(0, 10);
  const { data, error } = await serviceClient().rpc('admin_budget_day', { p_day: day }).single();
  if (error) throw error;
  return ok({ requestId, day, ...(data as Record<string, unknown>), note: 'Tahminler liste fiyatına dayanır; gerçek fatura ile uzlaştırma gerekir.' }, requestId, { cache: 'private' });
});
