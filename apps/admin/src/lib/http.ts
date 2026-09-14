import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly retryable = false) {
    super(message);
  }
}

export function requestIdOf(req: Request): string {
  return req.headers.get('x-request-id')?.slice(0, 64) || crypto.randomUUID();
}

/** Hata zarfı (§19.5): {error:{code,message,retryable,requestId}}; ham DB/sağlayıcı hatası dışarı sızmaz. */
export function errorResponse(err: unknown, requestId: string): NextResponse {
  const e = err instanceof ApiError ? err : mapUnknown(err);
  if (!(err instanceof ApiError)) console.error(JSON.stringify({ level: 'error', requestId, code: e.code, message: (err as Error)?.message }));
  return NextResponse.json({ error: { code: e.code, message: e.message, retryable: e.retryable, requestId } }, { status: e.status, headers: { 'x-request-id': requestId } });
}

function mapUnknown(err: unknown): ApiError {
  const anyErr = err as { code?: string; message?: string; details?: string } | null;
  const msg = anyErr?.message ?? '';
  if (msg.startsWith('ENV_MISSING')) return new ApiError(503, 'SERVICE_NOT_CONFIGURED', 'Backend is not configured', true);
  if (msg.includes('PLAN_REVISION_CONFLICT')) return new ApiError(409, 'PLAN_REVISION_CONFLICT', 'Plan was modified elsewhere; reload and retry');
  if (msg.includes('PLAN_NOT_FOUND') || anyErr?.code === 'P0002') return new ApiError(404, 'NOT_FOUND', 'Plan not found');
  if (msg.includes('PLAN_ITEMS_MISMATCH')) return new ApiError(422, 'PLAN_ITEMS_MISMATCH', 'Item list does not match the plan');
  if (msg.includes('IMPORT_QUOTA_EXCEEDED')) return new ApiError(429, 'IMPORT_QUOTA_EXCEEDED', 'Import quota exceeded (20 per 24h)', true);
  if (anyErr?.code === '42501') return new ApiError(403, 'FORBIDDEN', 'Not allowed');
  if (anyErr?.code === '23505') return new ApiError(409, 'ALREADY_EXISTS', 'Resource already exists');
  if (anyErr?.code === '23503') return new ApiError(422, 'INVALID_REFERENCE', 'Referenced resource does not exist');
  if (anyErr?.code === '23514' || anyErr?.code === '22023') return new ApiError(422, 'VALIDATION_FAILED', 'Invalid input');
  if (anyErr?.code === 'PGRST116') return new ApiError(404, 'NOT_FOUND', 'Resource not found');
  return new ApiError(500, 'INTERNAL', 'Unexpected error', true);
}

export function ok<T>(body: T, requestId: string, init?: { status?: number; cache?: 'public' | 'private' | 'none'; headers?: Record<string, string> }): NextResponse {
  const cache = init?.cache === 'public' ? 'public, s-maxage=60, stale-while-revalidate=300' : init?.cache === 'private' ? 'private, no-store' : 'no-store';
  return NextResponse.json(body, { status: init?.status ?? 200, headers: { 'x-request-id': requestId, 'Cache-Control': cache, ...init?.headers } });
}

export function parseOr422<T>(schema: ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new ApiError(422, 'VALIDATION_FAILED', r.error.issues.map((i) => `${i.path.join('.') || '$'}: ${i.message}`).join('; '));
  return r.data;
}

/** Route sarmalayıcı: requestId, hata zarfı, basit oran sınırı. */
export function route<Ctx>(handler: (req: Request, ctx: Ctx, requestId: string) => Promise<NextResponse>) {
  return async (req: Request, ctx: Ctx): Promise<NextResponse> => {
    const requestId = requestIdOf(req);
    try {
      rateLimit(req);
      return await handler(req, ctx, requestId);
    } catch (err) {
      return errorResponse(err, requestId);
    }
  };
}

/** Süreç içi token-bucket; tek instance içindir. Üretimde edge/KV tabanlı limit gerekir (BLOCKED: altyapı kararı). */
const buckets = new Map<string, { tokens: number; at: number }>();
const RATE = { capacity: 120, refillPerSec: 2 };
function rateLimit(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const now = Date.now();
  const b = buckets.get(ip) ?? { tokens: RATE.capacity, at: now };
  b.tokens = Math.min(RATE.capacity, b.tokens + ((now - b.at) / 1000) * RATE.refillPerSec);
  b.at = now;
  if (b.tokens < 1) throw new ApiError(429, 'RATE_LIMITED', 'Too many requests', true);
  b.tokens -= 1;
  buckets.set(ip, b);
  if (buckets.size > 10_000) buckets.clear();
}

export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Body too large');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Body is not valid JSON');
  }
}
