import { timingSafeEqual } from 'node:crypto';
import { ApiError } from './http';

/**
 * Admin uçları (§19.2 /admin/*): geçici olarak paylaşılan ADMIN_API_TOKEN header'ı (x-admin-token). Rol modeli (profiles.role + Supabase Auth)
 * M6'da bunun yerine geçer; kullanıcı JWT'si bu uçlarda KABUL EDİLMEZ. Token yoksa uçlar 503 döner (yanlışlıkla açık kalmaz).
 */
export function requireAdmin(req: Request): { actorId: string } {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected || expected.length < 24) throw new ApiError(503, 'ADMIN_NOT_CONFIGURED', 'Admin token not configured', false);
  const given = req.headers.get('x-admin-token') ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError(401, 'ADMIN_AUTH_INVALID', 'Admin token invalid');
  const actor = req.headers.get('x-admin-actor-id');
  return { actorId: actor && /^[0-9a-f-]{36}$/i.test(actor) ? actor : '00000000-0000-0000-0000-000000000000' };
}
