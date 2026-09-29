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
const WIDE_MODE = ['wide', 'wide2', 'wide3', 'wide4'].some((w) => process.argv.includes(w));
const PAGES = Math.max(1, Math.min(4, Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 2) || 2));

const QUERIES = [
  'istanbul mekan önerisi', 'istanbul restoran önerisi', 'istanbul kafe önerisi', 'istanbul kahvaltı mekanı', 'istanbul serpme kahvaltı',
  'istanbul burger', 'istanbul pizza', 'istanbul döner', 'istanbul kebap', 'istanbul iskender', 'istanbul lahmacun', 'istanbul kokoreç',
  'istanbul tantuni', 'istanbul midye', 'istanbul balık ekmek', 'istanbul balık restoranı', 'istanbul meyhane', 'istanbul steakhouse',
  'istanbul sushi', 'istanbul brunch', 'istanbul tatlıcı', 'istanbul pastane', 'istanbul cheesecake', 'istanbul dondurma', 'istanbul waffle',
  'istanbul rooftop', 'istanbul boğaz manzaralı kafe', 'istanbul date mekanı', 'istanbul gizli mekan', 'istanbul uygun fiyatlı restoran',
  'kadıköy mekan', 'moda kafe', 'beşiktaş mekan', 'karaköy kafe', 'galata restoran', 'nişantaşı kafe', 'bebek kahvaltı', 'balat kafe',
  'üsküdar mekan', 'ataşehir mekan', 'bakırköy kafe', 'sarıyer balık', 'cihangir kafe', 'ortaköy mekan', 'beylikdüzü mekan',
];

/** Geniş tarama (500 mekan hedefi): semt × kategori ızgarası + genel liste/öneri sorguları. `wide` argümanıyla. */
const AREAS = ['kadıköy', 'moda', 'beşiktaş', 'karaköy', 'galata', 'cihangir', 'taksim', 'nişantaşı', 'bebek', 'arnavutköy', 'ortaköy',
  'balat', 'fatih', 'sultanahmet', 'eminönü', 'üsküdar', 'kuzguncuk', 'çengelköy', 'ataşehir', 'bağdat caddesi', 'caddebostan', 'suadiye',
  'bakırköy', 'yeşilköy', 'florya', 'sarıyer', 'emirgan', 'tarabya', 'levent', 'etiler', 'maslak', 'şişli', 'beylikdüzü', 'kartal', 'maltepe', 'pendik',
  'beykoz', 'kağıthane', 'bomonti', 'adalar'];
const KINDS = ['mekan', 'kafe', 'restoran', 'kahvaltı', 'burger', 'pizza', 'döner', 'kebap', 'tatlıcı', 'balık', 'meyhane', 'brunch', 'nerede yenir', 'en iyi', 'yeni açılan'];
const GENERAL = ['istanbul viral mekan', 'istanbul tiktok mekan', 'istanbul fenomen mekan', 'istanbul en çok konuşulan restoran', 'istanbul yemek turu',
  'istanbul sokak lezzetleri', 'istanbul street food', 'istanbul food vlog', 'istanbul kafe turu', 'istanbul best restaurants', 'istanbul hidden gems',
  'istanbul must try food', 'istanbul coffee shop', 'istanbul dessert', 'istanbul breakfast', 'istanbul bosphorus restaurant', 'istanbul cocktail bar',
  'istanbul ramen', 'istanbul mantı', 'istanbul pide', 'istanbul köfte', 'istanbul çiğ köfte', 'istanbul börek', 'istanbul baklava', 'istanbul künefe',
  'istanbul kumpir', 'istanbul et restoranı', 'istanbul ocakbaşı', 'istanbul esnaf lokantası', 'istanbul vegan', 'istanbul matcha', 'istanbul bubble tea',
  'istanbul çikolata', 'istanbul fırın', 'istanbul simit', 'istanbul pilav', 'istanbul sucuk', 'istanbul kokoreççi', 'istanbul makarna', 'istanbul taco',
  'istanbul kore restoranı', 'istanbul japon restoranı', 'istanbul italyan restoranı', 'istanbul çin restoranı', 'istanbul hint restoranı', 'istanbul beach club',
  'istanbul gece hayatı', 'istanbul canlı müzik', 'istanbul manzaralı restoran', 'istanbul teras', 'istanbul bahçeli kafe', 'istanbul kitap kafe',
  'istanbul oyun kafe', 'istanbul çocuk dostu mekan', 'istanbul müze', 'istanbul gezilecek yerler', 'istanbul aktivite', 'istanbul alışveriş', 'istanbul vintage',
  'istanbul otel', 'istanbul spa', 'istanbul hamam', 'istanbul piknik', 'istanbul park'];

