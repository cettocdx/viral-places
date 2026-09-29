/**
 * Video dosyasını kalıcı depoya al (ürün sahibi kararı, 21.09.2026: "TikTok arayüzü olmadan, en yüksek kalitede, tam ekran").
 * Yayındaki mekanların kaynak gönderileri için ScrapeCreators v2 video ayrıntısından en yüksek çözünürlüklü akış seçilir
 * (bit_rate listesi; yoksa filigransız indirme adresi), Supabase Storage `media/videos/<post>.mp4` yoluna kopyalanır ve
 * yerel + bulut `source_posts.video_url` / `venue_sources.video_url` güncellenir. Zaten kopyalanmış gönderiler atlanır.
 * Çalıştırma: set -a; source apps/worker/.env; source .supabase-token.env; set +a; npx tsx apps/worker/src/rehost-video.ts [limit]
 */
import postgres from 'postgres';
import { PUBLIC_PREFIX } from './rehost-media.ts';

const PROJECT = 'uwmbxcsvkieqyzhutjag';
const STORAGE = `https://${PROJECT}.supabase.co/storage/v1`;
const BUCKET = 'media';
const LIMIT = Number(process.argv[2] ?? 500);
const MAX_BYTES = 60 * 1024 * 1024;

function env(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`${k} gerekli`);
  return v;
}

interface Addr { width?: number; height?: number; data_size?: number; url_list?: string[] }
interface Aweme { video?: { play_addr?: Addr; download_no_watermark_addr?: Addr; bit_rate?: Array<{ gear_name?: string; is_bytevc1?: number; play_addr?: Addr }> } }

/** En yüksek çözünürlüklü akış; eşitse küçük dosya. Filigransız indirme adresi yedek. */
function pickStream(a: Aweme): { url: string; label: string } | null {
  const v = a.video;
  if (!v) return null;
  const cands = (v.bit_rate ?? []).map((b) => ({ addr: b.play_addr, label: `${b.gear_name ?? '?'}${b.is_bytevc1 ? '/hevc' : '/h264'}` }));
  cands.sort((x, y) => (y.addr?.height ?? 0) - (x.addr?.height ?? 0) || (x.addr?.data_size ?? 0) - (y.addr?.data_size ?? 0));
  for (const c of cands) {
    const u = c.addr?.url_list?.[0];
    if (u) return { url: u, label: c.label };
  }
  const u = v.download_no_watermark_addr?.url_list?.[0] ?? v.play_addr?.url_list?.[0];
  return u ? { url: u, label: 'download_no_watermark' } : null;
}

async function videoDetail(canonicalUrl: string): Promise<Aweme | null> {
  const r = await fetch(`https://api.scrapecreators.com/v2/tiktok/video?url=${encodeURIComponent(canonicalUrl)}&trim=true`, { headers: { 'x-api-key': env('SCRAPECREATORS_API_KEY') } });
  if (!r.ok) return null;
  const d = (await r.json()) as { aweme_detail?: Aweme };
  return d.aweme_detail ?? null;
}

async function download(url: string): Promise<ArrayBuffer | null> {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.tiktok.com/' } });
  if (!r.ok) return null;
  const len = Number(r.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) return null;
  const buf = await r.arrayBuffer();
  return buf.byteLength > 10_000 && buf.byteLength <= MAX_BYTES ? buf : null;
}

async function upload(path: string, bytes: ArrayBuffer): Promise<string> {
  const r = await fetch(`${STORAGE}/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('CLOUD_SR')}`, 'Content-Type': 'video/mp4', 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' },
    body: bytes,
  });
  if (!r.ok) throw new Error(`upload ${path}: ${r.status} ${await r.text()}`);
  return `${PUBLIC_PREFIX}${path}`;
}

async function main(): Promise<void> {
  const local = postgres(env('DATABASE_URL'), { max: 2 });
  const cloud = postgres(`postgresql://postgres.${PROJECT}:${encodeURIComponent(env('SUPABASE_DB_PASSWORD'))}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`, { max: 2, ssl: 'require' });
  const rows = (await local`
    select distinct p.id, p.canonical_url from public.venue_sources vs
    join public.venues v on v.id = vs.venue_id and v.status = 'published'
    join private.source_posts p on p.id = vs.source_post_id
    where p.platform = 'tiktok' and p.canonical_url is not null and (p.video_url is null or p.video_url not like ${PUBLIC_PREFIX + '%'})
    limit ${LIMIT}`) as Array<{ id: string; canonical_url: string }>;
  let ok = 0;
  const failed: string[] = [];
  for (const r of rows) {
    try {
      const a = await videoDetail(r.canonical_url);
      const s = a ? pickStream(a) : null;
      const bytes = s ? await download(s.url) : null;
      if (!s || !bytes) {
        failed.push(r.id);
        continue;
      }
      const url = await upload(`videos/${r.id}.mp4`, bytes);
      await local`update private.source_posts set video_url = ${url} where id = ${r.id}`;
      await local`update public.venue_sources set video_url = ${url} where source_post_id = ${r.id}`;
      await cloud`update public.venue_sources set video_url = ${url} where source_post_id = ${r.id}`;
      ok += 1;
      console.log(JSON.stringify({ post: r.id, stream: s.label, mb: Number((bytes.byteLength / 1048576).toFixed(1)) }));
    } catch (e) {
      failed.push(`${r.id}:${String((e as Error).message).slice(0, 80)}`);
    }
  }
  console.log(JSON.stringify({ videos: rows.length, ok, failed }));
  await local.end();
  await cloud.end();
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
