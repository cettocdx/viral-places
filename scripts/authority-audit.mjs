#!/usr/bin/env node
/**
 * Yayındaki videoların içerik denetimi (29.10.2026): video doğrudan o mekanı mı öneriyor/inceliyor?
 * Açıklama + konuşma metni (transkript, 1 kredi; önbellekli) + videodan 4 kare (Storage dosyasından ffmpeg) → Claude.
 * Elenir: mekan yalnız geçerken anılıyor (vlog, şehir turu), liste/derleme, tarif/evde yemek, reklam, videodaki mekan
 * kayıttaki mekan değil, mekanın kendi hesabı. Belirsiz kararlar (güven <0.75) güçlü modele sorulur.
 * --apply: elenen kaynak satırları yedeklenip (audit-removed.json) silinir; kaynağı kalmayan mekan 'hidden' olur.
 *   Storage dosyaları silinmez.
 * Kullanım: set -a; . apps/worker/.env; set +a; node scripts/authority-audit.mjs <iş-klasörü> [--apply]
 */
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT = 'uwmbxcsvkieqyzhutjag';
const AI_URL = (process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com') + '/v1/messages';
const AI_KEY = process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY;
const FAST = process.env.VP_POOL_MODEL ?? 'anthropic/claude-sonnet-5.5';
const STRONG = process.env.VP_EXTRACTION_MODEL ?? 'anthropic/claude-opus-5.5';
const SC_KEY = process.env.SCRAPECREATORS_API_KEY;
const TRANSCRIPTS = process.env.VP_TRANSCRIPT_CACHE ?? join(process.env.HOME, 'viral-places-ref/content/transcripts');
const [WORK] = process.argv.slice(2);
const APPLY = process.argv.includes('--apply');
if (!AI_KEY || !SC_KEY || !WORK) throw new Error('AI anahtarı, SCRAPECREATORS_API_KEY ve iş klasörü gerekli');
for (const d of ['frames', 'ai']) mkdirSync(join(WORK, d), { recursive: true });
mkdirSync(TRANSCRIPTS, { recursive: true });

const q = (s) => JSON.parse(execFileSync('npx', ['-y', 'supabase@2.122.0', 'db', 'query', '--linked', '--project-ref', PROJECT, s], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })).rows;
// Kod noktası güvenli kesme: .slice yarım emoji (tek surrogate) bırakıp isteği geçersiz kılıyordu.
const cut = (s, n) => Array.from(s ?? '').slice(0, n).join('');
const sql = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);

async function transcript(url) {
  const file = join(TRANSCRIPTS, `${url.split('/').pop()}.txt`);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  const r = await fetch(`https://api.scrapecreators.com/v1/tiktok/video/transcript?url=${encodeURIComponent(url)}&use_ai_as_fallback=false`, { headers: { 'x-api-key': SC_KEY } }).catch(() => null);
  const t = r?.ok ? ((await r.json()).transcript ?? '') : null;
  if (t != null) writeFileSync(file, t);
  return t ?? '';
}

// Eşzamansız: senkron ffmpeg tüm işçileri sıraya sokuyordu (video başına ~25 sn).
async function frames(id, videoUrl) {
  const files = [0, 1, 2, 3].map((i) => join(WORK, 'frames', `${id}-${i}.jpg`));
  if (!files.every((f) => existsSync(f))) {
    const dur = Number((await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', videoUrl]).catch(() => ({ stdout: '' }))).stdout.trim()) || 20;
    await Promise.all([0.1, 0.35, 0.6, 0.85].map((pct, i) => existsSync(files[i]) ? null : run('ffmpeg', ['-v', 'error', '-y', '-ss', String(dur * pct), '-i', videoUrl, '-frames:v', '1', '-vf', 'scale=384:-2', '-q:v', '5', files[i]]).catch(() => null)));
  }
  return files.filter((f) => existsSync(f)).map((f) => readFileSync(f).toString('base64'));
}

const SYSTEM = `Bir yemek-mekan uygulaması için TikTok videosunu denetliyorsun. Uygulamada bu video, belirtilen mekanın sayfasında "bu mekanı öneren video" olarak gösterilecek. Sana açıklama, konuşma metni ve videodan 4 kare veriliyor. Yalnız JSON döndür:
{"kind": "recommendation"|"review"|"passing_mention"|"list"|"recipe"|"ad"|"venue_own_account"|"other", "direct_recommendation": bool, "venue_matches": bool, "confidence": number (0-1), "reason": string (en fazla 15 kelime, Türkçe)}
direct_recommendation=true yalnız video bütünüyle (ya da açıkça ağırlıklı olarak) bu tek mekanı izleyiciye öneriyor veya inceliyorsa: mekana gidiliyor, yemekleri gösteriliyor/yorumlanıyor, gitmeye değer deniyor. Olumsuz inceleme ("gitmeyin") da false. Şehir turu/vlog içinde geçerken anılması, birden çok mekanın sıralandığı liste, tarif, ürün reklamı, mekanın kendi tanıtımı = false.
venue_matches=true: videodaki mekan, belirtilen mekan adı ve şehirle aynı (ad tabelada, açıklamada ya da konuşmada geçiyor ya da açıkça o mekan). Emin değilsen ve çelişen bir ipucu yoksa true.`;

async function ask(model, row, tr, imgs) {
  const content = [
    ...imgs.map((data) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } })),
    { type: 'text', text: `Kayıttaki mekan: ${row.venue} (${row.city})\nHesap: @${row.handle ?? '?'}\nAçıklama: ${cut(row.desc ?? '', 700)}\nKonuşma metni: ${cut((tr || '(yok)').replace(/\s+/g, ' '), 2500)}` },
  ];
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(AI_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': AI_KEY, authorization: `Bearer ${AI_KEY}` }, body: JSON.stringify({ model, max_tokens: 300, system: SYSTEM, messages: [{ role: 'user', content }] }) }).catch(() => null);
    if (r?.ok) {
      const j = await r.json();
      const t = (j.content ?? []).map((x) => x.text ?? '').join('');
      try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { /* yeniden dene */ }
    }
    await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
  }
  return { error: 'ai' };
}

