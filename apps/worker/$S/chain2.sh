#!/bin/zsh
# 54 aday onayı → yalnız yeni onaylıların taraması → kuyruk → onay → yeniden yayın → medya → bulut
set -e
VP=$(cat /tmp/vp.path); S="$(dirname "$0")"
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
L() { docker exec supabase_db_viral_places_build_pack psql -U postgres -Atc "$1"; }
Q() { L "select count(*) from private.job_outbox where status in ('pending','running')"; }
L "update private.creator_vetting set verdict='approved', decided_by='owner', decided_at=now(), updated_at=now() where verdict='candidate'; select 'ONAYLANDI='||count(*) from private.creator_vetting where verdict='approved'"
cd "/Users/ahmetcetinkaya/Documents/vp-recover/apps/worker"; set -a; source .env; set +a
npx tsx src/authority-sweep.ts 0 400 --recent 2>&1 | tail -3
while [ "$(Q)" -gt 0 ]; do sleep 60; done; echo KUYRUK_BOS_1
npx tsx src/auto-approve.ts 2>&1 | tail -2
npx tsx src/rebuild-published.ts 2>&1 | tail -2
while [ "$(Q)" -gt 0 ]; do sleep 60; done; echo KUYRUK_BOS_2
L "select 'YEREL_YAYINDA='||count(*) from public.venues where status='published'"
set -a; source "/Users/ahmetcetinkaya/Documents/vp-recover/.supabase-token.env"; set +a
npx tsx src/rehost-media.ts 2>&1 | tail -2
zsh "$S/cloud-sync.sh" 2>&1 | tail -12
echo ZINCIR_BITTI
