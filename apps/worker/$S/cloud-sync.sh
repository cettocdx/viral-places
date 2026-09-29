#!/bin/zsh
# Yerel → bulut, silmesiz: her tablo jsonb olarak dışa aktarılır, public.sync_upsert ile eklenir/güncellenir.
set -e
VP=$(cat /tmp/vp.path); S="$(dirname "$0")"
cd /Users/ahmetcetinkaya/Documents/vp-recover; set -a; source .supabase-token.env; set +a
CONN="host=aws-0-eu-central-1.pooler.supabase.com port=5432 user=postgres.uwmbxcsvkieqyzhutjag dbname=postgres sslmode=require connect_timeout=20"
L() { docker exec supabase_db_viral_places_build_pack psql -U postgres -Atc "$1"; }
for spec in public.cities public.creators public.creator_accounts public.venues public.venue_aliases public.venue_external_ids geo.venue_locations public.venue_scores "public.venue_sources|venue_id, source_post_id" public.venue_summaries; do
  T="${spec%%|*}"; K="${spec#*|}"; [ "$K" = "$spec" ] && K=""
  F="$S/sync-$(echo $T | tr . _).json"
  L "select coalesce(jsonb_agg(to_jsonb(t))::text,'[]') from $T t" > "$F"
  if [ -n "$K" ]; then KEY="'$K'::text"; else KEY="null::text"; fi
  { printf "select '%s='||public.sync_upsert('%s'::regclass, \$json\$" "$T" "$T"; cat "$F"; printf "\$json\$::jsonb, %s);\n" "$KEY"; } > "$F.sql"
  docker exec -i -e PGPASSWORD="$SUPABASE_DB_PASSWORD" supabase_db_viral_places_build_pack psql "$CONN" -v ON_ERROR_STOP=1 -At < "$F.sql"
done
docker exec -e PGPASSWORD="$SUPABASE_DB_PASSWORD" supabase_db_viral_places_build_pack psql "$CONN" -At -c "select 'bulut_yayinda='||count(*) from public.venues where status='published'"
