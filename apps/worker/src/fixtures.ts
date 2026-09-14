/** DEMO fixture gönderileri: dataMode=demo iken adaptör bu listeyi döndürür; sentetik ID/URL (fixture.invalid değil, normalize sınırı platform hostu ister). */
import type { NormalizedPost } from '@viral-places/pipeline';
import { contentHashOf } from '@viral-places/pipeline';

export function demoNormalizedPosts(): NormalizedPost[] {
  const base = (over: Partial<NormalizedPost> & Pick<NormalizedPost, 'platformPostId' | 'platformCreatorId' | 'handle' | 'caption' | 'publishedAt'>): NormalizedPost => ({
    schemaVersion: '1.0',
    dataMode: 'synthetic',
    provider: 'fixture',
    providerRunId: 'fixture-run',
    platform: 'tiktok',
    canonicalUrl: `https://www.tiktok.com/@${over.handle}/video/${over.platformPostId}`,
    observedAt: over.publishedAt,
    language: 'tr',
    metrics: { views: 12000, likes: 800, comments: 40, shares: 20, saves: 60 },
    availability: 'available',
    sponsoredStatus: 'unknown',
    mediaCapabilities: { downloadUrlPresent: false, durationMs: 30000 },
    uploadCountryHint: 'TR',
    rightsPolicyId: 'demo-synthetic',
    hashtags: [],
    locationTag: null,
    thumbnailUrl: null,
    platformShortcode: null,
    contentHash: contentHashOf({ platform: 'tiktok', platformPostId: over.platformPostId, caption: over.caption }),
    ...over,
  });
  return [
    base({ platformPostId: '7300000000000000101', platformCreatorId: '1001', handle: 'demo_gezgin', caption: 'Karaköy’de Demo Kafe’nin filtre kahvesi çok iyi ☕ #kahve #karaköy', publishedAt: '2026-09-11T09:00:00.000Z', locationTag: { name: 'Demo Kafe Karaköy', platformLocationId: 'poi-1', lat: 41.0246, lng: 28.9742 } }),
    base({ platformPostId: '7300000000000000102', platformCreatorId: '1002', handle: 'demo_lezzet', caption: 'Cihangir Demo Lokanta: zeytinyağlılar ve kuzu tandır, rezervasyon önerilir #yemek', publishedAt: '2026-09-12T18:30:00.000Z' }),
    base({ platformPostId: '7300000000000000103', platformCreatorId: '1003', handle: 'demo_aile', caption: 'Evde limonata tarifi: 3 limon, 1 bardak şeker #tarif', publishedAt: '2026-09-12T12:00:00.000Z' }),
  ];
}
