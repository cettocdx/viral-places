/** Sunucu ortam değişkenleri; eksikse açık hata (secret log'lanmaz). */
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`ENV_MISSING:${name}`);
  return v;
}

export const env = {
  supabaseUrl: () => req('SUPABASE_URL'),
  publishableKey: () => req('SUPABASE_PUBLISHABLE_KEY'),
  /** service_role — yalnız webhook/iç işlerde; kullanıcı isteğinde kullanılmaz. */
  secretKey: () => req('SUPABASE_SECRET_KEY'),
  apifyWebhookSecret: () => process.env.APIFY_WEBHOOK_SECRET || undefined,
  dataMode: () => (process.env.VP_DATA_MODE === 'live' ? 'live' : 'demo') as 'demo' | 'live',
};
