/** Worker ortamı: secret'lar yalnız sunucuda; eksikse açık hata; hiçbir değer log'lanmaz. */
import { readFileSync } from 'node:fs';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`ENV_MISSING:${name}`);
  return v;
}
const opt = (name: string): string | undefined => process.env[name] || undefined;

export const env = {
  databaseUrl: () => req('DATABASE_URL'),
  /** config/pipeline-policy.json (örnek dosyadan kopyalanır; bütçe alanları null ise canlı iş yok). */
  policyPath: () => opt('VP_PIPELINE_POLICY_PATH') ?? new URL('../../../config/pipeline-policy.example.json', import.meta.url).pathname,
  dataMode: () => (opt('VP_DATA_MODE') === 'live' ? 'live' : 'demo') as 'demo' | 'live',
  scrapeCreatorsKey: () => opt('SCRAPECREATORS_API_KEY'),
  apifyToken: () => opt('APIFY_TOKEN'),
  apifyWebhookUrl: () => opt('APIFY_WEBHOOK_URL'),
  apifyWebhookSecret: () => opt('APIFY_WEBHOOK_SECRET'),
  ensembleToken: () => opt('ENSEMBLEDATA_TOKEN'),
  igGraphToken: () => opt('IG_GRAPH_ACCESS_TOKEN'),
  igGraphUserId: () => opt('IG_GRAPH_OUR_USER_ID'),
  googlePlacesKey: () => opt('GOOGLE_PLACES_API_KEY'),
  /** Belgelenmiş birim fiyatlar (USD); yoksa null → ilgili ücretli iş planlanmaz (§27.4). */
  priceScrapeCreatorsPerCredit: () => numOrNull(opt('PRICE_SCRAPECREATORS_USD_PER_CREDIT')),
  /** Yalnız bu izlenmenin üzerindeki gönderiler AI çıkarımına gider; 0/boş = kapalı (ürün sahibi, 19.09.2026). */
  minViewsForExtract: () => numOrNull(opt('VP_MIN_VIEWS_FOR_EXTRACT')) ?? 0,
  priceEnsemblePerUnit: () => numOrNull(opt('PRICE_ENSEMBLEDATA_USD_PER_UNIT')),
  pricePlacesPer1k: () => numOrNull(opt('PRICE_GOOGLE_PLACES_USD_PER_1K')),
  extractionModel: () => opt('VP_EXTRACTION_MODEL') ?? 'claude-opus-5',
  extractionEffort: () => (opt('VP_EXTRACTION_EFFORT') ?? 'medium') as 'low' | 'medium' | 'high',
  pollIntervalMs: () => Number(opt('VP_WORKER_POLL_MS') ?? 5000),
  batchSize: () => Number(opt('VP_WORKER_BATCH') ?? 5),
};

function numOrNull(v: string | undefined): number | null {
  if (v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface PipelinePolicyFile {
  features: { liveIngestion: boolean; autoPublish: boolean; instagramEnabled: boolean; nativeRehosting: boolean };
  providers: { primaryCandidate: string; fallbackCandidate: string; automaticPaidFailover: boolean };
  budget: { approvedBy: string | null; dailyHardLimitUsd: number | null; monthlyHardLimitUsd: number | null; perJobMaxUsd: number | null; maxNewPostsPerDay: number | null; maxVideoMinutesPerDay: number | null; alertsAtFractions: number[]; blockWhenUnset: boolean };
  polling: { proposalIntervalHours: number; maxConcurrentCreatorRuns: number; maxControlledAttempts: number; sampleLiveCreatorsMax: number };
  matching: { version: string; autoPublishEnabled: boolean; proposalMinEvidenceScore: number; proposalMinTopTwoGap: number; minEvidenceKinds: number; requireGeographicEvidence: boolean };
  trend: { version: string; windowDays: number; weights: { momentum: number; diversity: number; freshness: number; outperformance: number }; creatorDiversitySaturation: number; freshnessDecayHours: number; minimumIndependentCreators: number; minimumPosts: number; minimumMomentumCoverage: number; minimumNormalizationObservations: number; freshObservationAgeHoursExclusive: number; trendingBadge: { minimumScore: number; minimumMomentum: number; minimumCreators: number; newestPostAgeHoursExclusive: number } };
}

let cached: PipelinePolicyFile | null = null;
export function loadPolicy(): PipelinePolicyFile {
  if (cached) return cached;
  cached = JSON.parse(readFileSync(env.policyPath(), 'utf8')) as PipelinePolicyFile;
  return cached;
}
