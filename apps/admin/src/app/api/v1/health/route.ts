import { ok, route } from '@/lib/http';
import { env } from '@/lib/env';

// Supabase (Frankfurt) yanında çalış: ABD bölgesinde her sorgu Atlantik'i geçiyordu (29.10.2026).
export const preferredRegion = 'fra1';

export const GET = route(async (_req, _ctx, requestId) => {
  return ok({ status: 'ok', dataMode: env.dataMode(), version: 'v1', requestId }, requestId);
});
