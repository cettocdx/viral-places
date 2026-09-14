import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './http';
import { anonClient, userClient } from './supabase';

export interface AuthedContext {
  userId: string;
  db: SupabaseClient;
}

/** Bearer JWT → Supabase Auth ile doğrulanır; DB istemcisi kullanıcı olarak (RLS) çalışır. */
export async function requireUser(req: Request): Promise<AuthedContext> {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) throw new ApiError(401, 'AUTH_REQUIRED', 'Bearer token required');
  const { data, error } = await anonClient().auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, 'AUTH_INVALID', 'Token is invalid or expired');
  return { userId: data.user.id, db: userClient(token) };
}
