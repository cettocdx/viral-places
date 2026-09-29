/**
 * Arama tabanlı toplama (ürün sahibi, 19.09.2026): "İstanbul için en az 100 mekan, her biri ≥300k izlenme".
 * Creator taraması tek başına yetmedi (viral videoların çoğu mekan içeriği değil). Bu araç TikTok anahtar kelime
 * aramasından eşik üstü videoları toplar, creator hesabını (izleme KAPALI) oluşturur ve normal ingest hattına sokar:
 * ön inceleme → AI çıkarım → Places eşleştirme → insan onayı. Hak kaydı scrapecreators-pilot; bütçe kapısı çıkarımda uygulanır.
 *
 * Çalıştırma: set -a; source apps/worker/.env; set +a; pnpm --filter @viral-places/worker exec tsx src/search-ingest.ts [sayfa=2]
 */
import { ScrapeCreatorsAdapter } from '@viral-places/pipeline';
import { buildCtx } from './main.ts';
import { env } from './env.ts';
import { ingestPage } from './handlers/ingest.ts';

const RIGHTS = 'scrapecreators-pilot';
const MIN_VIEWS = env.minViewsForExtract() || 300_000;
const PAGES = Math.max(1, Math.min(4, Number(process.argv[2] ?? 2) || 2));

const QUERIES = [
  'istanbul mekan önerisi', 'istanbul restoran önerisi', 'istanbul kafe önerisi', 'istanbul kahvaltı mekanı', 'istanbul serpme kahvaltı',
  'istanbul burger', 'istanbul pizza', 'istanbul döner', 'istanbul kebap', 'istanbul iskender', 'istanbul lahmacun', 'istanbul kokoreç',
  'istanbul tantuni', 'istanbul midye', 'istanbul balık ekmek', 'istanbul balık restoranı', 'istanbul meyhane', 'istanbul steakhouse',
  'istanbul sushi', 'istanbul brunch', 'istanbul tatlıcı', 'istanbul pastane', 'istanbul cheesecake', 'istanbul dondurma', 'istanbul waffle',
  'istanbul rooftop', 'istanbul boğaz manzaralı kafe', 'istanbul date mekanı', 'istanbul gizli mekan', 'istanbul uygun fiyatlı restoran',
  'kadıköy mekan', 'moda kafe', 'beşiktaş mekan', 'karaköy kafe', 'galata restoran', 'nişantaşı kafe', 'bebek kahvaltı', 'balat kafe',
  'üsküdar mekan', 'ataşehir mekan', 'bakırköy kafe', 'sarıyer balık', 'cihangir kafe', 'ortaköy mekan', 'beylikdüzü mekan',
];

async function main(): Promise<void> {
  const ctx = buildCtx();
  const key = env.scrapeCreatorsKey();
  if (!key) throw new Error('SCRAPECREATORS_API_KEY yok');
  const price = env.priceScrapeCreatorsPerCredit() ?? 0.00188;
  const sc = new ScrapeCreatorsAdapter({ apiKey: key, usdPerCredit: price });
  const seen = new Set<string>();
  let requests = 0, viral = 0, ingested = 0, queued = 0;
  for (const q of QUERIES) {
    let cursor: string | undefined;
    for (let page = 0; page < PAGES; page++) {
      let res;
      try {
        res = await sc.searchPosts(q, { rightsPolicyId: RIGHTS, region: 'TR', ...(cursor ? { cursor } : {}) });
        requests += 1;
      } catch (e) {
        ctx.log('warn', 'search_failed', { q, err: String((e as Error).message ?? e).slice(0, 160) });
        break;
      }
      for (const post of res.posts) {
        if (seen.has(post.platformPostId)) continue;
        seen.add(post.platformPostId);
        if ((post.metrics.views ?? 0) < MIN_VIEWS) continue;
        viral += 1;
        const acc = (await ctx.db.findAccountByPlatformId('tiktok', post.platformCreatorId))
          ?? (await ctx.db.createCreatorAccount({ platform: 'tiktok', platformUserId: post.platformCreatorId, handle: post.handle, canonicalUrl: `https://www.tiktok.com/@${post.handle}`, displayName: post.handle }));
        const stats = await ingestPage(ctx, acc.id, { posts: [post], rejected: [], nextCursor: null, pageLimitReached: false, providerRunId: res.providerRunId, newestFirstGuaranteed: false, costMicroUsd: null }, { newestPublishedAt: null, seenIds: [] }, null);
        ingested += stats.new + stats.edited;
        queued += stats.extractQueued;
      }
      if (!res.nextCursor) break;
      cursor = res.nextCursor;
    }
    console.log(JSON.stringify({ q, requests, viral, ingested, queued }));
  }
  await ctx.db.insertCostEvent({ kind: 'provider.search', provider: 'scrapecreators', unitKind: 'request', units: requests, microUsd: Math.round(requests * price * 1e6), ref: { queries: QUERIES.length, pages: PAGES, minViews: MIN_VIEWS } });
  console.log(JSON.stringify({ done: true, requests, uniquePosts: seen.size, viral, ingested, extractQueued: queued }));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
