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

const norm = (s) => (s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').toLowerCase().replace(/[^a-z0-9]/g, '');
const uuidFrom = (s) => { const h = createHash('md5').update(s).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const sql = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function q(query) {
  const out = execFileSync('npx', ['-y', 'supabase@2.122.0', 'db', 'query', '--linked', '--project-ref', PROJECT, query], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out.slice(out.indexOf('{'))).rows ?? [];
}

/** Şehir adlarının yerel/İngilizce varyantları (bulut kayıtları Türkçe adlarla açıldı). */
const CITY_ALIASES = { london: 'londra', barcelona: 'barselona', milan: 'milano', rome: 'roma', florence: 'firenze', lisbon: 'lizbon', istanbul: 'istanbul', newyorkcity: 'newyork', nyc: 'newyork' };
const cityKey = (s) => { const k = norm(s); return CITY_ALIASES[k] ?? k; };
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
async function geocode(name, city, country) {
  const cacheFile = join(WORK, 'geo2', `${norm(name)}-${norm(city)}.json`);
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf8'));
  mkdirSync(join(WORK, 'geo2'), { recursive: true });
  const pick = (list) => list.find((x) => FOOD_TYPES.has(x.type) && nameMatch(name, x.name)) ?? null;
  const short = name.split(/[,(•|]/)[0].trim();
  let hit = null;
  for (const run of [() => nominatim(`${name}, ${city}`, country), () => nominatim(`${short}, ${city}`, country), () => photon(`${short} ${city}`), () => nominatim(short, country)]) {
    hit = pick(await run());
    if (hit) break;
  }
  const res = hit ? { lat: hit.lat, lng: hit.lng, osm: hit.osm, type: hit.type, category: OSM_CAT[hit.type], neighborhood: hit.nb, cc: (hit.cc ?? country ?? '').toUpperCase() } : null;
  writeFileSync(cacheFile, JSON.stringify(res));
  return res;
}

async function upload(path, buf, type) {
  return fetch(`${STORAGE}/object/media/${path}`, { method: 'POST', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': type, 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' }, body: buf }).then((r) => r.ok);
}
function bestStream(v) {
  const c = [v?.play_addr_h264, ...(v?.bit_rate ?? []).filter((b) => !b.is_bytevc2 && !/bvc2|bytevc2/i.test(b.gear_name ?? '')).map((b) => b.play_addr), v?.play_addr_bytevc1, v?.download_no_watermark_addr, v?.play_addr].filter((a) => a?.url_list?.[0]);
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
  const groups = new Map(); const usedVideo = new Set();
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
      geo = await geocode(g.venue, g.city, g.country);
      if (!geo) { report.droppedNoLocation.push(`${g.venue} (${g.city})`); continue; }
      // Aynı adlı başka bir şehir/yer: konum, şehrin merkezinden 60 km'den uzaksa eşleşme reddedilir.
      const center = city ?? [...cityByKey.values()].find((c) => c.isNew && cityKey(c.name) === cityKey(g.city));
      if (center && center.center_lat != null) {
        const R = 6371, rad = Math.PI / 180, dLat = (geo.lat - center.center_lat) * rad, dLng = (geo.lng - center.center_lng) * rad;
        const km = 2 * R * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(geo.lat * rad) * Math.cos(center.center_lat * rad) * Math.sin(dLng / 2) ** 2));
        if (km > 60) { report.droppedNoLocation.push(`${g.venue} (${g.city}, ${Math.round(km)} km)`); continue; }
      }
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
  for (const p of plan) {
    if (p.city.isNew) { stmts.push(`insert into public.cities (id, slug, name, country_code, timezone, center_lat, center_lng, coverage_status, radius_km) values (${sql(p.city.id)}, ${sql(p.city.slug)}, ${sql(p.city.name)}, ${sql(p.city.country_code)}, ${sql(p.city.timezone)}, ${p.city.center_lat}, ${p.city.center_lng}, 'pilot', 30) on conflict (slug) do nothing;`); p.city.isNew = false; }
    if (p.isNew) {
      stmts.push(`insert into public.venues (id, own_name, city_id, neighborhood, primary_category, status, data_mode) values (${sql(p.venueId)}, ${sql(p.venue)}, (select id from public.cities where slug=${sql(p.city.slug)} or id=${sql(p.city.id)} limit 1), ${sql(p.geo.neighborhood ?? p.neighborhood)}, ${sql(p.geo.category)}, 'published', 'live') on conflict (id) do update set status='published';`);
      stmts.push(`insert into geo.venue_locations (venue_id, location, source_type, source_ref, observed_at) values (${sql(p.venueId)}, extensions.st_makepoint(${p.geo.lng}, ${p.geo.lat})::extensions.geography, 'creator_supplied', ${sql('osm:' + p.geo.osm)}, now()) on conflict do nothing;`);
    }
    for (const [rank, v] of p.videos.entries()) {
      const awemeId = v.url.split('/').pop();
      const detail = await fetch(`https://api.scrapecreators.com/v2/tiktok/video?url=${encodeURIComponent(v.url)}&trim=true`, { headers: { 'x-api-key': SC_KEY } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      report.credits++;
      const a = detail?.aweme_detail; const best = bestStream(a?.video);
      if (!a || !best) continue;
      const postId = uuidFrom(`tiktok:${awemeId}`);
      const vid = await fetch(best.url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.tiktok.com/' } }).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
      if (!vid || vid.byteLength < 50_000) continue;
      const cover = a.video?.origin_cover?.url_list?.[0] ?? a.video?.cover?.url_list?.[0];
      const coverBuf = cover ? await fetch(cover).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null) : null;
      if (!(await upload(`videos/${postId}.mp4`, vid, 'video/mp4'))) continue;
      const thumbOk = coverBuf ? await upload(`thumbs/${postId}.jpg`, coverBuf, 'image/jpeg') : false;
      const author = a.author ?? {};
      const creatorId = uuidFrom(`creator:tiktok:${author.uid ?? v.creator}`);
      if (!creatorsDone.has(v.creator)) {
        creatorsDone.add(v.creator);
        // Hesap bulutta varsa onun creator'ı kullanılır; yoksa creator + hesap eklenir.
        stmts.push(`insert into public.creators (id, display_name, claim_status, status, data_mode) select ${sql(creatorId)}, ${sql(author.nickname ?? v.creator)}, 'unclaimed', 'active', 'live' where not exists (select 1 from public.creator_accounts where platform='tiktok' and (platform_user_id=${sql(String(author.uid ?? ''))} or lower(handle)=lower(${sql(v.creator)})));`);
        stmts.push(`insert into public.creator_accounts (creator_id, platform, platform_user_id, handle, canonical_url, verification_kind, observed_at, avatar_url, follower_count) select ${sql(creatorId)}, 'tiktok', ${sql(String(author.uid ?? v.creator))}, ${sql(v.creator)}, ${sql('https://www.tiktok.com/@' + v.creator)}, 'none', now(), null, ${author.follower_count ?? 'null'} where exists (select 1 from public.creators where id=${sql(creatorId)}) and not exists (select 1 from public.creator_accounts where platform='tiktok' and lower(handle)=lower(${sql(v.creator)}));`);
      }
      const creatorRef = `(select creator_id from public.creator_accounts where platform='tiktok' and lower(handle)=lower(${sql(v.creator)}) limit 1)`;
      stmts.push(`insert into public.venue_sources (venue_id, source_post_id, creator_id, platform, published_at, observed_at, views, likes, sponsored_status, stance, render_mode, source_url, thumbnail_url, video_url, rights_policy_id, rank) values (${sql(p.venueId)}, ${sql(postId)}, ${creatorRef}, 'tiktok', to_timestamp(${a.create_time ?? 0}), now(), ${Number(a.statistics?.play_count ?? v.views)}, ${Number(a.statistics?.digg_count ?? 0)}, 'unknown', 'recommend', 'official_embed', ${sql(v.url)}, ${thumbOk ? sql(`${STORAGE}/object/public/media/thumbs/${postId}.jpg`) : 'null'}, ${sql(`${STORAGE}/object/public/media/videos/${postId}.mp4`)}, ${sql(RIGHTS)}, ${rank}) on conflict (venue_id, source_post_id) do update set video_url=excluded.video_url, thumbnail_url=excluded.thumbnail_url, views=excluded.views;`);
      report.videos++;
      process.stdout.write('▸');
    }
  }
  stmts.push('commit;');
  const file = join(WORK, 'publish.sql');
  writeFileSync(file, stmts.join('\n'));
  execFileSync('npx', ['-y', 'supabase@2.122.0', 'db', 'query', '--linked', '--project-ref', PROJECT, '-f', file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(join(WORK, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\n', JSON.stringify({ ...report, droppedNoLocation: report.droppedNoLocation.length }));
}
main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 2000)); process.exit(1); });
