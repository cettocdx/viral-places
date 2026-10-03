/**
 * Yerel yayın → bulut (canlı) Supabase aktarımı (02–03.10.2026; 21.09'daki kayıp cloud-sync.sh'in yerine).
 * Yalnız uygulamanın okuduğu tablolar taşınır: venues, geo.venue_locations, venue_external_ids, venue_aliases,
 * venue_scores, venue_summaries, venue_sources, creators, creator_accounts. İç hat tabloları (posts, mentions) taşınmaz.
 *
 * Kimlik eşleme (yerel ve bulut ayrı kimlik üretir):
 *   - Mekan: Google Place kimliği (venue_external_ids) bulutta varsa bulut kimliği kullanılır, yoksa yerel kimlikle eklenir.
 *   - Creator: hesap (platform, platform_user_id) bulutta varsa onun creator kaydı kullanılır, yoksa eklenir.
 * Tek transaction; varsayılan DENEME (--apply olmadan hiçbir şey yazılmaz).
 *
 * Çalıştırma: set -a; . apps/worker/.env; set +a; npx tsx src/cloud-sync.ts [--apply]
 */
import postgres from 'postgres';

const APPLY = process.argv.includes('--apply');
type Row = Record<string, unknown>;

function need(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`${k} gerekli`);
  return v;
}

async function main(): Promise<void> {
  const local = postgres(need('DATABASE_URL'), { max: 2 });
  const cloud = postgres(need('CLOUD_DATABASE_URL'), { max: 2, prepare: false, ssl: 'require' });
  try {
    const venues = (await local`select * from public.venues where status = 'published' and data_mode = 'live'`) as Row[];
    const ids = venues.map((v) => v.id as string);
    if (ids.length === 0) {
      console.log(JSON.stringify({ venues: 0 }));
      return;
    }
    const ext = (await local`select * from public.venue_external_ids where venue_id = any(${ids})`) as Row[];
    const aliases = (await local`select * from public.venue_aliases where venue_id = any(${ids})`) as Row[];
    const locs = (await local`select venue_id, location::text as location, source_type, source_ref, expires_at, observed_at from geo.venue_locations where venue_id = any(${ids})`) as Row[];
    const scores = (await local`select * from public.venue_scores where venue_id = any(${ids})`) as Row[];
    const summaries = (await local`select * from public.venue_summaries where venue_id = any(${ids})`) as Row[];
    const sources = (await local`select * from public.venue_sources where venue_id = any(${ids})`) as Row[];
    const creatorIds = [...new Set(sources.map((s) => s.creator_id as string).filter(Boolean))];
    const accounts = (await local`select * from public.creator_accounts where creator_id = any(${creatorIds})`) as Row[];
    const creators = (await local`select * from public.creators where id = any(${creatorIds})`) as Row[];

    // 1) Mekan eşleme: Google Place kimliği bulutta varsa bulut mekanı.
    const venueMap = new Map<string, string>();
    let venueExisting = 0;
    for (const v of venues) {
      const place = ext.find((e) => e.venue_id === v.id);
      if (place) {
        const [hit] = await cloud`select venue_id from public.venue_external_ids where provider = ${place.provider as string} and external_id = ${place.external_id as string} limit 1`;
        if (hit) {
          venueMap.set(v.id as string, hit.venue_id as string);
          venueExisting += 1;
          continue;
        }
      }
      venueMap.set(v.id as string, v.id as string);
    }
    // 2) Creator eşleme: hesap bulutta varsa onun creator kaydı.
    const creatorMap = new Map<string, string>();
    const newAccounts: Row[] = [];
    for (const a of accounts) {
      const [hit] = await cloud`select creator_id from public.creator_accounts where platform = ${a.platform as string} and platform_user_id = ${a.platform_user_id as string} limit 1`;
      if (hit) creatorMap.set(a.creator_id as string, hit.creator_id as string);
      else newAccounts.push(a);
    }
    for (const c of creators) if (!creatorMap.has(c.id as string)) creatorMap.set(c.id as string, c.id as string);
    // Bulutta hiçbir hesabı olmayan creator yeni eklenir; yeni hesaplar eşlenmiş creator kimliğine bağlanır
    // (creator'ın bir hesabı bulutta, diğeri yeniyse yerel creator kimliği bulutta olmaz → FK hatası).
    const newCreators = creators.filter((c) => creatorMap.get(c.id as string) === c.id);

    const mv = (id: unknown) => venueMap.get(id as string)!;
    const mc = (id: unknown) => creatorMap.get(id as string) ?? (id as string);
    const plan = {
      apply: APPLY,
      venues: venues.length,
      venuesAlreadyInCloud: venueExisting,
      venuesNew: venues.length - venueExisting,
      creatorsNew: newCreators.length,
      accountsNew: newAccounts.length,
      sources: sources.length,
      scores: scores.length,
      summaries: summaries.length,
      locations: locs.length,
    };
    console.log(JSON.stringify(plan));
    if (!APPLY) {
      console.log('DENEME: hiçbir şey yazılmadı. Uygulamak için --apply.');
      return;
    }

    await cloud.begin(async (tx) => {
      const up = (table: string, rows: Row[], conflict?: string) =>
        // Bulutta iki aşırı yükleme var; iki parametreli çağrı belirsiz ("is not unique"): üçüncü parametre hep açık verilir.
        rows.length === 0 ? Promise.resolve() : tx`select public.sync_upsert(${table}::regclass, ${tx.json(rows as never)}::jsonb, ${conflict ?? null}::text)`;
      await up('public.creators', newCreators);
      await up('public.creator_accounts', newAccounts.map((a) => ({ ...a, creator_id: mc(a.creator_id) })));
      // Bulutta zaten olan mekanın satırına dokunmadan yalnız yayın durumu açılır; yeni mekan tam satırla eklenir.
      const fresh = venues.filter((v) => mv(v.id) === v.id);
      await up('public.venues', fresh);
      const existingIds = venues.filter((v) => mv(v.id) !== v.id).map((v) => mv(v.id));
      if (existingIds.length) await tx`update public.venues set status = 'published', updated_at = now() where id = any(${existingIds})`;
      await up('public.venue_external_ids', ext.filter((e) => mv(e.venue_id) === e.venue_id));
      await up('public.venue_aliases', aliases.map((a) => ({ ...a, venue_id: mv(a.venue_id) })));
      await up('geo.venue_locations', locs.map((l) => ({ ...l, venue_id: mv(l.venue_id) })));
      await up('public.venue_scores', scores.map((s) => ({ ...s, venue_id: mv(s.venue_id) })));
      await up('public.venue_summaries', summaries.map((s) => ({ ...s, venue_id: mv(s.venue_id) })));
      await up('public.venue_sources', sources.map((s) => ({ ...s, venue_id: mv(s.venue_id), creator_id: mc(s.creator_id) })), 'venue_id, source_post_id');
    });
    const [after] = await cloud`select count(*)::int as n from public.venues where status = 'published'`;
    console.log(JSON.stringify({ applied: true, cloudPublished: after?.n }));
  } finally {
    await local.end({ timeout: 5 });
    await cloud.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(String((e as Error).message ?? e).replace(/postgres(ql)?:\/\/\S+/g, '<gizli>'));
  process.exit(1);
});
