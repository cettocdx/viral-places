import { describe, expect, it } from 'vitest';
import { MapPlacesResponse, PlaceDetailDto, SourcePostDto } from './index';

describe('contracts', () => {
  it('accepts the spec §19.3 example shape (demo status, null score, unavailable media)', () => {
    const parsed = MapPlacesResponse.safeParse({
      requestId: 'synthetic-map-001',
      asOf: '2026-09-11T09:00:00Z',
      dataStatus: 'demo',
      coverage: { status: 'pilot', cityId: 'demo-city', cityName: 'Demo', noteKey: null, monitoredCreators: null, lastSuccessfulObservationAt: null },
      items: [
        {
          type: 'place',
          id: 'demo-venue-001',
          name: 'Örnek Kafe — DEMO',
          neighborhood: null,
          cityId: 'demo-city',
          category: 'coffee',
          location: { lat: 41.03, lng: 28.98, origin: 'synthetic', expiresAt: null },
          trend: { score: null, status: 'insufficient_data', trending: false },
          media: { mode: 'unavailable', thumbnailUrl: null },
          freshness: { lastObservedAt: null },
          familySupported: false,
        },
      ],
      truncated: false,
      nextCursor: null,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects views as a JS number (must be decimal string) and rejects out-of-range lat', () => {
    const bad = SourcePostDto.safeParse({
      id: 'p', platform: 'tiktok',
      creator: { id: 'c', displayName: 'x', handle: 'x', platform: 'tiktok', verificationKind: 'none', avatarUrl: null },
      publishedAt: '2026-09-10T10:00:00Z', observedAt: '2026-09-11T09:00:00Z',
      views: 10000, sponsored: 'unknown', stance: 'recommend',
      media: { mode: 'unavailable', thumbnailUrl: null, embedUrl: null, sourceUrl: null, rightsPolicyId: 'deny-by-default', expiresAt: null },
      linkResolution: 'approved',
    });
    expect(bad.success).toBe(false);
    expect(MapPlacesResponse.shape.items.element.options[0]!.shape.location.safeParse({ lat: 95, lng: 0, origin: 'synthetic', expiresAt: null }).success).toBe(false);
  });

  it('summary items must carry evidence and source ids (no sourceless claims)', () => {
    const r = PlaceDetailDto.shape.summary.shape.items.element.safeParse({
      claimType: 'try', text: 'x', evidenceIds: [], sourcePostIds: ['p'], lastVerifiedAt: '2026-09-11T09:00:00Z', expiresAt: null,
    });
    expect(r.success).toBe(false);
  });
});
