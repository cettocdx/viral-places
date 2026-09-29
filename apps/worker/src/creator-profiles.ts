/**
 * Otorite ölçütü için creator profillerini toplar (takipçi, doğrulama rozeti, avatar, bio).
 * Yalnız aday mekanlara bağlı hesaplar çekilir; profil başına 1 ScrapeCreators kredisi.
 * Çalıştırma: set -a; source apps/worker/.env; set +a; npx tsx src/creator-profiles.ts [limit]
 */
import postgres from 'postgres';

const LIMIT = Number(process.argv[2] ?? 1000);

async function main() {
  const key = process.env.SCRAPECREATORS_API_KEY;
  const dbUrl = process.env.DATABASE_URL;
  if (!key || !dbUrl) throw new Error('SCRAPECREATORS_API_KEY ve DATABASE_URL gerekli');
  const sql = postgres(dbUrl, { max: 2 });
  // --all: yalnız mekan geçen gönderilerin sahipleri değil, keşfedilen bütün hesaplar (otorite havuzunu büyütmek için).
  const all = process.argv.includes('--all');
  const rows = all
    ? await sql`select a.id, a.handle from public.creator_accounts a
        where a.follower_count is null and a.platform = 'tiktok' and a.handle not like 'demo%' limit ${LIMIT}`
    : await sql`select distinct a.id, a.handle from public.creator_accounts a
        join private.source_posts p on p.account_id = a.id
        join private.place_mentions m on m.post_id = p.id
        where a.follower_count is null and a.platform = 'tiktok' and a.handle not like 'demo%'
        limit ${LIMIT}`;
  let ok = 0;
  let fail = 0;
  const pool = 6;
  const queue = [...rows];
  await Promise.all(
    Array.from({ length: pool }, async () => {
      for (;;) {
        const r = queue.shift();
        if (!r) return;
        try {
          const res = await fetch(`https://api.scrapecreators.com/v1/tiktok/profile?handle=${encodeURIComponent(r.handle as string)}`, { headers: { 'x-api-key': key } });
          if (!res.ok) {
            fail += 1;
            continue;
          }
          const d = (await res.json()) as { user?: { verified?: boolean; signature?: string; avatarLarger?: string }; stats?: { followerCount?: number; videoCount?: number } };
          const followers = d.stats?.followerCount ?? null;
          await sql`update public.creator_accounts set
              follower_count = ${followers}, post_count = ${d.stats?.videoCount ?? null},
              bio = coalesce(bio, ${d.user?.signature?.slice(0, 500) ?? null}),
              avatar_url = case when avatar_url like '%/storage/v1/object/public/%' then avatar_url else coalesce(${d.user?.avatarLarger ?? null}, avatar_url) end,
              verification_kind = case when verification_kind = 'app_claimed' then verification_kind when ${d.user?.verified === true} then 'platform_badge_observed' else verification_kind end,
              profile_observed_at = now()
            where id = ${r.id}`;
          ok += 1;
        } catch {
          fail += 1;
        }
      }
    }),
  );
  console.log(JSON.stringify({ accounts: rows.length, ok, fail }));
  await sql.end();
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
