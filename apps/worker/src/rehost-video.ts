/**
 * Video dosyasını kalıcı depoya al (ürün sahibi kararı, 21.09.2026: "TikTok arayüzü olmadan, en yüksek kalitede, tam ekran").
 * Yayındaki mekanların kaynak gönderileri için ScrapeCreators v2 video ayrıntısından en yüksek çözünürlüklü akış seçilir
 * (bit_rate listesi; yoksa filigransız indirme adresi), Supabase Storage `media/videos/<post>.mp4` yoluna kopyalanır ve
 * yerel + bulut `source_posts.video_url` / `venue_sources.video_url` güncellenir. Zaten kopyalanmış gönderiler atlanır.
 * Çalıştırma: set -a; source apps/worker/.env; source .supabase-token.env; set +a; npx tsx apps/worker/src/rehost-video.ts [limit]
 */
import postgres from 'postgres';

const PROJECT = 'uwmbxcsvkieqyzhutjag';
const STORAGE = `https://${PROJECT}.supabase.co/storage/v1`;
const BUCKET = 'media';
/** rehost-media ile aynı önek; oradan içe aktarılmaz (modülün yüklenmesi ana akışı çalıştırıyordu). */
const PUBLIC_PREFIX = `${STORAGE}/object/public/${BUCKET}/`;
const LIMIT = Number(process.argv[2] ?? 500);
const MAX_BYTES = 50 * 1024 * 1024;

function env(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`${k} gerekli`);
  return v;
}

interface Addr { width?: number; height?: number; data_size?: number; url_list?: string[] }
interface Aweme { video?: { play_addr?: Addr; play_addr_h264?: Addr; download_no_watermark_addr?: Addr; bit_rate?: Array<{ gear_name?: string; is_bytevc1?: number; play_addr?: Addr }> } }

/**
 * En yüksek çözünürlüklü H.264 akış (27.10.2026 düzeltmesi): önceden play_addr_h264 her zaman ilk seçiliyordu; o akış
 * çoğunlukla 576×1024 ve depodaki 195 videonun 153'ü bu yüzden 720p altındaydı. Artık tüm H.264 adayları (play_addr_h264,
 * bit_rate listesindeki bytevc1 olmayanlar, filigransız indirme, play_addr) kısa kenara göre sıralanır, büyüğü seçilir.
 * HEVC (bytevc1) yine dışarıda: her oynatıcıda açılmıyor (simülatörde siyah ekran, 21.09.2026).
 */
export function pickStream(a: Aweme): { url: string; label: string; short: number } | null {
  const v = a.video;
  if (!v) return null;
  const cands: { addr?: Addr; label: string }[] = [
    { addr: v.play_addr_h264, label: 'h264' },
    ...(v.bit_rate ?? []).filter((b) => !b.is_bytevc1).map((b) => ({ addr: b.play_addr, label: `${b.gear_name ?? '?'}/h264` })),
    { addr: v.download_no_watermark_addr, label: 'download_no_watermark' },
    { addr: v.play_addr, label: 'play_addr' },
  ];
  let best: { url: string; label: string; short: number } | null = null;
  for (const c of cands) {
    const url = c.addr?.url_list?.[0];
    if (!url) continue;
    const short = Math.min(c.addr?.width ?? 0, c.addr?.height ?? 0);
    if (!best || short > best.short) best = { url, label: c.label, short };
  }
  return best;
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
