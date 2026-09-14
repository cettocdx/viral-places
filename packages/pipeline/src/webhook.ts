/**
 * Sağlayıcı webhook kabulü (§13.5): gizli header doğrulama, şema/boyut, idempotency anahtarı.
 * DB transaction'ı (inbox+outbox) çağıran katmandadır; burada yalnız saf doğrulama/anahtar üretimi.
 */
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const ApifyWebhookEvent = z.object({
  eventType: z.string().min(1).max(64),
  eventData: z.object({ actorRunId: z.string().min(1).max(128), actorId: z.string().optional() }).passthrough(),
  createdAt: z.string().datetime({ offset: true }).optional(),
  resource: z.object({ id: z.string().optional(), defaultDatasetId: z.string().optional() }).passthrough().optional(),
});
export type ApifyWebhookEvent = z.infer<typeof ApifyWebhookEvent>;

export const MAX_WEBHOOK_BYTES = 64 * 1024;

export function verifyWebhookSecret(headerValue: string | null, expected: string | undefined): boolean {
  if (!expected || !headerValue) return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type WebhookParse = { ok: true; event: ApifyWebhookEvent; idempotencyKey: string } | { ok: false; status: 400 | 401 | 413; code: string };

export function parseApifyWebhook(rawBody: string, secretHeader: string | null, expectedSecret: string | undefined): WebhookParse {
  if (!verifyWebhookSecret(secretHeader, expectedSecret)) return { ok: false, status: 401, code: 'WEBHOOK_SECRET_INVALID' };
  if (Buffer.byteLength(rawBody) > MAX_WEBHOOK_BYTES) return { ok: false, status: 413, code: 'WEBHOOK_TOO_LARGE' };
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, code: 'WEBHOOK_INVALID_JSON' };
  }
  const parsed = ApifyWebhookEvent.safeParse(json);
  if (!parsed.success) return { ok: false, status: 400, code: 'WEBHOOK_SCHEMA_INVALID' };
  const e = parsed.data;
  // provider + run_id + event_type → tekrar teslim aynı anahtarı üretir (§13.5 madde 3)
  return { ok: true, event: e, idempotencyKey: `apify:${e.eventData.actorRunId}:${e.eventType}` };
}
