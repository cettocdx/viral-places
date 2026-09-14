import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CreatorDetailDto, MapPlaceItemDto, PlaceDetailDto } from '@viral-places/contracts';
import { DEMO_TREND_CONFIG, demoCreatorDetail, demoCreatorIds, demoMapItems, demoPlaceDetail, demoVenueIds } from './index';

describe('demo fixtures', () => {
  it('trend config mirrors config/pipeline-policy.example.json', () => {
    const policy = JSON.parse(readFileSync(resolve(__dirname, '../../../config/pipeline-policy.example.json'), 'utf8'));
    expect(policy.trend).toMatchObject(DEMO_TREND_CONFIG);
  });

  it('every map item and detail validates against contracts and is labeled demo', () => {
    for (const item of demoMapItems) expect(MapPlaceItemDto.safeParse(item).success).toBe(true);
    for (const id of demoVenueIds) {
      const d = demoPlaceDetail(id)!;
      const r = PlaceDetailDto.safeParse(d);
      if (!r.success) throw new Error(JSON.stringify(r.error.issues));
      expect(d.dataStatus).toBe('demo');
      expect(d.name.startsWith('Demo ')).toBe(true);
    }
    for (const id of demoCreatorIds) {
      const c = demoCreatorDetail(id)!;
      const r = CreatorDetailDto.safeParse(c);
      if (!r.success) throw new Error(JSON.stringify(r.error.issues));
    }
  });

  it('scores come from the deterministic engine, including null/stale/insufficient cases', () => {
    const byId = Object.fromEntries(demoMapItems.map((i) => [i.id, i]));
    expect(byId['demo-venue-007']!.trend.score).toBe(71); // V01
    expect(byId['demo-venue-004']!.trend).toMatchObject({ score: null, status: 'insufficient_data' }); // single creator
    expect(byId['demo-venue-006']!.trend).toMatchObject({ score: null, status: 'insufficient_data' }); // momentum missing
    expect(byId['demo-venue-005']!.trend.status).toBe('stale');
    expect(byId['demo-venue-001']!.trend.trending).toBe(true);
    // Cold start: not every pin gets a decorative 90+ score.
    expect(demoMapItems.filter((i) => (i.trend.score ?? 0) >= 90)).toHaveLength(0);
  });

  it('media is deny-by-default: creator without rights -> unavailable & no source url', () => {
    const d = demoPlaceDetail('demo-venue-004')!;
    expect(d.sources[0]!.media.mode).toBe('unavailable');
    expect(d.sources[0]!.media.sourceUrl).toBeNull();
    const a = demoPlaceDetail('demo-venue-001')!;
    expect(a.sources.find((s) => s.creator.id === 'demo-creator-a')!.media.mode).toBe('link_only');
  });

  it('never uses reference mockup names', () => {
    const banned = ['Minoa', 'Petra Roastery', 'Arkestra', 'Louie', 'Sofia'];
    const text = JSON.stringify(demoVenueIds.map(demoPlaceDetail)) + JSON.stringify(demoCreatorIds.map(demoCreatorDetail));
    for (const b of banned) expect(text.includes(b)).toBe(false);
  });
});
