/** Sağlayıcı kayıt defteri: ortamda anahtarı olan adaptörler; fiyat birimi bilinmeyen sağlayıcı ücretli iş planlayamaz. */
import { ApifyAdapter, EnsembleDataAdapter, FixtureAdapter, InstagramGraphAdapter, ScrapeCreatorsAdapter, type ProviderName, type SocialSourceAdapter } from '@viral-places/pipeline';
import { demoNormalizedPosts } from './fixtures.ts';
import { env } from './env.ts';

export interface AdapterRegistry {
  get(provider: string): SocialSourceAdapter | null;
  primaryFor(platform: 'tiktok' | 'instagram'): SocialSourceAdapter | null;
  available(): ProviderName[];
  scrapeCreators: ScrapeCreatorsAdapter | null;
  apify: ApifyAdapter | null;
}

export function buildAdapters(): AdapterRegistry {
  const map = new Map<string, SocialSourceAdapter>();
  const sc = env.scrapeCreatorsKey() ? new ScrapeCreatorsAdapter({ apiKey: env.scrapeCreatorsKey()!, usdPerCredit: env.priceScrapeCreatorsPerCredit() }) : null;
  if (sc) map.set('scrapecreators', sc);
  const apify = env.apifyToken()
    ? new ApifyAdapter({ token: env.apifyToken()!, tiktokActorId: 'clockworks~tiktok-scraper', instagramActorId: 'apify~instagram-scraper', webhook: env.apifyWebhookUrl() && env.apifyWebhookSecret() ? { requestUrl: env.apifyWebhookUrl()!, secret: env.apifyWebhookSecret()! } : null, waitForFinishSec: env.apifyWebhookUrl() ? 0 : 120 })
    : null;
  if (apify) map.set('apify', apify);
  if (env.ensembleToken()) map.set('ensembledata', new EnsembleDataAdapter({ token: env.ensembleToken()!, usdPerUnit: env.priceEnsemblePerUnit() }));
  if (env.igGraphToken() && env.igGraphUserId()) map.set('instagram_graph', new InstagramGraphAdapter({ accessToken: env.igGraphToken()!, ourIgUserId: env.igGraphUserId()! }));
  map.set('fixture', new FixtureAdapter(demoNormalizedPosts()));
  return {
    get: (p) => map.get(p) ?? null,
    primaryFor: (platform) => {
      if (env.dataMode() === 'demo') return map.get('fixture') ?? null;
      if (platform === 'instagram' && map.has('instagram_graph')) return map.get('instagram_graph')!;
      return map.get('scrapecreators') ?? map.get('apify') ?? map.get('ensembledata') ?? null;
    },
    available: () => Array.from(map.keys()) as ProviderName[],
    scrapeCreators: sc,
    apify,
  };
}
