#!/usr/bin/env node
/**
 * Otorite listesini doğrula (27.10.2026): config/authority-creators.json içindeki "unverified" hesapların TikTok
 * profilini ScrapeCreators'tan çeker (hesap başına 1 kredi). Var mı, takipçi, doğrulanmış mı, bio. Video çekmez.
 * Kullanım: set -a; . apps/worker/.env; set +a; node scripts/verify-authority.mjs <çıktı.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
const KEY = process.env.SCRAPECREATORS_API_KEY;
if (!KEY) throw new Error('SCRAPECREATORS_API_KEY yok');
const out = process.argv[2] ?? 'verify-out.json';
const list = JSON.parse(readFileSync('config/authority-creators.json', 'utf8')).creators.filter((c) => c.status === 'unverified');
const results = [];
let credits = 0;
for (const c of list) {
  const r = await fetch(`https://api.scrapecreators.com/v1/tiktok/profile?handle=${encodeURIComponent(c.handle)}`, { headers: { 'x-api-key': KEY } }).catch(() => null);
  credits += 1;
  if (!r || !r.ok) { results.push({ handle: c.handle, found: false, status: r?.status ?? 0 }); continue; }
  const j = await r.json();
  const u = j.user ?? {}; const s = j.statsV2 ?? j.stats ?? {};
  results.push({ handle: c.handle, found: !!u.uniqueId, uniqueId: u.uniqueId, nickname: u.nickname, verified: !!u.verified, followers: Number(s.followerCount ?? 0), videos: Number(s.videoCount ?? 0), bio: (u.signature ?? '').slice(0, 160), cities: c.cities });
  process.stdout.write('.');
}
writeFileSync(out, JSON.stringify({ credits, results }, null, 2));
console.log(`\n${results.filter((x) => x.found).length}/${list.length} bulundu, ~${credits} kredi`);
