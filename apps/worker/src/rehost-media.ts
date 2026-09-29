/**
 * TikTok CDN adresleri imzalıdır ve birkaç gün içinde 403 döner. Kapak görsellerini ve creator avatarlarını
 * bulut Supabase Storage'daki herkese açık `media` kovasına kopyalar; yerel ve bulut DB'yi kalıcı adresle günceller.
 * Süresi dolmuş kapaklar TikTok oEmbed'den, avatarlar ScrapeCreators profilinden tazelenir.
 * Çalıştırma: set -a; source apps/worker/.env; source .supabase-token.env; set +a; npx tsx apps/worker/src/rehost-media.ts
 */
import postgres from 'postgres';

const PROJECT = 'uwmbxcsvkieqyzhutjag';
const STORAGE = `https://${PROJECT}.supabase.co/storage/v1`;
const BUCKET = 'media';
export const PUBLIC_PREFIX = `${STORAGE}/object/public/${BUCKET}/`;

function env(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`${k} gerekli`);
  return v;
}

async function download(url: string | null): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const type = r.headers.get('content-type') ?? '';
    if (!r.ok || !type.startsWith('image/')) return null;
    return { bytes: await r.arrayBuffer(), type };
  } catch {
    return null;
  }
}

async function oembedThumb(sourceUrl: string | null): Promise<string | null> {
  if (!sourceUrl || !sourceUrl.includes('tiktok.com')) return null;
  try {
    const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(sourceUrl)}`);
    if (!r.ok) return null;
    return ((await r.json()) as { thumbnail_url?: string }).thumbnail_url ?? null;
  } catch {
    return null;
  }
}

async function freshAvatar(handle: string): Promise<string | null> {
  const r = await fetch(`https://api.scrapecreators.com/v1/tiktok/profile?handle=${encodeURIComponent(handle)}`, { headers: { 'x-api-key': env('SCRAPECREATORS_API_KEY') } });
  if (!r.ok) return null;
  const u = ((await r.json()) as { user?: { avatarLarger?: string; avatarMedium?: string } }).user;
  return u?.avatarLarger ?? u?.avatarMedium ?? null;
}

async function upload(path: string, img: { bytes: ArrayBuffer; type: string }): Promise<string> {
  const r = await fetch(`${STORAGE}/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('CLOUD_SR')}`, 'Content-Type': img.type, 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' },
    body: img.bytes,
  });
  if (!r.ok) throw new Error(`upload ${path}: ${r.status} ${await r.text()}`);
  return `${PUBLIC_PREFIX}${path}`;
}

async function ensureBucket(): Promise<void> {
  const r = await fetch(`${STORAGE}/bucket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('CLOUD_SR')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, allowed_mime_types: ['image/*'], file_size_limit: 5 * 1024 * 1024 }),
  });
  if (!r.ok && r.status !== 409 && !(await r.text()).includes('already exists')) throw new Error(`bucket: ${r.status}`);
}

function ext(type: string): string {
  return type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('heic') ? 'heic' : 'jpg';
}

async function main() {
  const local = postgres(env('DATABASE_URL'), { max: 2 });
  const cloud = postgres({ host: 'aws-0-eu-central-1.pooler.supabase.com', port: 5432, user: `postgres.${PROJECT}`, password: env('SUPABASE_DB_PASSWORD'), database: 'postgres', ssl: 'require', max: 2 });
  await ensureBucket();
  const dbs = [local, cloud];

  // 1) Video kapakları (kaynak gönderi kimliği başına tek dosya)
  const posts = await local`select distinct on (source_post_id) source_post_id, source_url, thumbnail_url from public.venue_sources
    where source_url not like '%.invalid%' and (thumbnail_url is null or thumbnail_url not like ${PUBLIC_PREFIX + '%'})`;
  let ok = 0;
  const failed: string[] = [];
  for (const p of posts) {
    const img = (await download(p.thumbnail_url as string)) ?? (await download(await oembedThumb(p.source_url as string)));
    if (!img) {
      failed.push(p.source_post_id as string);
      continue;
    }
    const url = await upload(`thumbs/${String(p.source_post_id).replace(/[^\w-]/g, '_')}.${ext(img.type)}`, img);
    for (const db of dbs) await db`update public.venue_sources set thumbnail_url = ${url} where source_post_id = ${p.source_post_id}`;
    ok++;
  }
  console.log(JSON.stringify({ thumbs: posts.length, ok, failed }));

  // 2) Creator avatarları
  const accounts = await local`select id, handle, avatar_url from public.creator_accounts
    where avatar_url is not null and avatar_url not like ${PUBLIC_PREFIX + '%'} and handle not like 'demo%'`;
  let aok = 0;
  const afailed: string[] = [];
  for (const a of accounts) {
    const img = (await download(a.avatar_url as string)) ?? (await download(await freshAvatar(a.handle as string)));
    if (!img) {
      afailed.push(a.handle as string);
      continue;
    }
    const url = await upload(`avatars/${String(a.handle).replace(/[^\w.-]/g, '_')}.${ext(img.type)}`, img);
    for (const db of dbs) await db`update public.creator_accounts set avatar_url = ${url} where handle = ${a.handle}`;
    aok++;
  }
  console.log(JSON.stringify({ avatars: accounts.length, ok: aok, failed: afailed }));
  await local.end();
  await cloud.end();
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