/** İkinci keşif turu (wide2): yeni ifadeler, yemek adları, İngilizce ve hashtag biçimleri — amaç yeni otorite hesap bulmak. */
const DISHES = ['kahvaltı', 'burger', 'pizza', 'döner', 'kebap', 'lahmacun', 'pide', 'mantı', 'çiğ köfte', 'kokoreç', 'midye', 'tantuni',
  'balık', 'sushi', 'ramen', 'taco', 'steak', 'köfte', 'iskender', 'kumpir', 'waffle', 'dondurma', 'baklava', 'künefe', 'cheesecake',
  'kahve', 'matcha', 'brunch', 'tatlı', 'börek', 'çorba', 'meze', 'rakı balık', 'şarap', 'kokteyl'];
const PHRASES = ['istanbul {d}', 'istanbulda {d} nerede yenir', '{d} istanbul tavsiye', 'istanbul en iyi {d}', 'istanbul {d} önerisi',
  'istanbulun en iyi {d}cisi', '{d} istanbul keşfet'];
const EXTRA = ['istanbul mekan keşfi', 'istanbul lezzet durakları', 'istanbul yeme içme', 'istanbul nerede yenir', 'istanbul gurme',
  'istanbul food guide', 'istanbul restaurant review', 'istanbul cafe vlog', 'istanbul yemek önerisi', 'istanbul viral yemek',
  'istanbul tiktok ünlü mekan', 'istanbul influencer mekan', 'istanbul yeni mekan', 'istanbul trend mekan', 'istanbul hafta sonu',
  'istanbul akşam yemeği', 'istanbul öğle yemeği', 'istanbul esnaf lokantası önerisi', 'istanbul uygun mekan', 'istanbul lüks restoran',
  'istanbul manzara kahvaltı', 'istanbul deniz kenarı restoran', 'istanbul tarihi mekan yemek', 'istanbul sokak lezzeti'];
const WIDE2 = [...EXTRA, ...DISHES.flatMap((d) => PHRASES.map((f) => f.replace('{d}', d)))];

/** Üçüncü keşif turu (wide3, 21.09.2026): amaç yeni İstanbul yeme-içme HESABI bulmak; hashtag ve tür odaklı sorgular. */
const TAGS = ['istanbulyemek', 'istanbulrestoran', 'istanbulkafe', 'istanbulgurme', 'istanbullezzet', 'istanbulmekan', 'istanbulkesfet',
  'istanbulkahvalti', 'istanbulburger', 'istanbultatli', 'istanbulsokaklezzetleri', 'istanbulmeyhane', 'istanbulbrunch', 'istanbulkahve',
  'kadikoyyemek', 'besiktasyemek', 'karakoykafe', 'nisantasirestoran', 'uskudaryemek', 'fatihyemek', 'bakirkoyyemek', 'atasehiryemek',
  'yemekvlog', 'gurmegezgin', 'lezzetavcisi', 'mekanonerisi', 'neredeyenir', 'yemektavsiyesi', 'gurmetavsiye', 'yemekkesfi'];
