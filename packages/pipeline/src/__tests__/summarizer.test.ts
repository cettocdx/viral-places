import { describe, expect, it } from 'vitest';
import { PlaceSummarizer, validateSummary, type SummaryInput, type SummaryOutput } from '../ai/summarizer';

const input: SummaryInput = {
  venueId: 'v1',
  venueName: 'Demo Kafe',
  locale: 'tr',
  approvedClaims: [
    { claimId: 'c1', sourcePostId: 'p1', mentionId: 'm1', key: 'try', value: 'filtre kahve', evidenceIds: ['e1'], evidenceExcerpts: ['filtre kahvesi iyi'], recommendation: 'recommend', lastVerifiedAt: '2026-09-10T10:00:00Z', expiresAt: '2026-12-10T10:00:00Z' },
    { claimId: 'c2', sourcePostId: 'p2', mentionId: 'm1', key: 'reservation', value: 'önerilir', evidenceIds: ['e2'], evidenceExcerpts: ['rezervasyon yapın'], recommendation: 'recommend', lastVerifiedAt: '2026-09-12T10:00:00Z', expiresAt: null },
  ],
};
const usage = { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0 };

describe('validateSummary', () => {
  it('kanıt/tarih tutarlı madde geçer; superlative ve uydurma tarih reddedilir', () => {
    const ok: SummaryOutput = { venue_id: 'v1', locale: 'tr', items: [{ claim_type: 'try', text: 'Kaynaklar filtre kahveyi öneriyor.', evidence_ids: ['e1'], source_post_ids: ['p1'], last_verified_at: '2026-09-10T10:00:00Z', expires_at: '2026-12-10T10:00:00Z' }] };
    expect(validateSummary(ok, input).ok).toBe(true);
    const merged: SummaryOutput = { venue_id: 'v1', locale: 'tr', items: [{ claim_type: 'uncertainty', text: 'İki kaynak farklı şeyler söylüyor.', evidence_ids: ['e1', 'e2'], source_post_ids: ['p1', 'p2'], last_verified_at: '2026-09-10T10:00:00Z', expires_at: '2026-12-10T10:00:00Z' }] };
    expect(validateSummary(merged, input).ok).toBe(true); // en eski doğrulama + en erken bitiş
    const bad: SummaryOutput = { venue_id: 'v1', locale: 'tr', items: [{ claim_type: 'try', text: 'En iyi kahve burada.', evidence_ids: ['e9'], source_post_ids: ['p1'], last_verified_at: '2026-09-13T00:00:00Z', expires_at: null }] };
    const r = validateSummary(bad, input);
    expect(r.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['unknown_evidence_id', 'superlative']));
  });
});

describe('PlaceSummarizer', () => {
  it('claim yoksa model çağrılmadan boş özet', async () => {
    let called = 0;
    const s = new PlaceSummarizer({ invoke: async () => { called += 1; return { parsed: null, usage, stopReason: 'end_turn', modelId: 'claude-opus-5' }; } });
    const r = await s.summarize({ ...input, approvedClaims: [] });
    expect(r.status).toBe('ok');
    expect(called).toBe(0);
  });
  it('geçersiz → tek onarım → geçerli', async () => {
    let calls = 0;
    const good: SummaryOutput = { venue_id: 'v1', locale: 'tr', items: [{ claim_type: 'try', text: 'Filtre kahve öneriliyor.', evidence_ids: ['e1'], source_post_ids: ['p1'], last_verified_at: '2026-09-10T10:00:00Z', expires_at: '2026-12-10T10:00:00Z' }] };
    const s = new PlaceSummarizer({ invoke: async () => { calls += 1; return { parsed: calls === 1 ? { ...good, venue_id: 'other' } : good, usage, stopReason: 'end_turn', modelId: 'claude-opus-5' }; } });
    const r = await s.summarize(input);
    expect(r.status).toBe('ok');
    expect(calls).toBe(2);
  });
});
