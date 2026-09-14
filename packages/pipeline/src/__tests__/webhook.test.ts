import { describe, expect, it } from 'vitest';
import { parseApifyWebhook } from '../webhook';

const body = JSON.stringify({ eventType: 'ACTOR.RUN.SUCCEEDED', eventData: { actorRunId: 'run-abc', actorId: 'a1' }, resource: { defaultDatasetId: 'ds1' } });

describe('parseApifyWebhook', () => {
  it('secret yoksa/yanlışsa 401', () => {
    expect(parseApifyWebhook(body, null, 's')).toMatchObject({ ok: false, status: 401 });
    expect(parseApifyWebhook(body, 'x', 's')).toMatchObject({ ok: false, status: 401 });
    expect(parseApifyWebhook(body, 's', undefined)).toMatchObject({ ok: false, status: 401 });
  });
  it('aynı run+event → aynı idempotency anahtarı', () => {
    const a = parseApifyWebhook(body, 's', 's');
    const b = parseApifyWebhook(body, 's', 's');
    expect(a.ok && b.ok && a.idempotencyKey === b.idempotencyKey).toBe(true);
    expect(a.ok && a.idempotencyKey).toBe('apify:run-abc:ACTOR.RUN.SUCCEEDED');
  });
  it('bozuk JSON 400, şema dışı 400, büyük gövde 413', () => {
    expect(parseApifyWebhook('{', 's', 's')).toMatchObject({ ok: false, status: 400, code: 'WEBHOOK_INVALID_JSON' });
    expect(parseApifyWebhook('{"eventType":"x"}', 's', 's')).toMatchObject({ ok: false, status: 400, code: 'WEBHOOK_SCHEMA_INVALID' });
    expect(parseApifyWebhook('x'.repeat(70000), 's', 's')).toMatchObject({ ok: false, status: 413 });
  });
});
