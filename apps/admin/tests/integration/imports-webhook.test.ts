import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as importPost, GET as importGet } from '@/app/api/v1/imports/route';
import { POST as webhookPost } from '@/app/api/v1/webhooks/apify/route';
import { call, createTestUser, deleteTestUser, type TestUser } from './helpers';

let U: TestUser;
beforeAll(async () => {
  U = await createTestUser('imp');
});
afterAll(async () => {
  if (U) await deleteTestUser(U);
});

describe('POST /imports (202, Idempotency-Key, kota)', () => {
  it('anahtar yoksa 400; aynı anahtar aynı kaydı döndürür; durum blocked (sağlayıcı yok)', async () => {
    const noKey = await call(importPost, { method: 'POST', path: '/api/v1/imports', token: U.token, body: { url: 'https://www.tiktok.com/@x/video/123?utm=1' } });
    expect(noKey.status).toBe(400);
    const a = await call(importPost, { method: 'POST', path: '/api/v1/imports', token: U.token, headers: { 'idempotency-key': 'key-000001' }, body: { url: 'https://www.tiktok.com/@x/video/123?utm=1' } });
    expect(a.status).toBe(202);
    expect(a.json.normalizedUrl).toBe('https://www.tiktok.com/@x/video/123');
    expect(a.json.status).toBe('blocked');
    const b = await call(importPost, { method: 'POST', path: '/api/v1/imports', token: U.token, headers: { 'idempotency-key': 'key-000001' }, body: { url: 'https://www.tiktok.com/@x/video/123' } });
    expect(b.json.importId).toBe(a.json.importId);
    const list = await call(importGet, { path: '/api/v1/imports', token: U.token });
    expect(list.json.items.length).toBe(1);
  });
  it('desteklenmeyen host/https dışı 422; anon 401', async () => {
    expect((await call(importPost, { method: 'POST', path: '/api/v1/imports', token: U.token, headers: { 'idempotency-key': 'key-000002' }, body: { url: 'https://evil.example/x' } })).status).toBe(422);
    expect((await call(importPost, { method: 'POST', path: '/api/v1/imports', token: U.token, headers: { 'idempotency-key': 'key-000003' }, body: { url: 'http://www.instagram.com/p/abc' } })).status).toBe(422);
    expect((await call(importPost, { method: 'POST', path: '/api/v1/imports', headers: { 'idempotency-key': 'key-000004' }, body: { url: 'https://www.instagram.com/p/abc' } })).status).toBe(401);
  });
  it('24 saatte 20 istek kotası → 21. istek 429', async () => {
    for (let i = 2; i <= 20; i++) {
      const r = await call(importPost, { method: 'POST', path: '/api/v1/imports', token: U.token, headers: { 'idempotency-key': `quota-${String(i).padStart(6, '0')}` }, body: { url: `https://www.instagram.com/p/q${i}` } });
      expect(r.status).toBe(202);
    }
    const over = await call(importPost, { method: 'POST', path: '/api/v1/imports', token: U.token, headers: { 'idempotency-key': 'quota-000021' }, body: { url: 'https://www.instagram.com/p/q21' } });
    expect(over.status).toBe(429);
    expect(over.json.error.code).toBe('IMPORT_QUOTA_EXCEEDED');
  });
});

describe('POST /webhooks/apify (inbox+outbox idempotent)', () => {
  const secret = process.env.APIFY_WEBHOOK_SECRET!;
  const runId = `it-run-${Date.now()}`;
  const body = JSON.stringify({ eventType: 'ACTOR.RUN.SUCCEEDED', eventData: { actorRunId: runId, actorId: 'demo' }, resource: { defaultDatasetId: 'ds' } });

  it('secret yok/yanlış → 401; şema dışı → 400', async () => {
    expect((await call(webhookPost, { method: 'POST', path: '/api/v1/webhooks/apify', rawBody: body })).status).toBe(401);
    expect((await call(webhookPost, { method: 'POST', path: '/api/v1/webhooks/apify', rawBody: body, headers: { 'x-apify-webhook-secret': 'wrong' } })).status).toBe(401);
    expect((await call(webhookPost, { method: 'POST', path: '/api/v1/webhooks/apify', rawBody: '{"eventType":"x"}', headers: { 'x-apify-webhook-secret': secret } })).status).toBe(400);
  });
  it('aynı teslimat ×3 → tek inbox/outbox satırı', async () => {
    const results = [];
    for (let i = 0; i < 3; i++) results.push(await call(webhookPost, { method: 'POST', path: '/api/v1/webhooks/apify', rawBody: body, headers: { 'x-apify-webhook-secret': secret } }));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(results.map((r) => r.json.duplicate)).toEqual([false, true, true]);
    expect(new Set(results.map((r) => r.json.inboxId)).size).toBe(1);
    expect(new Set(results.map((r) => r.json.outboxId)).size).toBe(1);
    expect(results[0]!.json.outboxId).toBeTruthy();
  });
  it('kullanıcı JWT ile (secret yok) reddedilir', async () => {
    expect((await call(webhookPost, { method: 'POST', path: '/api/v1/webhooks/apify', rawBody: body, token: U.token })).status).toBe(401);
  });
});