const TYPE_QUERIES = ['istanbul yemek vlogu', 'istanbul restoran denemesi', 'istanbul kafe denemesi', 'istanbul lezzet turu', 'istanbul en iyi mekanlar 2026',
  'istanbul yeni açılan restoran', 'istanbul yeni açılan kafe', 'istanbul gizli kalmış mekanlar', 'istanbul uygun fiyatlı yemek', 'istanbul lüks yemek',
  'istanbul tatlı denemesi', 'istanbul kahvaltı denemesi', 'istanbul burger denemesi', 'istanbul döner denemesi', 'istanbul pizza denemesi',
  'istanbul sokak yemekleri denemesi', 'istanbul boğaz manzaralı restoran', 'istanbul meyhane denemesi', 'istanbul esnaf lokantası denemesi',
  'istanbulda ne yenir', 'istanbulda nerede yenir', 'istanbul yemek önerileri', 'istanbul mekan önerileri', 'istanbul kafe önerileri'];
const WIDE3 = [...TAGS, ...TYPE_QUERIES];
const WIDE = [...GENERAL, ...AREAS.flatMap((a) => KINDS.map((k) => `${a} ${k}`))];

/** Dördüncü keşif turu (wide4, 21.09.2026): ürün sahibi "çok az kişi ve mekan var" — uzun kuyruk: semt × yemek × ifade. */
const AREAS4 = ['kadıköy', 'moda', 'beşiktaş', 'karaköy', 'nişantaşı', 'bebek', 'ortaköy', 'balat', 'fatih', 'üsküdar', 'bağdat caddesi', 'bakırköy',
  'sarıyer', 'etiler', 'şişli', 'kartal', 'maltepe', 'beykoz', 'bomonti', 'cihangir', 'taksim', 'ataşehir', 'kuzguncuk', 'arnavutköy'];
const DISHES4 = ['kahvaltı', 'burger', 'döner', 'kebap', 'pizza', 'tatlı', 'kahve', 'balık', 'meyhane', 'lahmacun', 'pide', 'köfte', 'mantı', 'çorba', 'kokoreç', 'brunch'];
const PHRASES4 = ['{a} {d} tavsiye', '{a} {d} nerede yenir', '{a} en iyi {d}', '{a} {d} denedim'];
const WIDE4 = AREAS4.flatMap((a) => DISHES4.flatMap((d) => PHRASES4.map((f) => f.replace('{a}', a).replace('{d}', d))));

async function main(): Promise<void> {
  const ctx = buildCtx();
  const key = env.scrapeCreatorsKey();
  if (!key) throw new Error('SCRAPECREATORS_API_KEY yok');
  const price = env.priceScrapeCreatorsPerCredit() ?? 0.00188;
  const sc = new ScrapeCreatorsAdapter({ apiKey: key, usdPerCredit: price });
  const seen = new Set<string>();
  let requests = 0, viral = 0, ingested = 0, queued = 0;
  const all = process.argv.includes('wide4') ? WIDE4 : process.argv.includes('wide3') ? WIDE3 : process.argv.includes('wide2') ? WIDE2 : WIDE_MODE ? WIDE : QUERIES;
  // stride/offset: aynı sorgu listesini birkaç süreç arasında bölmek için (tek süreçte ~1.5 dk/sorgu).
  const strideArg = process.argv.find((a) => a.startsWith('--stride='));
  const offsetArg = process.argv.find((a) => a.startsWith('--offset='));
  const stride = strideArg ? Math.max(1, Number(strideArg.split('=')[1])) : 1;
  const offset = offsetArg ? Math.max(0, Number(offsetArg.split('=')[1])) : 0;
  const queries = all.filter((_, i) => i % stride === offset);
  for (const q of queries) {
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
  await ctx.db.insertCostEvent({ kind: 'provider.search', provider: 'scrapecreators', unitKind: 'request', units: requests, microUsd: Math.round(requests * price * 1e6), ref: { queries: queries.length, pages: PAGES, minViews: MIN_VIEWS } });
  console.log(JSON.stringify({ done: true, requests, uniquePosts: seen.size, viral, ingested, extractQueued: queued }));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
