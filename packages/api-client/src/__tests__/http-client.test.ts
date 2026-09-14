import { describe, expect, it, vi } from 'vitest';
import { ApiError, HttpApiClient } from '../index';

function fakeFetch(handler: (url: string, init: RequestInit) => { status: number; body: unknown; headers?: Record<string, string> }) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const r = handler(String(url), init ?? {});
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json', ...r.headers } });
  }) as unknown as typeof fetch;
}

describe('HttpApiClient', () => {
  it('hata zarfını ApiError\'a çevirir (requestId dahil)', async () => {
    const c = new HttpApiClient({ baseUrl: 'https://api.test/', fetchImpl: fakeFetch(() => ({ status: 404, body: { error: { code: 'NOT_FOUND', message: 'x', retryable: false, requestId: 'r9' } } })) });
    await expect(c.getPlace('00000000-0000-4000-8000-000000000001')).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404, requestId: 'r9' });
  });
  it('retryable GET hatasında bir kez yeniden dener', async () => {
    let n = 0;
    const f = fakeFetch(() => (++n === 1 ? { status: 503, body: { error: { code: 'X', message: 'y', retryable: true, requestId: 'r' } } } : { status: 200, body: { status: 'ok' } }));
    const c = new HttpApiClient({ baseUrl: 'https://api.test', fetchImpl: f });
    // getPlace şemaya uymayan gövdeyi CONTRACT_MISMATCH yapar; burada yeniden deneme sayısını ölçüyoruz
    await expect(c.getPlace('id')).rejects.toBeInstanceOf(ApiError);
    expect(n).toBe(2);
  });
  it('sözleşmeye uymayan yanıt CONTRACT_MISMATCH', async () => {
    const c = new HttpApiClient({ baseUrl: 'https://api.test', fetchImpl: fakeFetch(() => ({ status: 200, body: { nope: true } })) });
    await expect(c.getCreator('id')).rejects.toMatchObject({ code: 'CONTRACT_MISMATCH', retryable: false });
  });
  it('POST /imports Idempotency-Key ve Bearer gönderir, yeniden denemez', async () => {
    const f = fakeFetch((url, init) => {
      const h = init.headers as Record<string, string>;
      expect(url).toBe('https://api.test/api/v1/imports');
      expect(h['idempotency-key']).toBe('key-12345678');
      expect(h.authorization).toBe('Bearer tok');
      return { status: 202, body: { importId: 'i1', status: 'blocked', normalizedUrl: 'https://www.tiktok.com/@a/video/1', createdAt: '2026-09-12T09:00:00Z', note: null } };
    });
    const c = new HttpApiClient({ baseUrl: 'https://api.test', fetchImpl: f, getAccessToken: async () => 'tok' });
    const r = await c.submitImport('https://www.tiktok.com/@a/video/1?utm=1', 'key-12345678');
    expect(r.importId).toBe('i1');
    expect((f as any).mock.calls.length).toBe(1);
  });
});
