/**
 * Otorite hesap taraması (ürün sahibi ölçütleri, 20.09.2026): "son 3-6 ayda viral olan, otorite hesaplardan gelen yerler".
 * Takipçisi eşiği geçen (ya da doğrulanmış) TikTok hesaplarının son paylaşımlarını çeker; yalnız son MAX_AGE_DAYS gün
 * içindeki ve MIN_VIEWS üstündeki videolar normal hatta (çıkarım → eşleştirme → onay) girer.
 * Çalıştırma: set -a; source apps/worker/.env; set +a; npx tsx src/authority-sweep.ts [minFollowers] [maxAccounts] [--recent]
 */
import { ScrapeCreatorsAdapter } from '@viral-places/pipeline';
import { buildCtx } from './main.ts';
import { env } from './env.ts';
import { ingestPage } from './handlers/ingest.ts';

const RIGHTS = 'scrapecreators-pilot';
const MIN_FOLLOWERS = Number(process.argv[2] ?? process.env.VP_APPROVE_MIN_FOLLOWERS ?? 50_000);
const MAX_ACCOUNTS = Number(process.argv[3] ?? 400);
/** --recent: yalnız son 6 saatte onaylanan hesaplar (yeni onay turu; eski hesaplar yeniden taranmaz, kredi boşa gitmez). */
const RECENT_ONLY = process.argv.includes('--recent');
const MAX_AGE_DAYS = Number(process.env.VP_APPROVE_MAX_AGE_DAYS ?? 180);
const MIN_VIEWS = env.minViewsForExtract() || 300_000;
const MAX_POSTS_PER_ACCOUNT = 60;
const ISTANBUL_RE = 'istanbul|kadıköy|kadikoy|beşiktaş|besiktas|beyoğlu|beyoglu|üsküdar|uskudar|şişli|sisli|karaköy|karakoy|bakırköy|bakirkoy|ataşehir|atasehir|sarıyer|sariyer|fatih|nişantaşı|nisantasi|moda|bebek|ortaköy|ortakoy|maslak|levent';

async function main(): Promise<void> {
  const ctx = buildCtx();
  const key = env.scrapeCreatorsKey();
  if (!key) throw new Error('SCRAPECREATORS_API_KEY yok');
  const sc = new ScrapeCreatorsAdapter({ apiKey: key, usdPerCredit: env.priceScrapeCreatorsPerCredit() ?? 0.00188, maxPagesPerPoll: 3 });
  const since = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000).toISOString();

  // Yalnız İstanbul içeriği üreten otorite hesaplar: tarama listesinde yurt dışı hesaplar da çıkıyordu
  // (Erbil, Ranya…) ve her biri boşa model çağrısı demekti (canlı koşu bulgusu, 20.09.2026).
  // Yalnız ürün sahibinin onayladığı kişiler taranır (takipçi eşiği değil; 21.09.2026).
  const accounts = (await ctx.db.sql`
    select a.id, a.handle, a.platform_user_id, a.follower_count from public.creator_accounts a
    join private.creator_vetting v on v.account_id = a.id and v.verdict = 'approved'
    where a.platform = 'tiktok'
      and (${!RECENT_ONLY} or v.decided_at > now() - interval '6 hours')
    order by a.follower_count desc nulls last
    limit ${MAX_ACCOUNTS}`) as Array<{ id: string; handle: string; platform_user_id: string | null; follower_count: number | null }>;

  let viral = 0;
  let queued = 0;
  let done = 0;
  for (const a of accounts) {
    try {
      const page = await sc.listRecentPosts({ platform: 'tiktok', handle: a.handle, platformCreatorId: a.platform_user_id, cursor: null, maxPosts: MAX_POSTS_PER_ACCOUNT, newerThan: since, rightsPolicyId: RIGHTS, dataMode: 'live' });
      const fresh = page.posts.filter((p) => p.publishedAt >= since && (p.metrics.views ?? 0) >= MIN_VIEWS);
      viral += fresh.length;
      if (fresh.length > 0) {
        const stats = await ingestPage(ctx, a.id, { ...page, posts: fresh }, { newestPublishedAt: null, seenIds: [] }, null, { bypassPrecheck: true });
        queued += stats.extractQueued;
      }
    } catch (e) {
      ctx.log('warn', 'authority_sweep_failed', { handle: a.handle, err: String((e as Error).message ?? e).slice(0, 140) });
    }
    done += 1;
    if (done % 10 === 0) console.log(JSON.stringify({ done, accounts: accounts.length, viral, queued }));
  }
  console.log(JSON.stringify({ finished: true, accounts: accounts.length, viral, extractQueued: queued, minFollowers: MIN_FOLLOWERS, minViews: MIN_VIEWS, maxAgeDays: MAX_AGE_DAYS }));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
