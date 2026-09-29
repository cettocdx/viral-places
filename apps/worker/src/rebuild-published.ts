/**
 * Yayını sıfırdan kur (ürün sahibi, 21.09.2026). Eski dönemde herkes "öneren" sayıldığı için semtler, köprü, AVM ve
 * markaların kendi reklamları yayına girmişti; tüm yayın gizlendi. Bu betik yalnız şunları geri yayına alır:
 *   - öneren hesap onaylı (private.creator_vetting.verdict = 'approved'),
 *   - mention "öneriyorum" (recommendation = 'recommend'),
 *   - paylaşım son MAX_AGE_DAYS gün içinde ve MIN_VIEWS üstünde,
 *   - venueGate geçer (gerçek yeme-içme işletmesi, semt/köprü/park/AVM değil, kendi reklamı değil).
 * Onaysız kişilerden gelen bağlantılar reddedilir ki mekanın kaynak videoları da temiz olsun.
 * Çalıştırma: set -a; source apps/worker/.env; set +a; npx tsx src/rebuild-published.ts [--dry]
 */
import postgres from 'postgres';
import { venueGate } from '@viral-places/pipeline';

const MAX_AGE_DAYS = Number(process.env.VP_APPROVE_MAX_AGE_DAYS ?? 180);
const MIN_VIEWS = Number(process.env.VP_APPROVE_MIN_VIEWS ?? 300_000);

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL gerekli');
  const dry = process.argv.includes('--dry');
  const sql = postgres(dbUrl, { max: 4 });

  // 1) Onaysız kişilerden gelen bağlantılar yayın kaynağı olamaz.
  const dropped = dry
    ? await sql`select count(*)::int c from private.venue_post_links l join private.source_posts p on p.id = l.post_id
        where l.resolution_status = 'approved'
          and not exists (select 1 from private.creator_vetting v where v.account_id = p.account_id and v.verdict = 'approved')`
    : await sql`update private.venue_post_links l set resolution_status = 'rejected'
        from private.source_posts p
        where p.id = l.post_id and l.resolution_status = 'approved'
          and not exists (select 1 from private.creator_vetting v where v.account_id = p.account_id and v.verdict = 'approved')
        returning 1`;
  const droppedCount = dry ? Number((dropped[0] as { c: number }).c) : dropped.length;

  // 2) Yayın adayları: onaylı kişiden, öneri, taze, viral bağlantısı olan mekanlar.
  const rows = await sql`
    select distinct v.id, v.own_name, v.status, g.types place_types, g.business_status,
           a.handle, c.display_name creator_name
    from private.venue_post_links l
    join private.source_posts p on p.id = l.post_id
    join private.place_mentions m on m.post_id = l.post_id and m.resolved_venue_id = l.venue_id
    join public.creator_accounts a on a.id = p.account_id
    join public.creators c on c.id = a.creator_id
    join private.creator_vetting cv on cv.account_id = a.id and cv.verdict = 'approved'
    join public.venues v on v.id = l.venue_id
    left join public.venue_external_ids x on x.venue_id = v.id and x.provider = 'google_places'
    left join private.google_places_cache g on g.place_id = x.external_id
    where l.resolution_status = 'approved'
      and m.recommendation = 'recommend'
      and p.published_at > now() - make_interval(days => ${MAX_AGE_DAYS})
      and (select max(pm.views) from private.post_metrics pm where pm.post_id = p.id) >= ${MIN_VIEWS}`;

  const passed: Array<{ id: string; name: string }> = [];
  const blocked: Record<string, number> = {};
  for (const r of rows) {
    const gate = venueGate({
      name: String(r.own_name),
      types: (r.place_types as string[] | null) ?? [],
      businessStatus: (r.business_status as string | null) ?? null,
      creatorHandle: r.handle as string,
      creatorDisplayName: r.creator_name as string | null,
    });
    if (gate.ok) passed.push({ id: r.id as string, name: String(r.own_name) });
    else for (const reason of gate.reasons) blocked[reason] = (blocked[reason] ?? 0) + 1;
  }

  console.log(JSON.stringify({ dry, linkleriDusurulen: droppedCount, aday: rows.length, kapidanGecen: passed.length, engellenen: blocked }));
  if (dry) {
    for (const p of passed.slice(0, 25)) console.log(' ✓', p.name);
    await sql.end();
    return;
  }

  // 3) Yayın akışı yalnız taslak/incelemedeki mekanı yayına alır; gizlenmişleri taslağa çevirip venue.refresh kuyruğa girer.
  let queued = 0;
  for (const p of passed) {
    await sql`update public.venues set status = 'draft', updated_at = now() where id = ${p.id} and status = 'hidden'`;
    const [r] = await sql`select * from public.enqueue_job('venue.refresh', ${sql.json({ venueId: p.id })}, ${`venue.refresh:${p.id}:rebuild`}, null, now())`;
    if (r) queued += 1;
  }
  console.log(JSON.stringify({ yayinaAlinan: passed.length, kuyruga: queued }));
  await sql.end();
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
