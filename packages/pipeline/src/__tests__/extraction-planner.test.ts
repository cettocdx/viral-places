import { describe, expect, it } from 'vitest';
import { planExtraction, type Budget } from '../extraction-planner';
import type { NormalizedPost } from '../normalize';

const now = '2026-09-12T09:00:00.000Z';
const post: NormalizedPost = {
  schemaVersion: '1.0', dataMode: 'synthetic', provider: 'fixture', providerRunId: 'r', platform: 'tiktok', platformPostId: '1', platformCreatorId: 'c', handle: 'h',
  canonicalUrl: 'https://www.tiktok.com/@h/video/1', publishedAt: now, observedAt: now, caption: 'x', language: 'tr',
  metrics: { views: 1, likes: null, comments: null, shares: null, saves: null }, availability: 'available', sponsoredStatus: 'unknown',
  mediaCapabilities: { downloadUrlPresent: true, durationMs: 90_000 }, uploadCountryHint: null, contentHash: 'a'.repeat(64), rightsPolicyId: 'p',
};
const budget: Budget = { dailyHardLimitUsd: 10, spentTodayUsd: 1, reservedUsd: 0.5, perJobMaxUsd: 0.5 };
const price = { metadataOnlyPerPost: 0.01, videoPerMinute: 0.1 };
const approved = { policyId: 'p', policyVersion: '1.0', approvedBy: 'legal-demo', approvedAt: now, expiresAt: null, revokedAt: null };
const rightsMeta = { ...approved, permissions: { may_send_metadata_to_ai: true } };
const rightsMedia = { ...approved, permissions: { may_send_metadata_to_ai: true, may_send_media_to_ai: true, may_download_media: true } };

describe('planExtraction', () => {
  it('hak yoksa iş yok', () => {
    expect(planExtraction({ post, rights: null, nowIso: now, alreadyExtractedHash: null, budget, priceUsd: price })).toMatchObject({ kind: 'skip', code: 'rights_denied' });
  });
  it('yalnız metadata hakkı → metadata_only', () => {
    const r = planExtraction({ post, rights: rightsMeta, nowIso: now, alreadyExtractedHash: null, budget, priceUsd: price });
    expect(r).toMatchObject({ kind: 'run', plan: { analysisMode: 'metadata_only', inputs: { caption: true, media: false }, estimatedCostUsd: 0.01 } });
  });
  it('medya hakkı + indirme + süre → native_video, dakika bazlı maliyet', () => {
    const r = planExtraction({ post, rights: rightsMedia, nowIso: now, alreadyExtractedHash: null, budget, priceUsd: price });
    expect(r).toMatchObject({ kind: 'run', plan: { analysisMode: 'native_video', estimatedCostUsd: 0.15 } });
  });
  it('bütçe bilinmiyorsa ücretli iş planlanmaz; limit aşımı reddedilir; aynı hash tekrar çalışmaz', () => {
    expect(planExtraction({ post, rights: rightsMedia, nowIso: now, alreadyExtractedHash: null, budget: { ...budget, dailyHardLimitUsd: null }, priceUsd: price })).toMatchObject({ kind: 'skip', code: 'budget_unset' });
    expect(planExtraction({ post, rights: rightsMedia, nowIso: now, alreadyExtractedHash: null, budget: { ...budget, spentTodayUsd: 9.9 }, priceUsd: price })).toMatchObject({ kind: 'skip', code: 'budget_exceeded' });
    expect(planExtraction({ post, rights: rightsMedia, nowIso: now, alreadyExtractedHash: post.contentHash, budget, priceUsd: price })).toMatchObject({ kind: 'skip', code: 'already_extracted' });
  });
});
