#!/usr/bin/env node
/**
 * Otorite videolarını yayına al (28.10.2026, ürün sahibi kararı): authority-resolve.mjs çıktısındaki adaylar →
 *  1) tekrarlar birleşir (mekan adı + şehir normalize; bir video yalnız bir mekana),
 *  2) bulutta aynı şehirde aynı adlı yayındaki mekan varsa ona eklenir,
 *  3) yeni mekan OpenStreetMap Nominatim ile konumlanır (yalnız yeme-içme türü ve ad benzerliği tutarsa; yoksa düşer),
 *  4) şehir yoksa açılır (kapsam "pilot"),
 *  5) --apply: video (en iyi akış ≥720p, ScrapeCreators v2 ayrıntı = 1 kredi) ve kapak Storage'a kopyalanır,
 *     tüm kayıtlar tek SQL transaction'ı ile `supabase db query --linked` üzerinden yazılır.
 * Kullanım: set -a; . apps/worker/.env; set +a; node scripts/authority-publish.mjs <stage4.json> <iş-klasörü> [--apply]
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [IN, WORK] = process.argv.slice(2);
const APPLY = process.argv.includes('--apply');
const PROJECT = 'uwmbxcsvkieqyzhutjag';
const STORAGE = `https://${PROJECT}.supabase.co/storage/v1`;
const SC_KEY = process.env.SCRAPECREATORS_API_KEY;
const UA = 'ElsewhereApp/0.1 (+https://github.com/cettocdx/viral-places)';
mkdirSync(WORK, { recursive: true });
const RIGHTS = 'scrapecreators-pilot';

// Harf/rakam dışı her şey atılır; Latin dışı harfler (東京, Ελλάδα) korunur — yoksa hepsi boş anahtara düşüyordu.
const norm = (s) => (s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const uuidFrom = (s) => { const h = createHash('md5').update(s).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const sql = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function q(query) {
  const out = execFileSync('npx', ['-y', 'supabase@2.122.0', 'db', 'query', '--linked', '--project-ref', PROJECT, query], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out.slice(out.indexOf('{'))).rows ?? [];
}

/** Şehir adlarının yerel/İngilizce varyantları (bulut kayıtları Türkçe adlarla açıldı). */
const CITY_ALIASES = { london: 'londra', barcelona: 'barselona', milan: 'milano', rome: 'roma', florence: 'firenze', floransa: 'firenze', lisbon: 'lizbon', lisboa: 'lizbon', istanbul: 'istanbul', newyorkcity: 'newyork', nyc: 'newyork', manhattan: 'newyork', brooklyn: 'newyork', 東京: 'tokyo', 東京都: 'tokyo', tokio: 'tokyo', amsterdamnl: 'amsterdam' };
const cityKey = (s) => { const k = norm(s); return CITY_ALIASES[k] ?? k; };
const NEW_CITY_ALLOW = new Set((process.env.VP_NEW_CITY_ALLOW ?? '').split(',').filter(Boolean).map((c) => cityKey(c)));
const TZ = { TR: 'Europe/Istanbul', GB: 'Europe/London', ES: 'Europe/Madrid', FR: 'Europe/Paris', IT: 'Europe/Rome', NL: 'Europe/Amsterdam', DE: 'Europe/Berlin', PT: 'Europe/Lisbon', JP: 'Asia/Tokyo', AE: 'Asia/Dubai', IN: 'Asia/Kolkata', IQ: 'Asia/Baghdad', AT: 'Europe/Vienna', BE: 'Europe/Brussels', MX: 'America/Mexico_City', TH: 'Asia/Bangkok' };
const US_TZ = { 'los angeles': 'America/Los_Angeles', chicago: 'America/Chicago', 'new york': 'America/New_York', houston: 'America/Chicago', dallas: 'America/Chicago' };

// OSM türü → uygulama kategorisi; yeme-içme dışı sonuçlar kabul edilmez.
const OSM_CAT = { restaurant: 'food', fast_food: 'food', food_court: 'food', cafe: 'coffee', ice_cream: 'food', bar: 'nightlife', pub: 'nightlife', biergarten: 'nightlife', nightclub: 'nightlife', bakery: 'food', confectionery: 'food', deli: 'food', pastry: 'food', coffee: 'coffee', butcher: 'food', seafood: 'food', chocolate: 'food', hotel: 'food' };

