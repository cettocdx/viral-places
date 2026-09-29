#!/bin/zsh
# Tarama sonrası: yalnız çıkarım/eşleştirme kuyruğunu bekle (metrics.refresh ileri tarihli olabilir), onayla, yayınla, medya, bulut.
set -e
VP=$(cat /tmp/vp.path); S="$(dirname "$0")"
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
L() { docker exec supabase_db_viral_places_build_pack psql -U postgres -Atc "$1"; }
Q() { L "select count(*) from private.job_outbox where status in ('pending','running') and kind in ('post.extract','mention.resolve','venue.refresh') and (lease_until is null or lease_until > now() or status='pending')"; }
cd "/Users/ahmetcetinkaya/Documents/vp-recover/apps/worker"; set -a; source .env; set +a
while [ "$(Q)" -gt 0 ]; do sleep 60; done; echo KUYRUK_BOS_1
npx tsx src/auto-approve.ts 2>&1 | tail -2
npx tsx src/rebuild-published.ts 2>&1 | tail -2
sleep 30; while [ "$(Q)" -gt 0 ]; do sleep 60; done; echo KUYRUK_BOS_2
L "select 'YEREL_YAYINDA='||count(*) from public.venues where status='published'"
set -a; source "/Users/ahmetcetinkaya/Documents/vp-recover/.supabase-token.env"; set +a
npx tsx src/rehost-media.ts 2>&1 | tail -2
zsh "$S/cloud-sync.sh" 2>&1 | tail -12
echo ZINCIR_BITTI
