import { describe, expect, it } from 'vitest';
import { DEFAULT_MATCH_CONFIG, nameSimilarity, resolveMention, scoreCandidate, type VenueCandidate } from '../matcher';

const kadikoy: VenueCandidate = { venueId: 'v1', name: 'Demo Kahve Kadıköy', aliases: ['Demo Kahve'], city: 'İstanbul', neighborhood: 'Kadıköy', category: 'coffee', status: 'open' };
const besiktas: VenueCandidate = { venueId: 'v2', name: 'Demo Kahve Beşiktaş', aliases: ['Demo Kahve'], city: 'İstanbul', neighborhood: 'Beşiktaş', category: 'coffee', status: 'open' };
const ankara: VenueCandidate = { venueId: 'v3', name: 'Demo Kahve', aliases: [], city: 'Ankara', neighborhood: null, category: 'coffee', status: 'open' };
const cfgAuto = { ...DEFAULT_MATCH_CONFIG, autoPublishEnabled: true };

describe('nameSimilarity', () => {
  it('Türkçe küçük harf ve jenerik kelimeler normalize edilir', () => {
    expect(nameSimilarity('DEMO KAHVE', 'demo kahve')).toBe(1);
    expect(nameSimilarity('Demo Coffee', 'Demo Kahve')).toBe(1);
    expect(nameSimilarity('Demo', 'Başka')).toBe(0);
  });
  it('coğrafi/şube ekleri ve handle biçimi (canlı koşu çiftleri, 19.09.2026)', () => {
    expect(nameSimilarity('Çi Çi', 'ÇiÇi Beşiktaş')).toBe(1);
    expect(nameSimilarity('Taico', 'Taico - Moda')).toBe(1);
    expect(nameSimilarity('Limon Lokal', 'Limon Lokal İstanbul')).toBe(1);
    expect(nameSimilarity('daliburgeristanbul', 'Dali Burger Kadıköy')).toBeGreaterThanOrEqual(0.9);
    expect(nameSimilarity('@taicomatcha', 'Taico - Kadıköy')).toBeGreaterThanOrEqual(0.9);
    expect(nameSimilarity('holecoffeeco', 'Hole Coffee & Matcha Co.')).toBeGreaterThanOrEqual(0.9);
    expect(nameSimilarity('jffoodandjuice (Food and Juice)', 'JF Food and Juice')).toBeGreaterThanOrEqual(0.9);
    expect(nameSimilarity('Manhattan', 'Mashattan Fenerbahçe')).toBe(0);
    expect(nameSimilarity('Demo Kahve Kadıköy', 'Demo Kahve Beşiktaş')).toBe(1); // şube ayrımı mahalle bileşenine bırakılır
  });
});

describe('resolveMention (§16.2)', () => {
  it('iki şube: mahalle ipucu ayırır, gap ≥ .12 → auto (yalnız auto-publish açıkken)', () => {
    const m = { rawPlaceName: 'Demo Kahve', cityHint: 'İstanbul', neighborhoodOrAddressHint: 'Kadıköy', categoryCandidates: ['coffee'], evidenceKinds: ['caption', 'transcript'] };
    const a = scoreCandidate(m, kadikoy);
    const b = scoreCandidate(m, besiktas);
    expect(a.score).toBe(1);
    expect(b.score).toBe(0.8);
    expect(resolveMention(m, [kadikoy, besiktas, ankara], cfgAuto)).toMatchObject({ status: 'auto_match', venueId: 'v1' });
    expect(resolveMention(m, [kadikoy, besiktas, ankara])).toMatchObject({ status: 'review_required', venueId: 'v1', reasons: ['auto_publish_disabled'] });
  });
  it('mahalle ipucu yoksa iki şube ayrılamaz → review (gap küçük)', () => {
    const m = { rawPlaceName: 'Demo Kahve', cityHint: 'İstanbul', neighborhoodOrAddressHint: null, categoryCandidates: ['coffee'], evidenceKinds: ['caption', 'transcript'] };
    const r = resolveMention(m, [kadikoy, besiktas], cfgAuto);
    expect(r.status).toBe('review_required');
    expect(r.status === 'review_required' && r.reasons).toContain('top_two_gap_small');
  });
  it('şehir çelişkisi sert engel; coğrafi kanıt yoksa auto yok; tek kanıt türü yetmez', () => {
    const m = { rawPlaceName: 'Demo Kahve', cityHint: 'İzmir', neighborhoodOrAddressHint: null, categoryCandidates: ['coffee'], evidenceKinds: ['caption', 'transcript'] };
    const r = resolveMention(m, [ankara], cfgAuto);
    expect(r.status).toBe('unresolved');
    const noGeo = { ...m, cityHint: null };
    const r2 = resolveMention(noGeo, [ankara], cfgAuto);
    expect(r2.status === 'review_required' && r2.reasons).toContain('no_geographic_evidence');
    const oneKind = { ...m, cityHint: 'Ankara', evidenceKinds: ['caption'] };
    const r3 = resolveMention(oneKind, [ankara], cfgAuto);
    expect(r3.status === 'review_required' && r3.reasons).toContain('insufficient_evidence_kinds');
  });
  it('şehir ipucu ilçe ise (Kadıköy) şehir çelişkisi değildir ve alan eşleşmesi sayılır (canlı koşu bulgusu, 19.09.2026)', () => {
    const m = { rawPlaceName: 'Demo Kahve', cityHint: 'Kadıköy', neighborhoodOrAddressHint: null, categoryCandidates: ['coffee'], evidenceKinds: ['caption', 'creator_supplied'] };
    const a = scoreCandidate(m, kadikoy);
    expect(a.hardConflicts).toEqual([]);
    expect(a.components.city).toBe(1);
    expect(a.components.area).toBe(1);
    expect(scoreCandidate(m, besiktas).components.city).toBe(0);
    expect(scoreCandidate(m, besiktas).hardConflicts).toContain('city_mismatch');
  });
  it('adres ipucu mahalle/ilçe adını içeriyorsa alan eşleşir; kategori bilinmiyorsa ceza yerine yeniden ağırlıklandırılır', () => {
    const m = { rawPlaceName: 'Demo Kahve', cityHint: 'İstanbul', neighborhoodOrAddressHint: 'Caferağa Mah. Nazmibey Sk. No:2E, Kadıköy / İstanbul', categoryCandidates: ['coffee'], evidenceKinds: ['caption', 'transcript'] };
    expect(scoreCandidate(m, kadikoy).components.area).toBe(1);
    expect(scoreCandidate(m, besiktas).components.area).toBe(0);
    const unknownCat: VenueCandidate = { ...kadikoy, venueId: 'v9', category: 'other' };
    const s = scoreCandidate(m, unknownCat);
    expect(s.components.category).toBeNull();
    expect(s.score).toBe(1);
  });
  it('aday yoksa unresolved; kalıcı kapalı mekan sert çelişki', () => {
    expect(resolveMention({ rawPlaceName: 'x', cityHint: null, neighborhoodOrAddressHint: null, categoryCandidates: [], evidenceKinds: [] }, [])).toMatchObject({ status: 'unresolved' });
    const closed = { ...ankara, status: 'permanently_closed' as const };
    const r = resolveMention({ rawPlaceName: 'Demo Kahve', cityHint: 'Ankara', neighborhoodOrAddressHint: null, categoryCandidates: ['coffee'], evidenceKinds: ['caption', 'transcript'] }, [closed], cfgAuto);
    expect(r.status === 'review_required' && r.reasons).toContain('hard_conflict:permanently_closed');
  });
});
