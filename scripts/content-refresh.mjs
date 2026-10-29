#!/usr/bin/env node
/**
 * İçerik makinesi (29.10.2026): yeni videoları bulup denetlenmiş hâlde yayına alan tek komut. Haftalık çalışır.
 *  1) authority-stage  — kayıtlı creator'ların son videoları (VP_REFRESH_MONTHS, varsayılan 2 ay; yalnız yeni olanlar)
 *  2) authority-resolve — adı açıklamada olmayanlar konuşmadan çözülür
 *  3) authority-publish — konum, 1080p/720p yükleme (yeni şehir açılmaz)
 *  4) authority-audit   — kare + konuşma denetimi; doğrudan öneri olmayan elenir
 *  5) authority-summarize — yeni mekanlara kaynaklı özet
 *  6) venue-practical  — saat/adres/telefon (OSM)
 * Her adım kendi önbelleğini kullanır; yarıda kalırsa yeniden çalıştırmak kredi harcamaz. Dışlanan hesaplar alınmaz.
 * Kullanım: set -a; . apps/worker/.env; set +a; node scripts/content-refresh.mjs [--apply]
 *   --apply olmadan: yalnız 1–3 deneme modunda çalışır ve ne yayına gireceğini raporlar.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const APPLY = process.argv.includes('--apply');
const stamp = new Date().toISOString().slice(0, 10);
const ROOT = join(process.env.HOME, 'viral-places-ref/content/refresh', stamp);
mkdirSync(ROOT, { recursive: true });
const AUDIT = join(process.env.HOME, 'viral-places-ref/content/audit');
const SUMS = join(process.env.HOME, 'viral-places-ref/content/summaries');
const env = { ...process.env, VP_STAGE_MONTHS: process.env.VP_REFRESH_MONTHS ?? '2', VP_STAGE_MODEL: process.env.VP_STAGE_MODEL ?? 'anthropic/claude-sonnet-5.5', VP_STAGE_CACHE: join(ROOT, 'raw'), VP_TRANSCRIPT_CACHE: join(process.env.HOME, 'viral-places-ref/content/transcripts') };
const run = (label, args) => {
  console.log(`\n▶ ${label}`);
  execFileSync('node', args, { stdio: 'inherit', env, maxBuffer: 256 * 1024 * 1024 });
};

run('1/6 yeni videolar', ['scripts/authority-stage.mjs', join(ROOT, 'stage.json'), process.env.VP_REFRESH_PAGES ?? '3']);
run('2/6 adsızları çöz', ['scripts/authority-resolve.mjs', join(ROOT, 'stage.json'), join(ROOT, 'resolved.json')]);
run('3/6 konum + yükleme', ['scripts/authority-publish.mjs', join(ROOT, 'resolved.json'), join(ROOT, 'pub'), ...(APPLY ? ['--apply'] : [])]);
if (!APPLY) { console.log('\nDENEME: yayına bir şey yazılmadı. Uygulamak için --apply.'); process.exit(0); }
run('4/6 denetim', ['scripts/authority-audit.mjs', AUDIT, '--apply']);
run('5/6 özet', ['scripts/authority-summarize.mjs', SUMS, '--apply']);
run('6/6 pratik bilgi', ['scripts/venue-practical.mjs', join(ROOT, 'practical'), '--apply']);
console.log(`\n✓ tazeleme bitti (${stamp}). Kayıtlar: ${ROOT}`);