const rows = q(`select s.id, s.source_url, s.video_url, v.id venue_id, v.own_name venue, c.name city, a.handle
  from public.venue_sources s join public.venues v on v.id = s.venue_id join public.cities c on c.id = v.city_id
  left join public.creator_accounts a on a.creator_id = s.creator_id and a.platform = 'tiktok'
  where s.video_url is not null and v.status = 'published'`);
// Aynı creator'ın birden çok hesabı varsa satır tekrarlanır; kaynak kimliğine göre teke indir.
const uniq = [...new Map(rows.map((r) => [r.id, r])).values()];
// Açıklamalar keşif/eleme dosyalarından (veritabanında yok).
const DESC = new Map();
for (const f of ['pool-resolved.json', 'stage4.json', 'stage3.json', 'stage2.json', 'stage.json']) {
  const p = join(process.env.HOME, 'viral-places-ref/content', f);
  if (existsSync(p)) for (const c of JSON.parse(readFileSync(p, 'utf8')).candidates ?? []) if (c.url && !DESC.has(c.url)) DESC.set(c.url, c.desc);
}
console.log(`denetlenecek ${uniq.length} video`);

let done = 0, strong = 0;
const todo = [...uniq];
const decisions = [];
async function worker() {
  for (let row = todo.shift(); row; row = todo.shift()) {
    const file = join(WORK, 'ai', `${row.id}.json`);
    let d = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
    if (!d) {
      row.desc = DESC.get(row.source_url) ?? '';
      const tr = await transcript(row.source_url);
      const imgs = await frames(row.id, row.video_url);
      d = await ask(FAST, row, tr, imgs);
      // Kareler reddedilirse (içerik filtresi, bozuk kare) yalnız metinle karar verilir.
      if (d.error && imgs.length) d = await ask(FAST, row, tr, []);
      if (!d.error && (d.confidence ?? 0) < 0.75) { strong++; const s = await ask(STRONG, row, tr, imgs); if (!s.error) d = { ...s, by: 'strong' }; }
      if (!d.error) writeFileSync(file, JSON.stringify(d));
    }
    decisions.push({ ...row, ...d, keep: !d.error && d.direct_recommendation && d.venue_matches });
    if (++done % 50 === 0) process.stdout.write(`${done} `);
  }
}
await Promise.all(Array.from({ length: 12 }, worker));

const removed = decisions.filter((d) => !d.error && !d.keep);
const errors = decisions.filter((d) => d.error);
const byKind = {}; for (const d of removed) byKind[d.kind] = (byKind[d.kind] ?? 0) + 1;
writeFileSync(join(WORK, 'audit.json'), JSON.stringify({ total: decisions.length, keep: decisions.length - removed.length - errors.length, removed: removed.length, errors: errors.length, strongCalls: strong, byKind, decisions }, null, 1));
console.log('\n', { total: decisions.length, removed: removed.length, errors: errors.length, strongCalls: strong, byKind });
if (!APPLY) { console.log('DENEME: hiçbir şey değişmedi. Uygulamak için --apply.'); process.exit(0); }

const ids = removed.map((d) => sql(d.id)).join(',');
const backup = q(`select * from public.venue_sources where id in (${ids})`);
writeFileSync(join(WORK, 'audit-removed.json'), JSON.stringify(backup, null, 1));
const file = join(WORK, 'audit-apply.sql');
writeFileSync(file, `begin;
delete from public.venue_sources where id in (${ids});
update public.venues set status = 'hidden', updated_at = now() where id in (${[...new Set(removed.map((d) => sql(d.venue_id)))].join(',')}) and not exists (select 1 from public.venue_sources s where s.venue_id = venues.id);
commit;`);
execFileSync('npx', ['-y', 'supabase@2.122.0', 'db', 'query', '--linked', '--project-ref', PROJECT, '-f', file], { encoding: 'utf8' });
console.log(`uygulandı: ${backup.length} kaynak satırı silindi (yedek audit-removed.json)`);
