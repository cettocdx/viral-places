import './env';
import { createClient } from '@supabase/supabase-js';

export const VENUE_PUBLISHED = '00000000-0000-4000-8000-000000000001';
export const VENUE_PUBLISHED_2 = '00000000-0000-4000-8000-000000000002';
export const VENUE_UNPUBLISHED = '00000000-0000-4000-8000-000000000008';
export const CREATOR_A = '00000000-0000-4000-8000-0000000000a1';

const admin = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

export interface TestUser { id: string; token: string; email: string }

export async function createTestUser(tag: string): Promise<TestUser> {
  const email = `it-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = 'Test-Password-1234!';
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const s = await anon().auth.signInWithPassword({ email, password });
  if (s.error || !s.data.session) throw s.error ?? new Error('no session');
  return { id: data.user.id, token: s.data.session.access_token, email };
}

export async function deleteTestUser(u: TestUser): Promise<void> {
  await admin().auth.admin.deleteUser(u.id);
}

type Handler = (req: Request, ctx: any) => Promise<Response>;

/** Route handler'ı süreç içinde çağırır (HTTP sunucu yok): gerçek Request/Response, gerçek Supabase. */
export async function call(handler: Handler, opts: { method?: string; path: string; body?: unknown; token?: string; headers?: Record<string, string>; params?: Record<string, string>; rawBody?: string }) {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...opts.headers };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const req = new Request(`http://localhost${opts.path}`, { method: opts.method ?? 'GET', headers, body: opts.rawBody ?? (opts.body === undefined ? null : JSON.stringify(opts.body)) });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, headers: res.headers };
}
