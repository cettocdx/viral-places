import { z } from 'zod';
import { ApiError, ok, parseOr422, route } from '@/lib/http';
import { anonClient } from '@/lib/supabase';

/**
 * Anonim uygulama olayları (29.10.2026): kullanım ve hata kayıtları. Kişisel veri kabul edilmez; kurulum kimliği
 * cihazda rastgele üretilir. Toplu gönderim, istek başına en fazla 25 olay.
 */
const Event = z.object({
  name: z.string().regex(/^[a-z_.]{2,48}$/),
  props: z.record(z.string(), z.union([z.string().max(300), z.number(), z.boolean(), z.null()])).default({}),
  at: z.string().datetime().optional(),
});
const Body = z.object({
  installId: z.string().min(8).max(64),
  appVersion: z.string().max(32).optional(),
  platform: z.string().max(16).optional(),
  events: z.array(Event).min(1).max(25),
});

export const POST = route(async (req, _ctx, requestId) => {
  const body = parseOr422(Body, await req.json().catch(() => null));
  const rows = body.events.map((e) => ({ install_id: body.installId, name: e.name, props: e.props, app_version: body.appVersion ?? null, platform: body.platform ?? null, ...(e.at ? { created_at: e.at } : {}) }));
  const { error } = await anonClient().from('app_events').insert(rows);
  if (error) throw new ApiError(503, 'EVENTS_UNAVAILABLE', 'Could not record events');
  return ok({ accepted: rows.length, requestId }, requestId);
});
