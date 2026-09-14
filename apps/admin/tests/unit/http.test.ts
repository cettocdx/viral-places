import { describe, expect, it } from 'vitest';
import { ApiError, errorResponse } from '@/lib/http';
import { normalizeSocialUrl } from '@/app/api/v1/imports/route';

describe('errorResponse zarfı', () => {
  it('ApiError → aynı kod; bilinmeyen → INTERNAL retryable; DB kodları eşlenir', async () => {
    const a = errorResponse(new ApiError(404, 'NOT_FOUND', 'x'), 'r1');
    expect(a.status).toBe(404);
    expect(await a.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'x', retryable: false, requestId: 'r1' } });
    const b = errorResponse(new Error('boom'), 'r2');
    expect(b.status).toBe(500);
    expect((await b.json()).error).toMatchObject({ code: 'INTERNAL', retryable: true });
    const c = errorResponse({ code: 'P0001', message: 'PLAN_REVISION_CONFLICT' }, 'r3');
    expect(c.status).toBe(409);
    const d = errorResponse({ code: '42501', message: 'new row violates row-level security policy' }, 'r4');
    expect(d.status).toBe(403);
    expect((await d.json()).error.message).not.toContain('row-level'); // ham DB mesajı sızmaz
  });
});

describe('normalizeSocialUrl', () => {
  it('takip parametreleri atılır, host küçük harf, https zorunlu', () => {
    expect(normalizeSocialUrl('https://WWW.TikTok.com/@a/video/1?utm_source=x#frag')).toBe('https://www.tiktok.com/@a/video/1');
    expect(() => normalizeSocialUrl('http://www.tiktok.com/@a/video/1')).toThrow(ApiError);
    expect(() => normalizeSocialUrl('https://youtube.com/x')).toThrow(ApiError);
  });
});
