#!/usr/bin/env node
/**
 * Şehir bazlı keşif (28.10.2026): seçili 15 şehrin her biri için yerel dilde ve İngilizce mekan aramaları yapar
 * (TikTok anahtar kelime araması, en çok beğenilen; sorgu sayfası başına 1 kredi). Çıktı: aday video havuzu
 * (≥50k izlenme) ve her şehrin en güçlü creator'ları (isabet sayısı, toplam izlenme, takipçi). Video indirmez.
 * Kullanım: set -a; . apps/worker/.env; set +a; node scripts/authority-discover.mjs <çıktı-dizini> [sayfa=2]
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.SCRAPECREATORS_API_KEY;
if (!KEY) throw new Error('SCRAPECREATORS_API_KEY yok');
const outDir = process.argv[2] ?? 'discover-out';
const PAGES = Number(process.argv[3] ?? 2);
const MIN_VIEWS = 50_000;
mkdirSync(join(outDir, 'raw'), { recursive: true });

const en = (c) => [`best restaurants ${c}`, `where to eat in ${c}`, `${c} food guide`, `${c} hidden gem restaurant`, `best coffee ${c}`];
const CITIES = {
  istanbul: { name: 'İstanbul', q: [...en('istanbul'), 'istanbul restoran önerisi', 'istanbul en iyi restoranlar', 'istanbul kahvaltı mekanları', 'istanbul kafe önerisi', 'istanbul gidilecek mekanlar'] },
  paris: { name: 'Paris', q: [...en('paris'), 'meilleur restaurant paris', 'où manger à paris', 'bonne adresse paris'] },
  london: { name: 'Londra', q: [...en('london'), 'london restaurant review', 'london brunch spot'] },
  milan: { name: 'Milano', q: [...en('milan'), 'migliori ristoranti milano', 'dove mangiare a milano', 'milano locali'] },
  'new-york': { name: 'New York', q: [...en('nyc'), 'best restaurants new york', 'nyc food spots'] },
  'los-angeles': { name: 'Los Angeles', q: [...en('los angeles'), 'la food spots', 'best restaurants la'] },
  madrid: { name: 'Madrid', q: [...en('madrid'), 'mejores restaurantes madrid', 'dónde comer en madrid', 'sitios para comer madrid'] },
  barcelona: { name: 'Barselona', q: [...en('barcelona'), 'mejores restaurantes barcelona', 'dónde comer en barcelona', 'on menjar a barcelona'] },
  rome: { name: 'Roma', q: [...en('rome'), 'migliori ristoranti roma', 'dove mangiare a roma', 'trattoria roma'] },
  florence: { name: 'Floransa', q: [...en('florence'), 'migliori ristoranti firenze', 'dove mangiare a firenze'] },
  ankara: { name: 'Ankara', q: ['ankara restoran önerisi', 'ankara en iyi restoranlar', 'ankara kafe önerisi', 'ankara kahvaltı mekanları', 'ankara gidilecek mekanlar', 'ankara yemek', 'ankara tatlıcı', 'ankara burger', 'ankara kebap', 'ankara çankaya mekan', 'ankara tunalı kafe', 'ankara bahçeli mekan', 'ankarada ne yenir', 'ankara lokanta'] },
  lisbon: { name: 'Lizbon', q: [...en('lisbon'), 'melhores restaurantes lisboa', 'onde comer em lisboa'] },
  izmir: { name: 'İzmir', q: ['izmir restoran önerisi', 'izmir en iyi restoranlar', 'izmir kafe önerisi', 'izmir kahvaltı mekanları', 'izmir gidilecek mekanlar', 'izmir yemek', 'best restaurants izmir', 'izmir boyoz', 'izmir kumru', 'izmir alsancak mekan', 'izmir karşıyaka mekan', 'izmir balık restoranı', 'izmir urla mekan', 'izmirde ne yenir', 'izmir tatlıcı'] },
  tokyo: { name: 'Tokyo', q: [...en('tokyo'), '東京 グルメ', '東京 おすすめ レストラン', 'tokyo ramen', 'tokyo sushi', 'tokyo izakaya', 'shibuya food', 'shinjuku food', 'tokyo cafe', '渋谷 グルメ', '新宿 グルメ', '東京 ラーメン', '東京 カフェ'] },
  amsterdam: { name: 'Amsterdam', q: [...en('amsterdam'), 'beste restaurants amsterdam', 'waar eten in amsterdam'] },
};

let credits = 0;
async function search(query, cursor) {
  const file = join(outDir, 'raw', `${Buffer.from(`${query}|${cursor}`).toString('base64url')}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const url = `https://api.scrapecreators.com/v1/tiktok/search/keyword?query=${encodeURIComponent(query)}&sort_by=most-liked${cursor ? `&cursor=${cursor}` : ''}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, { headers: { 'x-api-key': KEY } }).catch(() => null);
    if (r?.ok) {
      const j = await r.json();
      credits += Number(j.credits_charged ?? 1);
      writeFileSync(file, JSON.stringify(j));
      return j;
    }
    await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
  }
  return null;
}

// VP_DISCOVER_ONLY: yalnız seçili şehir anahtarları (ince şehirleri derinleştirmek için, 29.10.2026).
const ONLY = new Set((process.env.VP_DISCOVER_ONLY ?? '').split(',').filter(Boolean));
const summary = {};
for (const [key, city] of Object.entries(CITIES).filter(([k]) => !ONLY.size || ONLY.has(k))) {
  const videos = new Map();
  for (const q of city.q) {
    let cursor = 0;
    for (let p = 0; p < PAGES; p++) {
      const j = await search(q, cursor);
      if (!j) break;
      for (const it of j.search_item_list ?? []) {
        const a = it.aweme_info ?? it;
        const views = Number(a.statistics?.play_count ?? 0);
        if (!a.aweme_id || views < MIN_VIEWS || a.image_post_info) continue;
        const prev = videos.get(a.aweme_id);
        if (prev) { prev.queries.push(q); continue; }
        videos.set(a.aweme_id, {
          id: a.aweme_id,
          url: `https://www.tiktok.com/@${a.author?.unique_id}/video/${a.aweme_id}`,
          handle: a.author?.unique_id,
          nickname: a.author?.nickname,
          followers: Number(a.author?.follower_count ?? 0),
          views,
          durationS: Math.round(Number(a.video?.duration ?? 0) / 1000),
          height: Number(a.video?.height ?? 0),
          width: Number(a.video?.width ?? 0),
          created: Number(a.create_time ?? 0),
          desc: a.desc ?? '',
          queries: [q],
        });
      }
      if (!j.has_more) break;
      cursor = Number(j.cursor ?? 0);
    }
    process.stdout.write('.');
  }
  const creators = new Map();
  for (const v of videos.values()) {
    const c = creators.get(v.handle) ?? { handle: v.handle, nickname: v.nickname, followers: v.followers, hits: 0, views: 0 };
    c.hits += 1; c.views += v.views; c.followers = Math.max(c.followers, v.followers);
    creators.set(v.handle, c);
  }
  const ranked = [...creators.values()].sort((a, b) => b.hits - a.hits || b.views - a.views);
  summary[key] = { name: city.name, videos: videos.size, creators: ranked.length };
  writeFileSync(join(outDir, `${key}.json`), JSON.stringify({ city: key, name: city.name, creators: ranked, videos: [...videos.values()].sort((a, b) => b.views - a.views) }, null, 2));
  console.log(` ${city.name}: ${videos.size} video, ${ranked.length} creator`);
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ credits, summary }, null, 2));
console.log(`~${credits} kredi`);
