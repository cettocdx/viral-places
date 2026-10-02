#!/usr/bin/env node
/**
 * İstanbul mekan/yemek creator keşfi (vp-creator-coverage).
 * Kaynak: ScrapeCreators TikTok arama (keyword + users) → yazar tekilleştirme (platform uid) →
 * takipçi eşiği → son videolar ile süreklilik ve konu uyumu ölçümü.
 * Arama sonucu "dünyanın en iyi listesi" değildir; yalnız bu sorgularla bulunan adaylardır.
 *
 * Kullanım: set -a; . apps/worker/.env; set +a; node scripts/discover-creators.mjs <çıktı-klasörü>
 * Maliyet: her başarılı istek 1 kredi (PRICE_SCRAPECREATORS_USD_PER_CREDIT).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.SCRAPECREATORS_API_KEY;
if (!KEY) throw new Error('SCRAPECREATORS_API_KEY yok');
const OUT = process.argv[2] ?? 'discovery-out';
mkdirSync(OUT, { recursive: true });

const MIN_FOLLOWERS = Number(process.env.VP_MIN_FOLLOWERS ?? 300_000);
const MIN_TOPICAL_POSTS = 10;
const ACTIVE_MAX_DAYS_SINCE_LAST = 21;
const ACTIVE_MIN_POSTS_90D = 8;
const MAX_VIDEO_PAGES = Number(process.env.VP_MAX_VIDEO_PAGES ?? 8); // sayfa başına ~10 video

const QUERIES = [
  'istanbul mekan', 'istanbul mekan önerisi', 'istanbul yemek', 'istanbul restoran', 'istanbul kafe', 'istanbul kahvaltı',
  'istanbul lezzet', 'istanbul gurme', 'istanbul sokak lezzetleri', 'istanbul nerede yenir', 'istanbul burger', 'istanbul brunch',
  'istanbul tatlı', 'istanbul kebap', 'istanbul balık restoranı', 'istanbul fine dining', 'istanbul gezilecek yerler', 'istanbul date mekanı',
  'kadıköy mekan', 'beşiktaş mekan', 'karaköy kafe', 'nişantaşı restoran', 'bebek kahvaltı', 'moda kadıköy yemek', 'eminönü lezzet',
  'istanbul food', 'istanbul food tour', 'best food istanbul', 'istanbul street food', 'where to eat istanbul', 'istanbul restaurant review',
  'yemek eleştirmeni', 'restoran yorumu', 'gurme', 'lezzet avcısı', 'mekan incelemesi',
  'üsküdar mekan', 'şişli restoran', 'sarıyer balık', 'ataşehir kafe', 'bakırköy yemek', 'fatih lezzet', 'balat kafe', 'galata mekan',
  'cihangir kafe', 'ortaköy kumpir', 'kuzguncuk kahvaltı', 'etiler restoran', 'levent öğle yemeği', 'beylikdüzü mekan', 'kartal yemek',
  'istanbul meyhane', 'istanbul steakhouse', 'istanbul sushi', 'istanbul pizza', 'istanbul döner', 'istanbul lahmacun', 'istanbul baklava',
  'istanbul kahve', 'istanbul pastane', 'istanbul esnaf lokantası', 'istanbul ucuz yemek', 'istanbul uygun fiyatlı mekan', 'istanbul manzaralı mekan',
  'istanbul çocuklu mekan', 'istanbul rooftop', 'istanbul vegan', 'istanbul ocakbaşı', 'istanbul kokoreç', 'istanbul midye', 'istanbul iskender',
  'istanbul yeni açılan mekan', 'istanbul viral mekan', 'istanbulda ne yenir', 'istanbul hidden gems', 'istanbul cafe guide',
];
const USER_QUERIES = ['istanbul gurme', 'istanbul mekan', 'istanbul food', 'gurme', 'lezzet', 'yemek rehberi', 'food istanbul', 'mekan rehberi', 'restoran'];

const ISTANBUL_RE = /istanbul|i̇stanbul|kadıköy|kadikoy|beşiktaş|besiktas|karaköy|karakoy|nişantaşı|nisantasi|beyoğlu|beyoglu|taksim|üsküdar|uskudar|bebek|moda|şişli|sisli|fatih|eminönü|eminonu|sarıyer|sariyer|ataşehir|atasehir|bakırköy|bakirkoy|cihangir|galata|ortaköy|ortakoy|balat|arnavutköy|kuruçeşme|etiler|levent|maslak|florya|yeşilköy|kartal|maltepe|pendik|çengelköy|kuzguncuk|beykoz|sultanahmet|kapalıçarşı|boğaz|bosphorus/i;
const PLACE_RE = /mekan|restoran|restaurant|kafe|cafe|café|kahvaltı|brunch|burger|pizza|kebap|kebab|döner|doner|lokanta|meyhane|balık|tatlı|baklava|künefe|dürüm|pide|lahmacun|köfte|kokoreç|midye|steak|et restoran|sushi|ramen|bar |kahve|coffee|pastane|fırın|börek|menü|fiyat|lezzet|yemek|food|eat|dining|chef|şef|tadım|gurme|nereye|adres|konum|📍/i;

const BUSINESS_RE = /adres|address|sipariş|siparis|rezervasyon|şube|sube|paket servis|mahallesi|cad\.|caddesi|sokak no|no:|pazar günleri kapalı|açılış saat|whatsapp hattı|franchise/i;
function poiText(a) {
  const p = a.poi ?? a.poi_info;
  return `${a.desc ?? ''} ${p?.poi_name ?? ''} ${p?.address_info?.city_name ?? ''}`;
}
function isTopical(a) {
  const t = poiText(a);
  return PLACE_RE.test(t) && (ISTANBUL_RE.test(t) || !!(a.poi ?? a.poi_info)?.poi_name);
}

let credits = 0;
async function sc(path, params) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://api.scrapecreators.com${path}?${qs}`, { headers: { 'x-api-key': KEY } }).catch(() => null);
    if (res?.ok) {
      credits++;
      return res.json();
    }
    if (res && res.status < 500 && res.status !== 429) throw new Error(`${path} ${res.status}`);
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw new Error(`${path} başarısız`);
}

const candidates = new Map(); // uid → aday
function note(u, via) {
  if (!u?.uid || !u.unique_id) return;
  const c = candidates.get(u.uid) ?? { uid: u.uid, handle: u.unique_id, nickname: u.nickname, followersSearch: 0, via: new Set(), hits: 0 };
  c.followersSearch = Math.max(c.followersSearch, Number(u.follower_count ?? 0));
  c.via.add(via);
  c.hits++;
  candidates.set(u.uid, c);
}

// 1) Keşif (paralel; sonuç dosyaya yazılır, VP_REUSE_SEARCH=1 ile yeniden kullanılır → arama kredisi tekrar harcanmaz)
const CACHE = join(OUT, 'search-candidates.json');
if (process.env.VP_REUSE_SEARCH === '1' && existsSync(CACHE)) {
  for (const c of JSON.parse(readFileSync(CACHE, 'utf8'))) candidates.set(c.uid, { ...c, via: new Set(c.via) });
} else {
  const kwJobs = QUERIES.map((q) => async () => {
    let cursor;
    for (let page = 0; page < 3; page++) {
      try {
        const d = await sc('/v1/tiktok/search/keyword', { query: q, region: 'TR', cursor });
        for (const it of d.search_item_list ?? []) note(it.aweme_info?.author, `kw:${q}`);
        if (!d.has_more) break;
        cursor = d.cursor;
      } catch (e) {
        console.error('kw', q, e.message);
        break;
      }
    }
  });
  const userJobs = USER_QUERIES.map((q) => async () => {
    try {
      const d = await sc('/v1/tiktok/search/users', { query: q });
      for (const it of d.user_list ?? []) note(it.user_info, `user:${q}`);
    } catch (e) {
      console.error('users', q, e.message);
    }
  });
  const jobs = [...kwJobs, ...userJobs];
  let j = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (j < jobs.length) await jobs[j++](); }));
  writeFileSync(CACHE, JSON.stringify([...candidates.values()].map((c) => ({ ...c, via: [...c.via] }))));
}
console.error(`keşif: ${candidates.size} tekil yazar, ${credits} kredi`);

// 2) Eşik + doğrulama
// VP_SKIP_HANDLES: zaten izlenen ya da önceki koşuda doğrulanmış hesaplar yeniden kredi harcamasın (virgülle).
const SKIP = new Set((process.env.VP_SKIP_HANDLES ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean));
const big = [...candidates.values()].filter((c) => c.followersSearch >= MIN_FOLLOWERS * 0.9 && !SKIP.has(c.handle.toLowerCase()));
console.error(`eşik adayı: ${big.length}`);
const now = Date.now() / 1000;
const results = [];
// Paralel doğrulama: sıralı koşu 396 adayın 31'inde zaman sınırına takılıyordu (02.10.2026).
const CONCURRENCY = Number(process.env.VP_DISCOVERY_CONCURRENCY ?? 6);
const writePartial = () => writeFileSync(join(OUT, 'creator-discovery.partial.json'), JSON.stringify({ results }, null, 2));
let next = 0;
async function verifyWorker() {
  while (next < big.length) {
    const c = big[next++];
    await verifyOne(c);
    if (results.length % 20 === 0) writePartial();
  }
}
async function verifyOne(c) {
  try {
    const prof = await sc('/v1/tiktok/profile', { handle: c.handle });
    const followers = Number(prof.stats?.followerCount ?? prof.statsV2?.followerCount ?? 0);
    const vids = [];
    let cursor;
    for (let page = 0; page < MAX_VIDEO_PAGES; page++) {
      const d = await sc('/v3/tiktok/profile/videos', { handle: c.handle, user_id: c.uid, sort_by: 'latest', max_cursor: cursor, trim: 'true' });
      vids.push(...(d.aweme_list ?? []));
      if (!(d.has_more === true || d.has_more === 1)) break;
      // Kriter toplam ≥10 konu gönderisi: ulaşınca daha eski sayfaları çekme (kredi tasarrufu).
      if (vids.filter((a) => isTopical(a)).length >= MIN_TOPICAL_POSTS) break;
      cursor = String(d.max_cursor);
    }
    const posts = vids
      .filter((a) => !a.is_top) // sabitlenmiş eski videolar sürekliliği bozmasın
      .map((a) => ({ t: Number(a.create_time), views: Number(a.statistics?.play_count ?? 0), topical: isTopical(a), ad: !!a.is_ad }))
      .sort((x, y) => y.t - x.t);
    const last = posts[0]?.t ?? 0;
    const posts90 = posts.filter((p) => now - p.t <= 90 * 86400).length;
    const topical = posts.filter((p) => p.topical).length;
    const views = posts.map((p) => p.views).sort((a, b) => a - b);
    const median = views.length ? views[Math.floor(views.length / 2)] : 0;
    const r = {
      handle: c.handle, uid: c.uid, nickname: prof.user?.nickname ?? c.nickname, verified: !!prof.user?.verified, private: !!prof.user?.privateAccount,
      bio: prof.user?.signature ?? '', likelyBusiness: BUSINESS_RE.test(prof.user?.signature ?? ''), followers, videoCountTotal: Number(prof.stats?.videoCount ?? 0),
      sampled: posts.length, daysSinceLast: last ? Math.round((now - last) / 86400) : null, posts90, topicalIstanbulPlacePosts: topical,
      topicalShare: posts.length ? +(topical / posts.length).toFixed(2) : 0, medianViews: median, discoveredVia: [...c.via].slice(0, 5),
    };
    r.pass = {
      followers: followers >= MIN_FOLLOWERS,
      active: r.daysSinceLast !== null && r.daysSinceLast <= ACTIVE_MAX_DAYS_SINCE_LAST && posts90 >= ACTIVE_MIN_POSTS_90D,
      topical: topical >= MIN_TOPICAL_POSTS,
      public: !r.private,
      independent: !r.likelyBusiness,
    };
    r.qualified = Object.values(r.pass).every(Boolean);
    results.push(r);
    console.error(`${r.qualified ? '✓' : '·'} @${r.handle} ${followers} takipçi, son ${r.daysSinceLast}g, 90g ${posts90}, konu ${topical}/${posts.length}`);
  } catch (e) {
    console.error('doğrulama', c.handle, e.message);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, verifyWorker));
writePartial();

results.sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.topicalIstanbulPlacePosts - a.topicalIstanbulPlacePosts || b.followers - a.followers);
const meta = { ranAt: new Date().toISOString(), provider: 'scrapecreators', queries: QUERIES, userQueries: USER_QUERIES, thresholds: { MIN_FOLLOWERS, MIN_TOPICAL_POSTS, ACTIVE_MAX_DAYS_SINCE_LAST, ACTIVE_MIN_POSTS_90D }, uniqueAuthors: candidates.size, verified: results.length, credits, note: 'Arama tabanlı örneklem; eksiksiz kapsam iddiası değildir.' };
writeFileSync(join(OUT, 'creator-discovery.json'), JSON.stringify({ meta, results }, null, 2));
console.log(JSON.stringify(meta));
