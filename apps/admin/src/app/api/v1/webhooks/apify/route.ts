import { MAX_WEBHOOK_BYTES, parseApifyWebhook } from '@viral-places/pipeline';
import { env } from '@/lib/env';
import { ApiError, ok, route } from '@/lib/http';
import { serviceClient } from '@/lib/supabase';

/**
 * Sağlayıcı webhook'u (§13.5): secret header → şema → inbox+outbox (tek transaction, idempotent) → 200.
 * Tekrar teslim aynı anahtarı üretir; yeni satır açılmaz. Body private inbox'ta kalır; public tabloya yazılmaz.
 * Bu route service_role kullanır (tek yer); kullanıcı JWT'si kabul edilmez.
 */
export const POST = route(async (req, _ctx, requestId) => {
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_WEBHOOK_BYTES) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Webhook body too large');
  const parsed = parseApifyWebhook(raw, req.headers.get('x-apify-webhook-secret'), env.apifyWebhookSecret());
  if (!parsed.ok) throw new ApiError(parsed.status, parsed.code, 'Webhook rejected');
  const { event } = parsed;
  const { data, error } = await serviceClient().rpc('accept_provider_event', { p_provider: 'apify', p_run_id: event.eventData.actorRunId, p_event_type: event.eventType, p_payload: JSON.parse(raw) }).single();
  if (error) throw error;
  const r: any = data;
  return ok({ requestId, accepted: true, duplicate: !r.inserted, inboxId: r.inbox_id, outboxId: r.outbox_id }, requestId);
});
