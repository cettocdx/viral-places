/**
 * Otomatik onay (ürün sahibi ölçütleri, 20.09.2026): "son 3-6 ayda viral olan, otorite hesaplardan gelen yerler".
 * Bir eşleşme ancak şu dördü birden sağlanırsa onaylanır:
 *   1) paylaşım son MAX_AGE_DAYS gün içinde,
 *   2) izlenme ≥ MIN_VIEWS,
 *   3) hesap otorite: takipçi ≥ MIN_FOLLOWERS ya da platform doğrulama rozeti,
 *   4) eşleştirme puanı ≥ MIN_SCORE ve sert çelişki (şehir/kapalı) yok.
 * Karar decide_review_task RPC'siyle tek transaction'da yazılır (mention + link + audit + venue.refresh).
 * Çalıştırma: set -a; source apps/worker/.env; set +a; npx tsx src/auto-approve.ts [--dry]
 */
import postgres from 'postgres';
import { venueGate } from '@viral-places/pipeline';

const MAX_AGE_DAYS = Number(process.env.VP_APPROVE_MAX_AGE_DAYS ?? 180);
const MIN_VIEWS = Number(process.env.VP_APPROVE_MIN_VIEWS ?? 300_000);
const MIN_SCORE = Number(process.env.VP_APPROVE_MIN_SCORE ?? 0.85);
const ACTOR = '00000000-0000-0000-0000-000000000000';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL gerekli');
  const dry = process.argv.includes('--dry');
  const sql = postgres(dbUrl, { max: 4 });

  // Yalnız onaylı kişiler, yalnız "öneriyorum" diyen mention'lar (ürün sahibi, 21.09.2026).
  const rows = await sql`
    select t.id task_id, m.resolved_venue_id venue_id, v.own_name, (t.subject_ref->>'score')::numeric score,
           p.published_at, coalesce(a.follower_count, 0) followers, a.verification_kind, a.handle, c.display_name creator_name,
           g.types place_types, g.business_status,
           (select max(pm.views) from private.post_metrics pm where pm.post_id = p.id) views
    from private.review_tasks t
    join private.place_mentions m on m.id = (t.subject_ref->>'mentionId')::uuid
    join private.source_posts p on p.id = m.post_id
    join public.creator_accounts a on a.id = p.account_id
    join public.creators c on c.id = a.creator_id
    join private.creator_vetting cv on cv.account_id = a.id and cv.verdict = 'approved'
    join public.venues v on v.id = m.resolved_venue_id
    left join public.venue_external_ids x on x.venue_id = v.id and x.provider = 'google_places'
    left join private.google_places_cache g on g.place_id = x.external_id
    where t.status = 'open' and t.kind = 'mention_resolution'
      and m.resolved_venue_id is not null
      and m.recommendation = 'recommend'
      and not (t.subject_ref->'reasons' @> '["hard_conflict:city_mismatch"]'::jsonb)
      and not (t.subject_ref->'reasons' @> '["hard_conflict:permanently_closed"]'::jsonb)
      and (t.subject_ref->>'score')::numeric >= ${MIN_SCORE}
      and p.published_at > now() - make_interval(days => ${MAX_AGE_DAYS})
    order by (t.subject_ref->>'score')::numeric desc`;

  // Kişi zaten onaylı (otorite kararı ürün sahibinde); burada izlenme ve yeme-içme kapısı uygulanır.
  const blocked: Array<{ venue: string; by: string; reasons: string[] }> = [];
  const eligible = rows.filter((r) => {
    if (Number(r.views ?? 0) < MIN_VIEWS) return false;
    const gate = venueGate({ name: String(r.own_name), types: (r.place_types as string[] | null) ?? [], businessStatus: (r.business_status as string | null) ?? null, creatorHandle: r.handle as string, creatorDisplayName: r.creator_name as string | null });
    if (!gate.ok) blocked.push({ venue: String(r.own_name), by: String(r.handle), reasons: gate.reasons });
    return gate.ok;
  });
  if (dry) for (const b of blocked) console.log(JSON.stringify({ engellendi: b.venue, oneren: b.by, sebep: b.reasons }));
  console.log(JSON.stringify({ candidates: rows.length, eligible: eligible.length, venues: new Set(eligible.map((r) => r.venue_id)).size, dry }));
  if (dry) {
    for (const r of eligible.slice(0, 20)) console.log(JSON.stringify({ venue: r.own_name, score: Number(r.score), views: Number(r.views), followers: Number(r.followers) }));
    await sql.end();
    return;
  }

  // Gerekçe ayrı değişkende: şablon içindeki ${} sorgu parametresine dönüşüp tırnaklı metni bozuyordu.
  const reason = `auto: onaylı kişi, öneri, son ${MAX_AGE_DAYS} gün, ≥${MIN_VIEWS} izlenme, yeme-içme kapısı`;
  let ok = 0;
  let failed = 0;
  for (const r of eligible) {
    try {
      await sql`select public.decide_review_task(${r.task_id}::uuid, 'approve', ${r.venue_id}::uuid, ${ACTOR}::uuid, ${reason}::text)`;
      ok += 1;
    } catch (e) {
      failed += 1;
      if (failed < 4) console.log(JSON.stringify({ venue: r.own_name, error: String((e as Error).message).slice(0, 120) }));
    }
  }
  const [pub] = await sql`select count(*) c from public.venues where status = 'published'`;
  console.log(JSON.stringify({ approved: ok, failed, publishedVenues: Number(pub!.c) }));
  await sql.end();
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
