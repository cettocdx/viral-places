#!/usr/bin/env node
/**
 * Keşif havuzunu ele (28.10.2026): authority-discover.mjs çıktısındaki aday videolar → authority-stage.mjs ile aynı
 * biçimde aday listesi (authority-resolve / authority-publish girdisi). Kredi harcamaz; yalnız AI çağrısı yapar.
 *  1) Ön eleme: ≥50k izlenme, son 24 ay, 6–180 sn, fotoğraf gönderisi değil, açıklamada tarif/evde işareti yok,
 *     dışlanan hesap değil (config/authority-creators.json "excluded").
 *  2) AI: önce VP_POOL_MODEL (varsayılan Sonnet), güveni düşükse VP_EXTRACTION_MODEL (Opus) ile ikinci karar.
 *     Mekanın kendi hesabı, tarif, liste videosu, reklam elenir.
 * Kullanım: set -a; . apps/worker/.env; set +a; node scripts/authority-pool-stage.mjs <keşif-dizini> <çıktı.json> [eşzamanlı=8]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const AI_URL = (process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com') + '/v1/messages';
const AI_KEY = process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY;
const FAST = process.env.VP_POOL_MODEL ?? 'anthropic/claude-sonnet-5.5';
const STRONG = process.env.VP_EXTRACTION_MODEL ?? 'anthropic/claude-opus-5.5';
if (!AI_KEY) throw new Error('AI anahtarı gerekli');
const [DIR, OUT] = process.argv.slice(2);
const CONCURRENCY = Number(process.argv[4] ?? 8);
const CACHE = join(DIR, 'ai');
mkdirSync(CACHE, { recursive: true });

const SINCE = Date.now() / 1000 - 730 * 86400;
const RECIPE = /(tarif|recipe|ingredients|malzeme|homemade|evde|ev yapımı|how to make|cook with me|receta|ricetta|recette|レシピ)/i;
const EXCLUDED = new Set(JSON.parse(readFileSync('config/authority-creators.json', 'utf8')).creators.filter((c) => c.status === 'excluded').map((c) => c.handle.toLowerCase()));

// Ham arama yanıtlarından tam video kaydı (konum etiketi, süre) — keşif özetinde yalnız bir kısmı var.
const AWEME = new Map();
for (const f of readdirSync(join(DIR, 'raw'))) {
  const j = JSON.parse(readFileSync(join(DIR, 'raw', f), 'utf8'));
  for (const it of j.search_item_list ?? []) { const a = it.aweme_info ?? it; if (a.aweme_id) AWEME.set(a.aweme_id, a); }
}
const pool = new Map();
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json') && !/^(summary|probe)/.test(x))) {
  const d = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  for (const v of d.videos) if (!pool.has(v.id)) pool.set(v.id, { ...v, searchCity: d.name });
}

let calls = 0, inTok = 0, outTok = 0, strongCalls = 0;
const SYSTEM = `TikTok videosunun açıklamasına bakıp karar ver. Yalnız JSON döndür:
{"venue_recommendation": bool, "home_cooking": bool, "poster_is_venue": bool, "sponsored_ad": bool, "venue_count": int, "venue_name": string|null, "city": string|null (mekanın bulunduğu şehir, yerel adıyla), "country_code": string|null (ISO-2), "neighborhood": string|null, "confidence": number (0-1), "reason": string (en fazla 12 kelime)}
venue_recommendation=true yalnız video izleyiciye belirli, gerçek bir yeme-içme mekanını (restoran, kafe, bar, tatlıcı, fırın, sokak tezgahı) öneriyor/inceliyorsa. Tarif, evde yemek, market ürünü, genel şehir turu, "en iyi 10 mekan" listesi = false.
poster_is_venue=true: hesap mekanın kendisi ya da zinciri (kendi ürününü tanıtıyor). venue_count: videoda adı geçen ayrı mekan sayısı. Ad açıklamada yoksa venue_name null. confidence: kararının ve mekan adının doğruluğuna güvenin.`;

async function ask(model, v, a) {
  const body = { model, max_tokens: 500, system: SYSTEM, messages: [{ role: 'user', content: `Hesap: @${v.handle} (${v.nickname ?? ''}, ${v.followers} takipçi)\nAranan şehir: ${v.searchCity}\nAçıklama: ${(v.desc ?? '').slice(0, 900)}\nKonum etiketi: ${a?.poi_info?.poi_name ?? a?.anchors?.[0]?.keyword ?? '-'} ${a?.poi_info?.address_info?.city_name ?? ''}` }] };
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(AI_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': AI_KEY, authorization: `Bearer ${AI_KEY}` }, body: JSON.stringify(body) }).catch(() => null);
    calls += 1;
    if (r?.ok) {
      const j = await r.json(); inTok += j.usage?.input_tokens ?? 0; outTok += j.usage?.output_tokens ?? 0;
      const t = (j.content ?? []).map((x) => x.text ?? '').join('');
      try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { /* yeniden dene */ }
    }
    await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
  }
  return { error: 'ai' };
}
async function classify(v, a) {
  const file = join(CACHE, `${v.id}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  let r = await ask(FAST, v, a);
  // Belirsiz kararlar (düşük güven, adı olan ama emin olunmayan mekan) güçlü modele sorulur.
  if (!r.error && r.venue_recommendation && (r.confidence ?? 0) < 0.75) { strongCalls++; const s = await ask(STRONG, v, a); if (!s.error) r = { ...s, by: 'strong' }; }
  if (!r.error) writeFileSync(file, JSON.stringify(r));
  return r;
}

const out = { candidates: [], rejected: {} };
const rej = (k) => { out.rejected[k] = (out.rejected[k] ?? 0) + 1; };
const todo = [];
for (const v of pool.values()) {
  const a = AWEME.get(v.id);
  if (EXCLUDED.has((v.handle ?? '').toLowerCase())) { rej('excluded_creator'); continue; }
  if (v.views < 50_000) { rej('views_below_50k'); continue; }
  if (v.created && v.created < SINCE) { rej('older_than_24m'); continue; }
  if (v.durationS && (v.durationS < 6 || v.durationS > 180)) { rej('duration'); continue; }
  if (v.width && v.height && v.width > v.height) { rej('horizontal'); continue; }
  if (RECIPE.test(v.desc ?? '')) { rej('recipe_caption'); continue; }
  todo.push([v, a]);
}
console.log(`havuz ${pool.size}, AI'ya giden ${todo.length}`);
let done = 0;
async function worker() {
  while (todo.length) {
    const [v, a] = todo.shift();
    const r = await classify(v, a);
    done++; if (done % 50 === 0) process.stdout.write(`${done} `);
    if (r.error) { rej('ai_error'); continue; }
    if (r.home_cooking || !r.venue_recommendation) { rej('not_a_venue_video'); continue; }
    if (r.poster_is_venue) { rej('poster_is_venue'); continue; }
    if (r.sponsored_ad) { rej('sponsored_ad'); continue; }
    if ((r.venue_count ?? 1) > 2) { rej('list_video'); continue; }
    out.candidates.push({ creator: v.handle, url: v.url, views: v.views, durationS: v.durationS, res: `${v.width}x${v.height}`, created: v.created ? new Date(v.created * 1000).toISOString().slice(0, 10) : null, venue: r.venue_name, city: r.city, country: r.country_code, neighborhood: r.neighborhood, reason: r.reason, desc: (v.desc ?? '').slice(0, 160), searchCity: v.searchCity, by: r.by ?? 'fast' });
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
out.usage = { aiCalls: calls, strongCalls, aiInputTokens: inTok, aiOutputTokens: outTok, fast: FAST, strong: STRONG };
writeFileSync(OUT, JSON.stringify(out, null, 2));
const perCity = {}; for (const c of out.candidates) perCity[c.searchCity] = (perCity[c.searchCity] ?? 0) + 1;
console.log('\n', out.usage, 'adaylar', out.candidates.length, out.rejected, perCity);
