#!/usr/bin/env node
/**
 * Mekan karar bilgisi (29.10.2026): OpenStreetMap kimliği olan yayındaki mekanlar için Overpass'tan etiketler —
 * opening_hours, phone / contact:phone, website / contact:website, addr:*, cuisine. Ücretsiz; uydurma yok:
 * etiket yoksa alan null kalır, var olan web sitesi ezilmez. Atıf: © OpenStreetMap katkıcıları (ODbL).
 * Kullanım: node scripts/venue-practical.mjs <iş-klasörü> [--apply]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT = 'uwmbxcsvkieqyzhutjag';
const [WORK] = process.argv.slice(2);
const APPLY = process.argv.includes('--apply');
if (!WORK) throw new Error('iş klasörü gerekli');
mkdirSync(join(WORK, 'osm'), { recursive: true });
const q = (s) => JSON.parse(execFileSync('npx', ['-y', 'supabase@2.122.0', 'db', 'query', '--linked', '--project-ref', PROJECT, s], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })).rows;
const sql = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);

const rows = q(`select v.id, v.own_name, v.website_url, l.source_ref from public.venues v join geo.venue_locations l on l.venue_id = v.id
  where v.status = 'published' and l.source_ref like 'osm:%'`);
const byOsm = new Map();
for (const r of rows) {
  const m = r.source_ref.match(/^osm:(node|way|relation)\/(\d+)$/);
  if (m) byOsm.set(`${m[1]}/${m[2]}`, r);
}
console.log(`OSM kimlikli mekan: ${byOsm.size}`);

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
async function overpass(ids) {
  const parts = { node: [], way: [], relation: [] };
  for (const id of ids) { const [t, n] = id.split('/'); parts[t].push(n); }
  const body = `[out:json][timeout:60];(${Object.entries(parts).filter(([, v]) => v.length).map(([t, v]) => `${t}(id:${v.join(',')});`).join('')});out tags;`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = ENDPOINTS[attempt % ENDPOINTS.length];
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'elsewhere-app/1.0 (venue practical info)' }, body: `data=${encodeURIComponent(body)}` }).catch(() => null);
    // Yoğun saatte Overpass 200 ile HTML hata sayfası dönebiliyor: okunamayan yanıt yeniden denenir.
    const j = r?.ok ? await r.json().catch(() => null) : null;
    if (j) return j.elements ?? [];
    await new Promise((res) => setTimeout(res, 4000 * (attempt + 1)));
  }
  return null;
}

const all = [...byOsm.keys()];
const tags = new Map();
for (let i = 0; i < all.length; i += 80) {
  const batch = all.slice(i, i + 80);
  const file = join(WORK, 'osm', `${i}.json`);
  let els = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  if (!els) { els = await overpass(batch); if (els) writeFileSync(file, JSON.stringify(els)); await new Promise((res) => setTimeout(res, 1500)); }
  for (const e of els ?? []) tags.set(`${e.type}/${e.id}`, e.tags ?? {});
  process.stdout.write(`${Math.min(i + 80, all.length)} `);
}

const clean = (s) => (s ? String(s).trim().replace(/\s+/g, ' ').slice(0, 300) : null);
const httpUrl = (s) => { try { const u = new URL(s.startsWith('http') ? s : `https://${s}`); return u.protocol.startsWith('http') ? u.href : null; } catch { return null; } };
const updates = [];
const stat = { hours: 0, phone: 0, website: 0, address: 0, cuisine: 0 };
for (const [id, r] of byOsm) {
  const t = tags.get(id);
  if (!t) continue;
  const hours = clean(t.opening_hours);
  const phone = clean(t.phone ?? t['contact:phone']);
  const site = r.website_url ? null : httpUrl(clean(t.website ?? t['contact:website']) ?? '');
  const addr = clean([[t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '), t['addr:postcode'], t['addr:city']].filter(Boolean).join(', ')) || null;
  const cuisine = clean(t.cuisine?.split(';').map((c) => c.trim().replace(/_/g, ' ')).slice(0, 3).join(', '));
  if (!hours && !phone && !site && !addr && !cuisine) continue;
  stat.hours += !!hours; stat.phone += !!phone; stat.website += !!site; stat.address += !!addr; stat.cuisine += !!cuisine;
  updates.push(`update public.venues set opening_hours = ${sql(hours)}, phone = ${sql(phone)}, address_line = ${sql(addr)}, cuisine = ${sql(cuisine)}${site ? `, website_url = ${sql(site)}` : ''}, practical_source = 'osm', practical_observed_at = now() where id = ${sql(r.id)};`);
}
console.log('\n', { venues: byOsm.size, withTags: tags.size, updates: updates.length, ...stat });
const file = join(WORK, 'practical.sql');
writeFileSync(file, ['begin;', ...updates, 'commit;'].join('\n'));
if (!APPLY) { console.log('DENEME: yazılmadı. Uygulamak için --apply.'); process.exit(0); }
execFileSync('npx', ['-y', 'supabase@2.122.0', 'db', 'query', '--linked', '--project-ref', PROJECT, '-f', file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
console.log(`yazıldı: ${updates.length} mekan`);
