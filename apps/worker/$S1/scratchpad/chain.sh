#!/bin/zsh
set -e
VP=/Users/ahmetcetinkaya/Documents/vp-recover
S1="$S1"
export PATH="/opt/homebrew/opt/node@22/bin:\$PATH"
cd "\/Users/ahmetcetinkaya/Documents/vp-recover/apps/worker"
set -a; source .env; set +a
# 1) keşif turunun bitmesini bekle
while ! grep -q '"done":true' "\$S1/scratchpad/search2.log" 2>/dev/null; do sleep 60; done
echo "ADIM1_kesif_bitti"
# 2) yeni hesapların profilleri
npx tsx src/creator-profiles.ts 2000 --all >> "\$S1/scratchpad/profiles4.log" 2>&1
tail -1 "\$S1/scratchpad/profiles4.log"
# 3) İstanbul otorite hesaplarını tara
npx tsx src/authority-sweep.ts 50000 800 >> "\$S1/scratchpad/sweep4.log" 2>&1
tail -1 "\$S1/scratchpad/sweep4.log"
# 4) kuyruk boşalınca onayla
while [ "\$(docker exec supabase_db_viral_places_build_pack psql -U postgres -At -c "select count(*) from private.job_outbox where status in ('pending','running') and kind in ('post.extract','mention.resolve')")" -gt 0 ]; do sleep 60; done
docker exec -i supabase_db_viral_places_build_pack psql -U postgres -q < "\$S1/scratchpad/approve.sql" 2>&1 | grep -o "onaylandi=[0-9]* hata=[0-9]*"
docker exec supabase_db_viral_places_build_pack psql -U postgres -At -c "select 'YAYINDA='||count(*) from public.venues where status='published'"
