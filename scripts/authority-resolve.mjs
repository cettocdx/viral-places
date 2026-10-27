#!/usr/bin/env node
/**
 * Adı ya da şehri belli olmayan aday videoları transkriptle çöz (28.10.2026). Transkript: ScrapeCreators (1 kredi/video);
 * karar: aynı AI ucu. Mekan yine belirsizse aday düşer. Girdi/çıktı: authority-stage.mjs JSON'u.
 * Kullanım: set -a; . apps/worker/.env; set +a; node scripts/authority-resolve.mjs <girdi.json> <çıktı.json>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const KEY = process.env.SCRAPECREATORS_API_KEY;
const AI_URL = (process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com') + '/v1/messages';
const AI_KEY = process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.VP_EXTRACTION_MODEL ?? 'anthropic/claude-opus-5.5';
const [IN, OUT] = process.argv.slice(2);
const d = JSON.parse(readFileSync(IN, 'utf8'));
let credits = 0, resolved = 0, dropped = 0;
async function ai(user) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(AI_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': AI_KEY, authorization: `Bearer ${AI_KEY}` }, body: JSON.stringify({ model: MODEL, max_tokens: 400, system: 'Bir yemek videosunun transkripti ve açıklamasından önerilen TEK gerçek mekanı çıkar. Yalnız JSON: {"venue_name": string|null, "city": string|null, "country_code": string|null, "neighborhood": string|null, "venue_count": int, "home_cooking": bool}. Emin değilsen venue_name null.', messages: [{ role: 'user', content: user }] }) }).catch(() => null);
    if (r?.ok) { const j = await r.json(); const t = (j.content ?? []).map((x) => x.text ?? '').join(''); try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { return null; } }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  return null;
}
const keep = [];
for (const c of d.candidates) {
  if (c.venue && c.city) { keep.push(c); continue; }
  // Transkript önbelleği: yarıda kalan bir turdan sonra aynı video için ikinci kez kredi harcanmaz.
  const cacheFile = process.env.VP_TRANSCRIPT_CACHE ? `${process.env.VP_TRANSCRIPT_CACHE}/${c.url.split('/').pop()}.txt` : null;
  let tr;
  if (cacheFile && existsSync(cacheFile)) tr = readFileSync(cacheFile, 'utf8');
  else {
    const r = await fetch(`https://api.scrapecreators.com/v1/tiktok/video/transcript?url=${encodeURIComponent(c.url)}&use_ai_as_fallback=false`, { headers: { 'x-api-key': KEY } }).catch(() => null);
    credits += 1;
    tr = r?.ok ? ((await r.json()).transcript ?? '') : '';
    if (cacheFile) { mkdirSync(process.env.VP_TRANSCRIPT_CACHE, { recursive: true }); writeFileSync(cacheFile, tr); }
  }
  const v = await ai(`Açıklama: ${c.desc}\nBilinen: mekan=${c.venue ?? '-'} şehir=${c.city ?? '-'}\nTranskript: ${tr.slice(0, 6000)}`);
  if (v && v.venue_name && v.city && !v.home_cooking && (v.venue_count ?? 1) <= 2) {
    keep.push({ ...c, venue: v.venue_name, city: v.city, country: v.country_code ?? c.country, neighborhood: v.neighborhood ?? c.neighborhood, resolvedBy: 'transcript' }); resolved++;
  } else dropped++;
  process.stdout.write(v?.venue_name ? '+' : '-');
}
writeFileSync(OUT, JSON.stringify({ ...d, candidates: keep, resolve: { credits, resolved, dropped } }, null, 2));
console.log(`\nçözüldü ${resolved}, düştü ${dropped}, ~${credits} kredi, kalan aday ${keep.length}`);
