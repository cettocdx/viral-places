/**
 * Mekan logoları: Google Places websiteUri → alan adı → favicon (Google s2, 128px).
 * Sosyal/aracı alan adları (Instagram, linktree…) mekan markası olmadığı için atlanır.
 * Çalıştırma: set -a; source apps/worker/.env; set +a; pnpm --filter @viral-places/worker exec tsx src/brand-logos.ts [--all]
 */
import postgres from 'postgres';

const SKIP_HOSTS = ['instagram.com', 'facebook.com', 'fb.com', 'linktr.ee', 'wa.me', 'whatsapp.com', 'tiktok.com', 'google.com', 'goo.gl', 'g.page', 'youtube.com', 'twitter.com', 'x.com', 'bit.ly', 'linkin.bio', 'beacons.ai', 'yemeksepeti.com', 'getir.com', 'trendyol.com'];

export function brandHost(websiteUri: string | null | undefined): string | null {
  if (!websiteUri) return null;
  try {
    const host = new URL(websiteUri).hostname.toLowerCase().replace(/^www\./, '');
    if (SKIP_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;
    return host;
  } catch {
    return null;
  }
}

export function logoUrlFor(host: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

async function main() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const dbUrl = process.env.DATABASE_URL;
  if (!apiKey || !dbUrl) throw new Error('GOOGLE_PLACES_API_KEY ve DATABASE_URL gerekli');
  const all = process.argv.includes('--all');
  const sql = postgres(dbUrl, { max: 2 });
  const rows = await sql`select v.id, v.own_name, e.external_id from public.venues v join public.venue_external_ids e on e.venue_id = v.id and e.provider = 'google_places'
    where ${all} or v.website_url is null`;
  let withLogo = 0;
  for (const r of rows) {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(r.external_id as string)}`, { headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'websiteUri' } });
    if (!res.ok) {
      console.log(JSON.stringify({ venue: r.own_name, error: res.status }));
      continue;
    }
    const body = (await res.json()) as { websiteUri?: string };
    const host = brandHost(body.websiteUri);
    let logo: string | null = null;
    if (host) {
      // Google s2, favicon bulamazsa 16px varsayılan küre döndürür (404 ile): yalnız gerçek ikonları kaydet.
      const probe = await fetch(logoUrlFor(host));
      if (probe.ok) logo = logoUrlFor(host);
    }
    if (logo) withLogo++;
    await sql`update public.venues set website_url = ${body.websiteUri ?? ''}, logo_url = ${logo} where id = ${r.id}`;
    console.log(JSON.stringify({ venue: r.own_name, host, logo: !!logo }));
  }
  console.log(JSON.stringify({ done: rows.length, withLogo }));
  await sql.end();
}

if (process.argv[1]?.endsWith('brand-logos.ts')) void main();
