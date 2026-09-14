import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { ApiError, ok, parseOr422, readJson, route } from '@/lib/http';
import { serviceClient } from '@/lib/supabase';

const Body = z.object({
  platform: z.enum(['tiktok', 'instagram']),
  platformUserId: z.string().min(1).max(64),
  handle: z.string().min(1).max(80),
  displayName: z.string().max(120).optional(),
  /** Onaylı hak kaydı zorunlu (deny-by-default): kayıt yoksa izleme açılmaz. */
  rightsPolicyId: z.string().min(1).max(120),
  provider: z.enum(['scrapecreators', 'apify', 'ensembledata', 'instagram_graph', 'fixture']).default('scrapecreators'),
  enabled: z.boolean().default(false),
});

/** Creator izlemeye alma (§12/§13.3): hesap + monitoring satırı; enabled=true ancak hak kaydı onaylıysa. */
export const POST = route(async (req, _ctx, requestId) => {
  const { actorId } = requireAdmin(req);
  const body = parseOr422(Body, await readJson(req));
  const { data, error } = await serviceClient().rpc('admin_upsert_monitored_creator', { p_platform: body.platform, p_platform_user_id: body.platformUserId, p_handle: body.handle, p_display_name: body.displayName ?? null, p_rights_policy_id: body.rightsPolicyId, p_provider: body.provider, p_enabled: body.enabled, p_actor: actorId }).single();
  if (error) {
    const msg = String((error as { message?: string }).message ?? '');
    if (msg.includes('RIGHTS_POLICY_NOT_APPROVED')) throw new ApiError(422, 'RIGHTS_POLICY_NOT_APPROVED', 'Rights policy is missing or not approved');
    throw error;
  }
  return ok({ requestId, ...(data as Record<string, unknown>) }, requestId, { status: 201, cache: 'private' });
});

export const GET = route(async (req, _ctx, requestId) => {
  requireAdmin(req);
  const { data, error } = await serviceClient().rpc('admin_list_monitored_creators');
  if (error) throw error;
  return ok({ requestId, items: data ?? [] }, requestId, { cache: 'private' });
});