/** Ad benzerliği: anlamlı kelimelerin örtüşmesi (ilk 8 harf kuralı "The Beigel Shop" gibi adları kaçırıyordu). */
const STOP = new Set(['the','restaurant','restaurante','ristorante','cafe','bar','and','de','la','el','le','les','del','di','da','house','kitchen','london','madrid','istanbul']);
function nameMatch(want, got) {
  const w = (want ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9ğüşöçı]+/).filter((t) => t.length > 2 && !STOP.has(t));
  const g = norm(got);
  if (!w.length) return norm(want) === g;
  return w.filter((t) => g.includes(norm(t))).length >= Math.max(1, Math.ceil(w.length / 2));
}
const FOOD_TYPES = new Set(Object.keys(OSM_CAT));
async function nominatim(qs, country) {
  const params = new URLSearchParams({ q: qs, format: 'jsonv2', limit: '8', addressdetails: '1', ...(country ? { countrycodes: country.toLowerCase() } : {}) });
  await sleep(1100); // Nominatim kullanım kuralı: saniyede en fazla 1 istek
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'User-Agent': UA } }).catch(() => null);
  return (r?.ok ? await r.json() : []).map((x) => ({ name: x.name, type: x.type, lat: +x.lat, lng: +x.lon, osm: `${x.osm_type}/${x.osm_id}`, nb: x.address?.suburb ?? x.address?.neighbourhood ?? x.address?.city_district ?? null, cc: x.address?.country_code }));
}
async function photon(qs) {
  await sleep(300);
  const r = await fetch(`https://photon.komoot.io/api/?${new URLSearchParams({ q: qs, limit: '8' })}`, { headers: { 'User-Agent': UA } }).catch(() => null);
  const j = r?.ok ? await r.json() : { features: [] };
  return (j.features ?? []).map((f) => ({ name: f.properties.name, type: f.properties.osm_value, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], osm: `${({ N: 'node', W: 'way', R: 'relation' })[f.properties.osm_type] ?? f.properties.osm_type}/${f.properties.osm_id}`, nb: f.properties.district ?? f.properties.locality ?? null, cc: f.properties.countrycode }));
}
// Şehir merkezi biliniyorsa arama oraya bağlanır (29.10.2026): küresel aramada aynı adlı başka yer (Ness Patisserie →
// 14.600 km) çıkıyor, küçük yerel mekanlar hiç bulunmuyordu. Overpass ad araması 30 km yarıçapta, yeme-içme türlerinde.
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\"]/g, '.');
async function overpassAround(short, center) {
  const nameRe = reEsc(short.slice(0, 40));
  const body = `[out:json][timeout:25];nwr["name"~"${nameRe}",i]["amenity"~"^(${[...FOOD_TYPES].join('|')})$"](around:30000,${center.lat},${center.lng});out center tags 8;`;
  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(1200);
    const r = await fetch(OVERPASS[attempt % 2], { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA }, body: `data=${encodeURIComponent(body)}` }).catch(() => null);
    if (r?.ok) {
      const j = await r.json().catch(() => ({ elements: [] }));
      return (j.elements ?? []).map((e) => ({ name: e.tags?.name, type: e.tags?.amenity, lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon, osm: `${e.type}/${e.id}`, nb: e.tags?.['addr:suburb'] ?? e.tags?.['addr:district'] ?? null, cc: null })).filter((x) => x.lat != null);
    }
  }
  return [];
}
async function nominatimNear(qs, country, center) {
  const d = 0.35; // ~35 km kutu
  const params = new URLSearchParams({ q: qs, format: 'jsonv2', limit: '8', addressdetails: '1', viewbox: `${center.lng - d},${center.lat + d},${center.lng + d},${center.lat - d}`, bounded: '1', ...(country ? { countrycodes: country.toLowerCase() } : {}) });
  await sleep(1100);
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'User-Agent': UA } }).catch(() => null);
  return (r?.ok ? await r.json() : []).map((x) => ({ name: x.name, type: x.type, lat: +x.lat, lng: +x.lon, osm: `${x.osm_type}/${x.osm_id}`, nb: x.address?.suburb ?? x.address?.neighbourhood ?? x.address?.city_district ?? null, cc: x.address?.country_code }));
}
async function geocode(name, city, country, center) {
  const cacheFile = join(WORK, 'geo2', `${norm(name)}-${norm(city)}.json`);
  const cached = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : undefined;
  // Uzak yanlış eşleşme önbellekteyse (aynı adlı başka şehir) şehre bağlı yollarla yeniden denenir.
  const farCache = cached && center && distanceKm(cached, center) > 60;
  if (cached && !farCache) return cached;
  mkdirSync(join(WORK, 'geo2'), { recursive: true });
  const pick = (list) => list.find((x) => FOOD_TYPES.has(x.type) && nameMatch(name, x.name)) ?? null;
  const short = name.split(/[,(•|]/)[0].trim();
  // Önceki turda bulunamayan (null önbellek) mekanlar yalnız şehre bağlı yeni yollarla denenir.
  const runs = cached === null || farCache ? [] : [() => nominatim(`${name}, ${city}`, country), () => nominatim(`${short}, ${city}`, country), () => photon(`${short} ${city}`), () => nominatim(short, country)];
  if (center) runs.unshift(() => nominatimNear(short, country, center), () => overpassAround(short, center));
  let hit = null;
  for (const run of runs) {
    hit = pick(await run());
    if (hit) break;
  }
  const res = hit ? { lat: hit.lat, lng: hit.lng, osm: hit.osm, type: hit.type, category: OSM_CAT[hit.type], neighborhood: hit.nb, cc: (hit.cc ?? country ?? '').toUpperCase() } : null;
  writeFileSync(cacheFile, JSON.stringify(res));
  return res;
}

function distanceKm(a, b) {
  const R = 6371, rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  return 2 * R * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2));
}
function nearestCity(geo, cities, maxKm) {
  let best = null, bestKm = maxKm;
  for (const c of cities) {
    if (c.center_lat == null) continue;
    const km = distanceKm(geo, { lat: c.center_lat, lng: c.center_lng });
    if (km <= bestKm) { best = c; bestKm = km; }
  }
  return best;
}

