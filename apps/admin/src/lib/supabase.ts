import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;

/** anon: RLS'e tabi public okuma. */
export function anonClient(): SupabaseClient {
  return createClient(env.supabaseUrl(), env.publishableKey(), opts);
}

/** Kullanıcı JWT'si ile: RLS kullanıcı olarak uygulanır (me/* uçları). */
export function userClient(accessToken: string): SupabaseClient {
  return createClient(env.supabaseUrl(), env.publishableKey(), { ...opts, global: { headers: { Authorization: `Bearer ${accessToken}` } } });
}

/** service_role: RLS'i atlar. YALNIZ webhook kabulü ve iç işler; route içinde kullanıcı verisi için çağrılmaz. */
export function serviceClient(): SupabaseClient {
  return createClient(env.supabaseUrl(), env.secretKey(), opts);
}
