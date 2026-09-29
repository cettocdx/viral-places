#!/usr/bin/env node
/**
 * İstanbul mekan/yemek creator keşfi — Instagram (vp-creator-coverage).
 * ScrapeCreators reels araması → sahip tekilleştirme (IG user id) → profil (takipçi, kategori, bio) →
 * son gönderilerle süreklilik + konu uyumu. İşletme hesapları (restoran/kafe kategorisi, adres bio'su) ayrı işaretlenir.
 * Arama tabanlı örneklem; eksiksiz kapsam iddiası değildir.
 *
 * Kullanım: set -a; . apps/worker/.env; set +a; node scripts/discover-instagram.mjs <çıktı-klasörü> [hariç-tutulacak-handle ...]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.SCRAPECREATORS_API_KEY;
if (!KEY) throw new Error('SCRAPECREATORS_API_KEY yok');
const [OUT = 'ig-discovery-out', ...EXCLUDE] = process.argv.slice(2);
const exclude = new Set(EXCLUDE.map((h) => h.toLowerCase()));
mkdirSync(OUT, { recursive: true });

const MIN_FOLLOWERS = Number(process.env.VP_MIN_FOLLOWERS ?? 100_000);
const MIN_TOPICAL_POSTS = 10;
const ACTIVE_MAX_DAYS_SINCE_LAST = 21;
const ACTIVE_MIN_POSTS_90D = 8;
const MAX_POST_PAGES = Number(process.env.VP_MAX_POST_PAGES ?? 6);
const SEARCH_PAGES = 3;
const CONCURRENCY = 6;

const QUERIES = [
  'istanbul mekan', 'istanbul mekan önerisi', 'istanbul yemek', 'istanbul restoran', 'istanbul kafe', 'istanbul kahvaltı', 'istanbul lezzet',
  'istanbul gurme', 'istanbul sokak lezzetleri', 'istanbul nerede yenir', 'istanbul burger', 'istanbul brunch', 'istanbul tatlı', 'istanbul kebap',
  'istanbul meyhane', 'istanbul balık', 'istanbul fine dining', 'istanbul date mekanı', 'istanbul manzaralı mekan', 'istanbul yeni açılan mekan',
  'kadıköy mekan', 'beşiktaş mekan', 'karaköy kafe', 'nişantaşı restoran', 'bebek kahvaltı', 'moda kafe', 'balat kafe', 'galata mekan',
  'üsküdar mekan', 'etiler restoran', 'cihangir kafe', 'eminönü lezzet', 'istanbul uygun fiyatlı mekan', 'istanbul esnaf lokantası',
  'istanbul food', 'istanbul food guide', 'where to eat in istanbul', 'istanbul street food', 'istanbul cafe', 'istanbul restaurant',
  'yemek önerisi istanbul', 'gurme istanbul', 'mekan incelemesi', 'restoran yorumu',
];

const ISTANBUL_RE = /istanbul|i̇stanbul|kadıköy|kadikoy|beşiktaş|besiktas|karaköy|karakoy|nişantaşı|nisantasi|beyoğlu|beyoglu|taksim|üsküdar|uskudar|bebek|moda|şişli|sisli|fatih|eminönü|eminonu|sarıyer|sariyer|ataşehir|atasehir|bakırköy|bakirkoy|cihangir|galata|ortaköy|ortakoy|balat|arnavutköy|kuruçeşme|etiler|levent|maslak|florya|yeşilköy|kartal|maltepe|pendik|çengelköy|kuzguncuk|beykoz|sultanahmet|kapalıçarşı|boğaz|bosphorus/i;
const PLACE_RE = /mekan|restoran|restaurant|kafe|cafe|café|kahvaltı|brunch|burger|pizza|kebap|kebab|döner|doner|lokanta|meyhane|balık|tatlı|baklava|künefe|dürüm|pide|lahmacun|köfte|kokoreç|midye|steak|sushi|ramen|kahve|coffee|pastane|fırın|börek|menü|fiyat|lezzet|yemek|food|eat|dining|chef|şef|tadım|gurme|nereye|adres|konum|📍/i;
const BUSINESS_RE = /adres|address|sipariş|siparis|rezervasyon|reservation|şube|sube|paket servis|mahallesi|caddesi|cad\.|sokak no|no:|açılış saat|opening hours|whatsapp|franchise|online sipariş|menü için|booking/i;
const BUSINESS_CATEGORY_RE = /restaurant|restoran|cafe|café|coffee|bakery|pastane|bar|pub|hotel|otel|food & beverage|food and beverage|catering|dessert shop|brand|local business|shopping|tour agency|travel company/i;

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
async function pool(items, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (i < items.length) {
      const item = items[i++];
      out.push(await fn(item));
    }
  }));
  return out;
}

// 1) Keşif: reels araması
const owners = new Map(); // username → { id, hits, via }
await pool(QUERIES, async (q) => {
  for (let page = 1; page <= SEARCH_PAGES; page++) {
    try {
      const d = await sc('/v2/instagram/reels/search', { query: q, page: page > 1 ? String(page) : undefined });
      for (const r of d.reels ?? []) {
        const u = r.owner?.username?.toLowerCase();
        if (!u || exclude.has(u)) continue;
        const o = owners.get(u) ?? { username: u, id: r.owner.id, hits: 0, via: new Set() };
        o.hits++;
        o.via.add(q);
        owners.set(u, o);
      }
      if (!d.next_page) break;
    } catch (e) {
      console.error('arama', q, e.message);
      break;
    }
  }
});
console.error(`keşif: ${owners.size} tekil hesap, ${credits} kredi`);

// 2) Profil: takipçi + işletme işareti
const profiles = (await pool([...owners.values()], async (o) => {
  try {
    const u = (await sc('/v1/instagram/profile', { handle: o.username }))?.data?.user;
    if (!u?.id) return null;
    const bio = u.biography ?? '';
    return {
      username: u.username, id: String(u.id), fullName: u.full_name, followers: u.edge_followed_by?.count ?? 0, private: !!u.is_private,
      category: u.category_name ?? null, isBusiness: !!u.is_business_account, bio, externalUrl: u.external_url ?? null, via: [...o.via].slice(0, 5), searchHits: o.hits,
      likelyBusiness: BUSINESS_RE.test(bio) || BUSINESS_CATEGORY_RE.test(u.category_name ?? ''),
    };
  } catch (e) {
    console.error('profil', o.username, e.message);
    return null;
  }
})).filter(Boolean);
const big = profiles.filter((p) => p.followers >= MIN_FOLLOWERS && !p.private && !p.likelyBusiness);
console.error(`profil: ${profiles.length}, eşik+bağımsız aday: ${big.length}, ${credits} kredi`);

// 3) Gönderiler: süreklilik + konu uyumu
const now = Date.now() / 1000;
function isTopical(it) {
  const t = `${typeof it.caption === 'string' ? it.caption : it.caption?.text ?? ''} ${it.location?.name ?? ''} ${it.location?.city ?? ''}`;
  return PLACE_RE.test(t) && (ISTANBUL_RE.test(t) || !!it.location?.name);
}
const results = await pool(big, async (p) => {
  try {
    const items = [];
    let cursor;
    for (let page = 0; page < MAX_POST_PAGES; page++) {
      const d = await sc('/v2/instagram/user/posts', { handle: p.username, next_max_id: cursor, trim: 'true' });
      const batch = Array.isArray(d.items) ? d.items : Array.isArray(d.posts) ? d.posts : [];
      items.push(...batch);
      if (!(d.more_available && d.next_max_id) || batch.length === 0) break;
      cursor = d.next_max_id;
      if (items.filter(isTopical).length >= MIN_TOPICAL_POSTS) break;
    }
    const posts = items
      .filter((it) => !it.is_pinned && !(it.timeline_pinned_user_ids?.length))
      .map((it) => ({ t: Number(it.taken_at ?? it.taken_at_timestamp ?? 0), topical: isTopical(it), views: Number(it.play_count ?? it.ig_play_count ?? it.video_view_count ?? 0) }))
      .filter((x) => x.t > 0)
      .sort((a, b) => b.t - a.t);
    const last = posts[0]?.t ?? 0;
    const posts90 = posts.filter((x) => now - x.t <= 90 * 86400).length;
    const topical = posts.filter((x) => x.topical).length;
    const views = posts.map((x) => x.views).filter((v) => v > 0).sort((a, b) => a - b);
    const r = { ...p, sampled: posts.length, daysSinceLast: last ? Math.round((now - last) / 86400) : null, posts90, topicalIstanbulPlacePosts: topical, medianViews: views.length ? views[Math.floor(views.length / 2)] : null };
    r.pass = { followers: true, active: r.daysSinceLast !== null && r.daysSinceLast <= ACTIVE_MAX_DAYS_SINCE_LAST && posts90 >= ACTIVE_MIN_POSTS_90D, topical: topical >= MIN_TOPICAL_POSTS, public: true, independent: true };
    r.qualified = Object.values(r.pass).every(Boolean);
    console.error(`${r.qualified ? '✓' : '·'} @${r.username} ${r.followers} takipçi, son ${r.daysSinceLast}g, 90g ${posts90}, konu ${topical}/${posts.length}`);
    return r;
  } catch (e) {
    console.error('gönderi', p.username, e.message);
    return null;
  }
});

const verified = results.filter(Boolean).sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.topicalIstanbulPlacePosts - a.topicalIstanbulPlacePosts || b.followers - a.followers);
const meta = { ranAt: new Date().toISOString(), provider: 'scrapecreators', platform: 'instagram', queries: QUERIES, searchPages: SEARCH_PAGES, thresholds: { MIN_FOLLOWERS, MIN_TOPICAL_POSTS, ACTIVE_MAX_DAYS_SINCE_LAST, ACTIVE_MIN_POSTS_90D }, uniqueOwners: owners.size, profiled: profiles.length, businessExcluded: profiles.filter((p) => p.followers >= MIN_FOLLOWERS && p.likelyBusiness).map((p) => p.username), verified: verified.length, credits, note: 'Arama tabanlı örneklem; eksiksiz kapsam iddiası değildir.' };
writeFileSync(join(OUT, 'instagram-discovery.json'), JSON.stringify({ meta, results: verified }, null, 2));
console.log(JSON.stringify({ ...meta, queries: undefined }));
