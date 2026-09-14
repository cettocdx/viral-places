import { loadLocalEnv } from './env';

export default async function setup() {
  loadLocalEnv();
  const url = process.env.SUPABASE_URL!;
  const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY! } }).catch(() => null);
  if (!r || !r.ok) throw new Error(`Yerel Supabase yanıt vermiyor (${url}). \`npx supabase start\` gerekli.`);
}
