#!/usr/bin/env node
/**
 * Otorite hesaplarından mekan videosu adayları (27.10.2026, ürün sahibi kuralları — ADR-027 kalite kapısı):
 *  1) Hesabın son videoları (/v3/tiktok/profile/videos, sayfa başına 1 kredi).
 *  2) Ön eleme (kredisiz): son 12 ay, ≥50k izlenme (ürün sahibi, 28.10.2026), şehir elemesi yok, 6–120 sn, dikey ve en iyi akış ≥720 kısa kenar (API üst sınırı),
 *     açıklamada tarif/evde işareti yok.
 *  3) AI (OpenRouter/Anthropic uyumlu): "tek bir gerçek mekanı mı öneriyor; evde yemek değil; liste değil?" → mekan adı, şehir, semt.
 * Veritabanına yazmaz; çıktıyı ürün sahibi onayı için JSON'a yazar.
 * Kullanım: set -a; . apps/worker/.env; set +a; node scripts/authority-stage.mjs <çıktı.json> [sayfa=2]
 */
import { readFileSync, writeFileSync } from 'node:fs';
const KEY = process.env.SCRAPECREATORS_API_KEY;
const AI_URL = (process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com') + '/v1/messages';
const AI_KEY = process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.VP_STAGE_MODEL ?? process.env.VP_EXTRACTION_MODEL ?? 'anthropic/claude-opus-5.5';
if (!KEY || !AI_KEY) throw new Error('SCRAPECREATORS_API_KEY ve AI anahtarı gerekli');
const OUT = process.argv[2] ?? 'stage.json';
const PAGES = Number(process.argv[3] ?? 2);
const CITIES = ['İstanbul','Paris','Londra','Milano','New York','Los Angeles','Madrid','Barselona','Roma','Floransa','Ankara','Lizbon','İzmir','Tokyo','Amsterdam'];
const cfg = JSON.parse(readFileSync('config/authority-creators.json', 'utf8')).creators.filter((c) => c.status === 'verified' || c.status === 'existing');
const SINCE = Date.now() / 1000 - 365 * 86400;
const AWEME_BY_ID = new Map();
const RECIPE = /(tarif|recipe|ingredients|malzeme|homemade|evde|ev yapımı|how to make|cook with me|receta|ricetta|recette)/i;
let credits = 0, aiCalls = 0, aiIn = 0, aiOut = 0;

/** En iyi akış (H.264 ya da HEVC). ScrapeCreators TikTok'tan en fazla 720×1280 veriyor (27.10.2026 ölçümü); iOS HEVC'yi oynatır. */
function bestH264(v) {
  const c = [v?.play_addr_h264, v?.play_addr_bytevc1, ...(v?.bit_rate ?? []).filter((b) => !b.is_bytevc2 && !/bvc2|bytevc2/i.test(b.gear_name ?? '')).map((b) => b.play_addr), v?.download_no_watermark_addr, v?.play_addr].filter((a) => a?.url_list?.[0]);
  let best = null;
  for (const a of c) { const s = Math.min(a.width ?? 0, a.height ?? 0); if (!best || s > best.short) best = { short: s, w: a.width, h: a.height }; }
  return best;
}
async function sc(path, qs) {
  // Tekrar çalıştırma: önceki turun kaydedilmiş listeleri (kredi harcamaz).
  if (process.env.VP_STAGE_REPLAY) {
    const fs = await import('node:fs'); const f = `${process.env.VP_STAGE_REPLAY}/${qs.handle}-${qs.max_cursor ? 1 : 0}.json`;
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
  }
  const r = await fetch(`https://api.scrapecreators.com${path}?${new URLSearchParams(qs)}`, { headers: { 'x-api-key': KEY } }).catch(() => null);
  credits += 1;
  return r && r.ok ? r.json() : null;
}
async function classify(c, a) {
  const body = { model: MODEL, max_tokens: 700, system: `TikTok videosunun açıklamasına bakıp karar ver. Yalnız JSON döndür:
{"venue_recommendation": bool, "home_cooking": bool, "venue_count": int, "venue_name": string|null, "city": string|null (mekanın bulunduğu şehir, yerel adıyla), "country_code": string|null (ISO-2), "neighborhood": string|null, "reason": string (en fazla 12 kelime)}
venue_recommendation=true yalnız video izleyiciye belirli, gerçek bir yeme-içme mekanını (restoran, kafe, bar, tatlıcı, sokak tezgahı) öneriyor/inceliyorsa. Tarif, evde yemek, market ürünü, marka reklamı, genel liste/şehir turu = false. venue_count: videoda adı geçen ayrı mekan sayısı. Şehir belli değilse null.`,
    messages: [{ role: 'user', content: `Hesap: @${c.handle} (${c.name}, şehirleri: ${c.cities.join(', ')})\nAçıklama: ${(a.desc ?? '').slice(0, 900)}\nKonum etiketi: ${a.poi_info?.poi_name ?? a.anchors?.[0]?.keyword ?? '-'} ${a.poi_info?.address_info?.city_name ?? ''}` }] };
  let r = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    r = await fetch(AI_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': AI_KEY, authorization: `Bearer ${AI_KEY}` }, body: JSON.stringify(body) }).catch(() => null);
    aiCalls += 1;
    if (r && r.ok) break;
    await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
  }
  if (!r || !r.ok) return { error: r ? r.status : 'net' };
  const j = await r.json(); aiIn += j.usage?.input_tokens ?? 0; aiOut += j.usage?.output_tokens ?? 0;
  const t = (j.content ?? []).map((x) => x.text ?? '').join('');
  try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { return { error: 'parse', raw: t.slice(0, 200) }; }
}

const out = { candidates: [], rejected: {}, perCreator: {} };
const rej = (k) => { out.rejected[k] = (out.rejected[k] ?? 0) + 1; };
for (const c of cfg) {
  let cursor; let seen = 0, kept = 0;
  for (let p = 0; p < PAGES; p++) {
    const d = await sc('/v3/tiktok/profile/videos', { handle: c.handle, sort_by: 'latest', trim: 'true', ...(cursor ? { max_cursor: String(cursor) } : {}) });
    const list = d?.aweme_list ?? [];
    if (process.env.VP_STAGE_CACHE) { const fs = await import('node:fs'); fs.mkdirSync(process.env.VP_STAGE_CACHE, { recursive: true }); fs.writeFileSync(`${process.env.VP_STAGE_CACHE}/${c.handle}-${p}.json`, JSON.stringify(d)); }
    for (const a of list) {
      seen++;
      AWEME_BY_ID.set(a.aweme_id, a);
      const views = Number(a.statistics?.play_count ?? 0), dur = (a.video?.duration ?? a.duration ?? 0) / (a.video?.duration > 1000 ? 1000 : 1);
      const best = bestH264(a.video);
      if ((a.create_time ?? 0) < SINCE) { rej('older_than_12m'); continue; }
      if (views < 50_000) { rej('views_below_50k'); continue; }
      if (!best || best.short < 720 || !(best.h > best.w)) { rej('below_720p_or_horizontal'); continue; }
      if (dur && (dur < 6 || dur > 180)) { rej('duration'); continue; }
      if (RECIPE.test(a.desc ?? '')) { rej('recipe_caption'); continue; }
      const v = await classify(c, a);
      if (v.error) { rej('ai_error_' + v.error); continue; }
      if (v.home_cooking || !v.venue_recommendation) { rej('not_a_venue_video'); continue; }
      if ((v.venue_count ?? 1) > 2) { rej('list_video'); continue; }
      // Şehir eleme yok (ürün sahibi, 28.10.2026): her şehir eklenebilir; yalnız şehir hiç anlaşılmıyorsa sonra çözülür.
      kept++;
      out.candidates.push({ creator: c.handle, url: `https://www.tiktok.com/@${c.handle}/video/${a.aweme_id}`, views, durationS: Math.round(dur), res: `${best.w}x${best.h}`, created: new Date(a.create_time * 1000).toISOString().slice(0, 10), venue: v.venue_name, city: v.city, country: v.country_code, neighborhood: v.neighborhood, reason: v.reason, desc: (a.desc ?? '').slice(0, 160) });
    }
    if (!d?.has_more) break;
    cursor = d.max_cursor;
  }
  out.perCreator[c.handle] = { seen, kept };
  process.stdout.write(`@${c.handle}:${kept}/${seen} `);
}
out.usage = { scrapeCreatorsCredits: credits, usd: +(credits * 0.00188).toFixed(3), aiCalls, aiInputTokens: aiIn, aiOutputTokens: aiOut, model: MODEL };
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log('\n', out.usage, 'adaylar', out.candidates.length, out.rejected);