async function upload(path, buf, type) {
  // Geçici ağ hataları tüm çalışmayı düşürmesin: üç deneme.
  for (let attempt = 0; attempt < 3; attempt++) {
    const ok = await fetch(`${STORAGE}/object/media/${path}`, { method: 'POST', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': type, 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' }, body: buf }).then((r) => r.ok).catch(() => false);
    if (ok) return true;
    await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
  }
  return false;
}
function bestStream(v) {
  const c = [v?.play_addr_h264, ...(v?.bit_rate ?? []).filter((b) => !b.is_bytevc2 && b.is_bytevc1 !== 2 && !/bvc2|bytevc2/i.test(b.gear_name ?? '')).map((b) => b.play_addr), v?.play_addr_bytevc1, v?.download_no_watermark_addr, v?.play_addr].filter((a) => a?.url_list?.[0]);
  // H.264 tercih edilir; aynı kısa kenarda HEVC'den önce gelir. 720 altı kabul edilmez.
  let best = null;
  for (const a of c) { const s = Math.min(a.width ?? 0, a.height ?? 0); if (s >= 720 && (!best || s > best.s)) best = { s, url: a.url_list[0] }; }
  return best;
}

let SERVICE = null;
async function main() {
  const d = JSON.parse(readFileSync(IN, 'utf8'));
  const report = { input: d.candidates.length, merged: 0, attachedToExisting: 0, newVenues: 0, droppedNoLocation: [], newCities: [], videos: 0, credits: 0 };

  // 1) Tekrarlar: mekan+şehir anahtarı; video URL'si yalnız bir kez.
  // Haftalık tazeleme: yayındaki ya da denetimde elenmiş videolar yeniden alınmaz (kredi + geri gelen elenmiş içerik).
  const usedVideo = new Set(q("select source_url from public.venue_sources where source_url is not null").map((r) => r.source_url));
  const auditDir = join(process.env.HOME ?? '', 'viral-places-ref/content/audit');
  for (const f of ['audit-removed-1.json', 'audit-removed-2.json', 'audit-removed-3.json', 'removed-kartalgokberk.json', 'removed-serennazra.json', 'removed-eatoutguidelondon.json']) {
    const path = join(auditDir, f);
    if (!existsSync(path)) continue;
    const d = JSON.parse(readFileSync(path, 'utf8'));
    for (const r of Array.isArray(d) ? d : d.rows ?? []) if (r.source_url) usedVideo.add(r.source_url);
  }
  const groups = new Map();
  for (const c of d.candidates.sort((a, b) => b.views - a.views)) {
    if (!c.venue || !c.city || usedVideo.has(c.url)) continue;
    usedVideo.add(c.url);
    const k = `${norm(c.venue)}|${cityKey(c.city)}`;
    if (!groups.has(k)) groups.set(k, { venue: c.venue, city: c.city, country: c.country, neighborhood: c.neighborhood, videos: [] }); else report.merged++;
    groups.get(k).videos.push(c);
  }

  // 2) Bulut şehirleri ve yayındaki mekanlar.
  const cities = q("select id, name, slug, aliases, country_code, center_lat, center_lng from public.cities");
  const cityByKey = new Map(); for (const c of cities) { cityByKey.set(cityKey(c.name), c); for (const a of c.aliases ?? []) cityByKey.set(cityKey(a), c); }
  const existing = q("select v.id, v.own_name, v.city_id from public.venues v where v.status='published'");
  const existingByKey = new Map(existing.map((v) => [`${norm(v.own_name)}|${v.city_id}`, v.id]));

  const plan = [];
  for (const g of groups.values()) {
    let city = cityByKey.get(cityKey(g.city));
    let venueId = city ? existingByKey.get(`${norm(g.venue)}|${city.id}`) : null;
    let geo = null;
    if (!venueId) {
      geo = await geocode(g.venue, g.city, g.country, city && city.center_lat != null ? { lat: city.center_lat, lng: city.center_lng } : null);
      if (!geo) { report.droppedNoLocation.push(`${g.venue} (${g.city})`); continue; }
      // Aynı adlı başka bir şehir/yer: konum, şehrin merkezinden 60 km'den uzaksa eşleşme reddedilir.
      const center = city ?? [...cityByKey.values()].find((c) => c.isNew && cityKey(c.name) === cityKey(g.city));
      if (center && center.center_lat != null) {
        const R = 6371, rad = Math.PI / 180, dLat = (geo.lat - center.center_lat) * rad, dLng = (geo.lng - center.center_lng) * rad;
        const km = 2 * R * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(geo.lat * rad) * Math.cos(center.center_lat * rad) * Math.sin(dLng / 2) ** 2));
        if (km > 60) { report.droppedNoLocation.push(`${g.venue} (${g.city}, ${Math.round(km)} km)`); continue; }
      }
      // Banliyö/ilçe (West Hollywood, 八王子市): konum mevcut bir şehrin 35 km içindeyse yeni şehir açılmaz, ona bağlanır.
      if (!city) city = nearestCity(geo, [...cityByKey.values()], 35);
      // Arama şehirleri dışında yeni şehir açılmaz (yanlış eşleşme riski); yalnız VP_NEW_CITY_ALLOW'dakiler (ör. Lisboa).
      if (!city && !NEW_CITY_ALLOW.has(cityKey(g.city))) { report.droppedNoLocation.push(`${g.venue} (${g.city}, yeni şehir)`); continue; }
      if (!city) {
        const cc = (geo.cc || g.country || 'XX').toUpperCase().slice(0, 2);
        const tz = cc === 'US' ? US_TZ[g.city.toLowerCase()] ?? 'America/New_York' : TZ[cc] ?? 'UTC';
        city = { id: uuidFrom(`city:${cityKey(g.city)}`), name: g.city, slug: norm(g.city) || cityKey(g.city), country_code: cc, timezone: tz, center_lat: geo.lat, center_lng: geo.lng, isNew: true };
        cityByKey.set(cityKey(g.city), city); report.newCities.push(g.city);
      }
      venueId = existingByKey.get(`${norm(g.venue)}|${city.id}`) ?? uuidFrom(`venue:${norm(g.venue)}|${city.id}`);
      if (existingByKey.has(`${norm(g.venue)}|${city.id}`)) report.attachedToExisting++; else { report.newVenues++; existingByKey.set(`${norm(g.venue)}|${city.id}`, venueId); }
    } else report.attachedToExisting++;
    plan.push({ ...g, venueId, city, geo, isNew: !!geo });
  }
  writeFileSync(join(WORK, 'plan.json'), JSON.stringify({ report, plan }, null, 2));
  console.log(JSON.stringify({ ...report, droppedNoLocation: report.droppedNoLocation.length, newCities: report.newCities }, null, 1));
  if (!APPLY) { console.log('DENEME: hiçbir şey yazılmadı. Uygulamak için --apply.'); return; }

  // 3) Storage: video + kapak. Servis anahtarı CLI'dan (yeni sb_secret Storage'da Bearer olarak geçmiyor).
  const keys = JSON.parse(execFileSync('npx', ['-y', 'supabase@2.122.0', 'projects', 'api-keys', '--project-ref', PROJECT, '-o', 'json'], { encoding: 'utf8' }));
  SERVICE = keys.find((k) => k.name === 'service_role').api_key;
  const stmts = ['begin;'];
  const creatorsDone = new Set();
  mkdirSync(join(WORK, 'done'), { recursive: true });
  const queue = [...plan];
  const work = async () => { for (let p = queue.shift(); p; p = queue.shift()) await publishOne(p); };
  // Video başına sonuç done/ altında saklanır: yarıda kalırsa yeniden çalıştırmak kredi ve yükleme harcamaz.
  async function publishOne(p) {
    if (p.city.isNew) { stmts.push(`insert into public.cities (id, slug, name, country_code, timezone, center_lat, center_lng, coverage_status, radius_km) values (${sql(p.city.id)}, ${sql(p.city.slug)}, ${sql(p.city.name)}, ${sql(p.city.country_code)}, ${sql(p.city.timezone)}, ${p.city.center_lat}, ${p.city.center_lng}, 'pilot', 30) on conflict (slug) do nothing;`); p.city.isNew = false; }
    if (p.isNew) {
      stmts.push(`insert into public.venues (id, own_name, city_id, neighborhood, primary_category, status, data_mode) values (${sql(p.venueId)}, ${sql(p.venue)}, (select id from public.cities where slug=${sql(p.city.slug)} or id=${sql(p.city.id)} limit 1), ${sql(p.geo.neighborhood ?? p.neighborhood)}, ${sql(p.geo.category)}, 'published', 'live') on conflict (id) do update set status='published';`);
      stmts.push(`insert into geo.venue_locations (venue_id, location, source_type, source_ref, observed_at) values (${sql(p.venueId)}, extensions.st_makepoint(${p.geo.lng}, ${p.geo.lat})::extensions.geography, 'creator_supplied', ${sql('osm:' + p.geo.osm)}, now()) on conflict do nothing;`);
    }
    for (const [rank, v] of p.videos.entries()) {
      const awemeId = v.url.split('/').pop();
      const doneFile = join(WORK, 'done', `${awemeId}.json`);
      if (existsSync(doneFile)) { const dn = JSON.parse(readFileSync(doneFile, 'utf8')); if (!dn.skip) { stmts.push(...dn.stmts.filter((x) => !x.startsWith('insert into public.creator') || !creatorsDone.has(v.creator))); creatorsDone.add(v.creator); report.videos++; } continue; }
      const detail = await fetch(`https://api.scrapecreators.com/v2/tiktok/video?url=${encodeURIComponent(v.url)}&trim=true`, { headers: { 'x-api-key': SC_KEY } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      report.credits++;
      const a = detail?.aweme_detail; const best = bestStream(a?.video);
      if (!a || !best) { writeFileSync(doneFile, JSON.stringify({ skip: 'no_stream' })); continue; }
      const postId = uuidFrom(`tiktok:${awemeId}`);
      const vid = await fetch(best.url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.tiktok.com/' } }).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
      if (!vid || vid.byteLength < 50_000) { writeFileSync(doneFile, JSON.stringify({ skip: 'download' })); continue; }
      const cover = a.video?.origin_cover?.url_list?.[0] ?? a.video?.cover?.url_list?.[0];
      const coverBuf = cover ? await fetch(cover).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null) : null;
      if (!(await upload(`videos/${postId}.mp4`, vid, 'video/mp4'))) continue;
      const thumbOk = coverBuf ? await upload(`thumbs/${postId}.jpg`, coverBuf, 'image/jpeg') : false;
      const author = a.author ?? {};
      const creatorId = uuidFrom(`creator:tiktok:${author.uid ?? v.creator}`);
      const mine = [];
      {
        // Hesap bulutta varsa onun creator'ı kullanılır; yoksa creator + hesap eklenir.
        mine.push(`insert into public.creators (id, display_name, claim_status, status, data_mode) select ${sql(creatorId)}, ${sql(author.nickname ?? v.creator)}, 'unclaimed', 'active', 'live' where not exists (select 1 from public.creator_accounts where platform='tiktok' and (platform_user_id=${sql(String(author.uid ?? ''))} or lower(handle)=lower(${sql(v.creator)})));`);
        mine.push(`insert into public.creator_accounts (creator_id, platform, platform_user_id, handle, canonical_url, verification_kind, observed_at, avatar_url, follower_count) select ${sql(creatorId)}, 'tiktok', ${sql(String(author.uid ?? v.creator))}, ${sql(v.creator)}, ${sql('https://www.tiktok.com/@' + v.creator)}, 'none', now(), null, ${author.follower_count ?? 'null'} where exists (select 1 from public.creators where id=${sql(creatorId)}) and not exists (select 1 from public.creator_accounts where platform='tiktok' and lower(handle)=lower(${sql(v.creator)}));`);
      }
      // Hesap adı değişmiş olabilir: kullanıcı kimliğiyle de eşleşir, aynı ad önceliklidir.
      const creatorRef = `(select creator_id from public.creator_accounts where platform='tiktok' and (lower(handle)=lower(${sql(v.creator)}) or platform_user_id=${sql(String(author.uid ?? v.creator))}) order by (lower(handle)=lower(${sql(v.creator)})) desc limit 1)`;
      mine.push(`insert into public.venue_sources (venue_id, source_post_id, creator_id, platform, published_at, observed_at, views, likes, sponsored_status, stance, render_mode, source_url, thumbnail_url, video_url, rights_policy_id, rank) values (${sql(p.venueId)}, ${sql(postId)}, ${creatorRef}, 'tiktok', to_timestamp(${a.create_time ?? 0}), now(), ${Number(a.statistics?.play_count ?? v.views)}, ${Number(a.statistics?.digg_count ?? 0)}, 'unknown', 'recommend', 'official_embed', ${sql(v.url)}, ${thumbOk ? sql(`${STORAGE}/object/public/media/thumbs/${postId}.jpg`) : 'null'}, ${sql(`${STORAGE}/object/public/media/videos/${postId}.mp4`)}, ${sql(RIGHTS)}, ${rank}) on conflict (venue_id, source_post_id) do update set video_url=excluded.video_url, thumbnail_url=excluded.thumbnail_url, views=excluded.views;`);
      writeFileSync(doneFile, JSON.stringify({ stmts: mine, height: best.s }));
      stmts.push(...mine.filter((x) => !x.startsWith('insert into public.creator') || !creatorsDone.has(v.creator))); creatorsDone.add(v.creator);
      report.videos++;
      process.stdout.write('▸');
    }
  }
  await Promise.all(Array.from({ length: 4 }, work));
  stmts.push('commit;');
  const file = join(WORK, 'publish.sql');
  writeFileSync(file, stmts.join('\n'));
  execFileSync('npx', ['-y', 'supabase@2.122.0', 'db', 'query', '--linked', '--project-ref', PROJECT, '-f', file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(join(WORK, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\n', JSON.stringify({ ...report, droppedNoLocation: report.droppedNoLocation.length }));
}
main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 2000)); process.exit(1); });
