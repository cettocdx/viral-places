import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ApiError, ok, parseOr422, readJson, route } from '@/lib/http';

const Body = z.object({ url: z.string().url().max(2048) });
const ALLOWED_HOSTS = ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'instagram.com', 'www.instagram.com'];

/** URL normalizasyonu: yalnız https + bilinen host; takip parametreleri atılır. */
export function normalizeSocialUrl(raw: string): string {
  const u = new URL(raw);
  if (u.protocol !== 'https:') throw new ApiError(422, 'URL_UNSUPPORTED', 'Only https links are accepted');
  if (!ALLOWED_HOSTS.includes(u.hostname.toLowerCase())) throw new ApiError(422, 'URL_UNSUPPORTED', 'Only TikTok and Instagram links are accepted');
  u.search = '';
  u.hash = '';
  u.hostname = u.hostname.toLowerCase();
  return u.toString();
}

/** 202 Accepted: istek kuyruğa alınır; sağlayıcı/AI hattı BLOCKED iken durum 'blocked' (§19.2, §32). */
export const POST = route(async (req, _ctx, requestId) => {
  const { db } = await requireUser(req);
  const key = req.headers.get('idempotency-key');
  if (!key || key.length < 8 || key.length > 128) throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header (8–128 chars) required');
  const body = parseOr422(Body, await readJson(req));
  const normalized = normalizeSocialUrl(body.url);
  const { data, error } = await db.rpc('submit_import_request', { p_normalized_url: normalized, p_idempotency_key: key }).single();
  if (error) throw error;
  const r: any = data;
  return ok({ requestId, importId: r.id, status: r.status, normalizedUrl: r.normalized_url, createdAt: r.created_at, note: r.status === 'blocked' ? 'import.blockedProviderMissing' : null }, requestId, { status: 202, cache: 'private' });
});

export const GET = route(async (req, _ctx, requestId) => {
  const { db } = await requireUser(req);
  const { data, error } = await db.from('import_requests').select('id, status, normalized_url, result_venue_id, created_at, updated_at').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return ok({ requestId, items: (data ?? []).map((r) => ({ importId: r.id, status: r.status, normalizedUrl: r.normalized_url, resultVenueId: r.result_venue_id, createdAt: r.created_at, updatedAt: r.updated_at })) }, requestId, { cache: 'private' });
});
