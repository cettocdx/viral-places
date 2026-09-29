#!/usr/bin/env node
/**
 * Seçilen TikTok creator'larının Instagram hesaplarını bulur (vp-creator-coverage adım 2).
 * Platformlar arası birleştirme yalnız kanıtla: TikTok bio'su IG handle'ını anıyor YA DA IG bio/linkleri TikTok'u anıyor.
 * Benzer handle tek başına kanıt değildir → evidence=null, eklenmez.
 *
 * Kullanım: node scripts/link-instagram.mjs <discovery.json> <çıktı.json> handle1 handle2 ...
 */
import { readFileSync, writeFileSync } from 'node:fs';

const KEY = process.env.SCRAPECREATORS_API_KEY;
if (!KEY) throw new Error('SCRAPECREATORS_API_KEY yok');
const [inFile, outFile, ...handles] = process.argv.slice(2);
const { results } = JSON.parse(readFileSync(inFile, 'utf8'));

async function igProfile(handle) {
  const res = await fetch(`https://api.scrapecreators.com/v1/instagram/profile?handle=${encodeURIComponent(handle)}`, { headers: { 'x-api-key': KEY } });
  if (!res.ok) return null;
  const u = (await res.json())?.data?.user;
  return u?.id ? u : null;
}

const out = [];
for (const h of handles) {
  const tt = results.find((r) => r.handle === h);
  if (!tt) {
    console.error(`@${h} keşif sonucunda yok`);
    continue;
  }
  // "Instagram 365k" gibi sayılar handle değildir; en az bir harf şart ve takipçi kısaltması (365k, 1.2m) elenir.
  const looksLikeHandle = (x) => !!x && /[a-z]/i.test(x) && !/^\d+([.,]\d+)?[km]\+?$/i.test(x);
  const explicit = tt.bio.match(/(?:[iİ]nstagram|[iİ]nsta|[iİ]g)\s*[:：@\-–/]?\s*@?([a-z0-9._]{2,30})/i)?.[1]?.replace(/\.$/, '').toLowerCase();
  // Bio Instagram'ı anıyor ama handle'ı ayrı yazıyorsa ("Instagram'da takip edin 👉 @x") @mention'ı al.
  const mentioned = /[iİ]nstagram|[iİ]nsta\b|\big\b/i.test(tt.bio) ? tt.bio.match(/@([a-z0-9._]{2,30})/i)?.[1]?.replace(/\.$/, '').toLowerCase() : undefined;
  const bioMention = [explicit, mentioned].find(looksLikeHandle);
  const tried = [...new Set([bioMention, h.toLowerCase()].filter(Boolean))];
  let found = null;
  for (const cand of tried) {
    const u = await igProfile(cand);
    if (!u) continue;
    const igText = [u.biography, u.external_url, ...(u.bio_links ?? []).map((l) => l.url)].join(' ').toLowerCase();
    const evidence =
      cand === bioMention ? `tiktok_bio_mentions_instagram:${cand}` :
      igText.includes(`tiktok.com/@${h.toLowerCase()}`) || igText.includes(`tiktok: ${h.toLowerCase()}`) || igText.includes(`tiktok @${h.toLowerCase()}`) ? 'instagram_bio_links_tiktok' :
      null;
    found = {
      tiktokHandle: h, tiktokUid: tt.uid, igHandle: u.username, igUserId: String(u.id), igFullName: u.full_name, igFollowers: u.edge_followed_by?.count ?? null,
      igPrivate: !!u.is_private, igPosts: u.edge_owner_to_timeline_media?.count ?? null, evidence,
    };
    if (evidence) break;
  }
  out.push(found ?? { tiktokHandle: h, igHandle: null, evidence: null, tried });
  console.error(`@${h} → ${found ? `ig @${found.igHandle} ${found.igFollowers} (${found.evidence ?? 'KANIT YOK'})` : 'bulunamadı'}`);
}
writeFileSync(outFile, JSON.stringify({ ranAt: new Date().toISOString(), rule: 'cross-platform merge only with bio evidence', links: out }, null, 2));
