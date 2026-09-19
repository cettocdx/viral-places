/** venue.refresh (§17 skor, §14.2 gösterim modu, §15.4 özet) ve cohorts.build (§17.4 günlük normalizasyon). Skor saf koddan; admin elle yükseltemez. */
import { PlaceSummarizer, ageBucketOf, bestVelocity, buildCohortTable, scoreVenue, type ApprovedClaim, type CohortTable } from '@viral-places/pipeline';
import { decideRender } from '@viral-places/policy';
import type { TrendConfig } from '@viral-places/scoring';
import { reconcile, reserve } from '../budget-gate.ts';
import { env } from '../env.ts';
import { RETRY, type Ctx, type Handler } from './types.ts';

export function trendConfig(ctx: Ctx): TrendConfig {
  const t = ctx.policy.trend;
  return { version: 'viral_score_v1-proposal', windowDays: t.windowDays, weights: t.weights, creatorDiversitySaturation: t.creatorDiversitySaturation, freshnessDecayHours: t.freshnessDecayHours, minimumIndependentCreators: t.minimumIndependentCreators, minimumPosts: t.minimumPosts, minimumMomentumCoverage: t.minimumMomentumCoverage, minimumNormalizationObservations: t.minimumNormalizationObservations, freshObservationAgeHoursExclusive: t.freshObservationAgeHoursExclusive, trendingBadge: t.trendingBadge };
}

export function scopeKeys(platform: string, bucket: string, cityId: string | null, category: string | null): string[] {
  const keys: string[] = [];
  if (cityId && category) keys.push(`${platform}:${bucket}:${cityId}/${category}`);
  if (category) keys.push(`${platform}:${bucket}:global/${category}`);
  keys.push(`${platform}:${bucket}:global`);
  return keys;
}

export const venueRefresh: Handler = async (ctx, job) => {
  const venueId = String(job.payload.venueId ?? '');
  const venue = await ctx.db.venue(venueId);
  if (!venue) return { ok: false, code: 'venue_not_found', retryAfterSeconds: RETRY.none };
  const nowIso = ctx.now();
  const cfg = trendConfig(ctx);
  const windowStart = new Date(Date.parse(nowIso) - cfg.windowDays * 86_400_000).toISOString();

  // 1) Skor
  const posts = await ctx.db.loadVenueScoringPosts(venueId, windowStart, nowIso);
  const today = nowIso.slice(0, 10);
  let cohorts = await ctx.db.loadCohorts(today);
  if (cohorts.size === 0) cohorts = await ctx.db.loadCohorts(new Date(Date.parse(nowIso) - 86_400_000).toISOString().slice(0, 10));
  const cohortFor = (platform: 'tiktok' | 'instagram', bucket: string): CohortTable | null => {
    for (const k of scopeKeys(platform, bucket, venue.cityId, venue.category)) {
      const t = cohorts.get(k);
      if (t) return t;
    }
    return null;
  };
  const lastObs = posts.flatMap((p) => p.snapshots.map((s) => s.observedAt)).sort().at(-1) ?? null;
  const score = scoreVenue({ venueId, asOf: nowIso, posts, cohortFor, config: cfg, lastSuccessfulObservationAt: lastObs });
  await ctx.db.writeVenueScore(score, lastObs);

  // 2) Kaynak projeksiyonu (§14.2): gösterim modu policy'den; hak yoksa link_only/unavailable; thumbnail yalnız may_store_thumbnail
  const links = await ctx.db.loadApprovedLinks(venueId);
  const sources = [] as Parameters<typeof ctx.db.replaceVenueSources>[1];
  const claims: ApprovedClaim[] = [];
  let humanApproved = false;
  for (const [i, l] of links.entries()) {
    const rights = await ctx.db.getRights(l.rightsPolicyId);
    const render = decideRender(l.postId, rights, nowIso);
    const mayThumb = rights ? render.allowedActions.includes('may_store_thumbnail') : false;
    sources.push({ postId: l.postId, creatorId: l.creatorId, platform: l.platform, publishedAt: l.publishedAt, observedAt: l.observedAt, views: l.views, likes: l.likes, sponsoredStatus: l.sponsoredStatus, stance: l.stance, renderMode: render.renderMode, sourceUrl: render.allowedActions.includes('may_show_source_link') ? l.canonicalUrl : null, thumbnailUrl: mayThumb ? l.thumbnailUrl : null, rightsPolicyId: l.rightsPolicyId ?? 'deny-by-default', rightsExpiresAt: render.expiresAt, rank: i });
    if (l.decidedBy) humanApproved = true;
    if (rights && render.allowedActions.includes('may_create_derived_summary') && l.recommendation !== 'avoid') {
      for (const [ci, c] of l.claims.entries()) {
        if (c.evidenceIds.length === 0) continue;
        claims.push({ claimId: `${l.postId}:${l.mentionId}:${ci}`, sourcePostId: l.postId, mentionId: l.mentionId, key: c.key, value: c.value, evidenceIds: c.evidenceIds.map((e) => `${l.postId}:${e}`), evidenceExcerpts: l.evidence.filter((e) => c.evidenceIds.includes(e.id)).map((e) => e.excerpt ?? ''), recommendation: l.recommendation, lastVerifiedAt: l.extractedAt, expiresAt: render.expiresAt });
      }
    }
  }
  await ctx.db.replaceVenueSources(venueId, sources);

  // 3) Kaynaklı özet (yalnız izinli claim'ler; model yoksa atlanır ve önceki özet kalır)
  let summaryNote = 'summary_skipped';
  if (claims.length > 0 && (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) && ctx.dataMode === 'live') {
    const res = await reserve(ctx, { id: `summary-${job.id}`, jobKind: 'ai.summarize', estimatedUsd: 0.03, newPosts: 0, videoMinutes: 0, outboxId: job.id });
    if (res.ok) {
      const s = new PlaceSummarizer({ model: env.extractionModel(), effort: 'low' });
      const out = await s.summarize({ venueId, venueName: venue.ownName, locale: 'tr', approvedClaims: claims.slice(0, 40) });
      await reconcile(ctx, res.reservationId, out.run.estimatedCostUsd, { kind: 'ai.summarize', provider: 'anthropic', unitKind: 'tokens', units: out.run.usage.inputTokens + out.run.usage.outputTokens, ref: { venueId, modelId: out.run.modelId } });
      if (out.status === 'ok') {
        const items = out.summary.items.map((it) => ({ claimType: it.claim_type, text: it.text, evidenceIds: it.evidence_ids, sourcePostIds: it.source_post_ids, lastVerifiedAt: it.last_verified_at, expiresAt: it.expires_at }));
        const expires = items.map((i) => i.expiresAt).filter((x): x is string => !!x).sort()[0] ?? null;
        await ctx.db.writeVenueSummary(venueId, 'tr', items, `${out.run.promptVersion}:${out.run.inputHash.slice(0, 12)}`, out.run.modelId, nowIso, expires);
        summaryNote = `summary_items=${items.length}`;
      } else summaryNote = `summary_${out.status}`;
    } else summaryNote = `summary_budget:${res.code}`;
  }

  // 4) Yayın kapısı: insan onaylı bağlantı + geçerli konum → published; auto-publish yalnız policy izin veriyorsa
  let publishNote = 'status_unchanged';
  if (links.length > 0 && (humanApproved || ctx.policy.features.autoPublish) && (venue.status === 'draft' || venue.status === 'review_required')) {
    if (await ctx.db.venueHasValidLocation(venueId)) {
      await ctx.db.setVenueStatus(venueId, 'published');
      await ctx.db.audit('venue.published', { venueId }, { humanApproved, autoPublish: ctx.policy.features.autoPublish }, null, job.id);
      publishNote = 'published';
    } else publishNote = 'no_valid_location';
  } else if (links.length === 0 && venue.status === 'published' && ctx.dataMode === 'live') {
    await ctx.db.setVenueStatus(venueId, 'hidden');
    publishNote = 'hidden_no_sources';
  }
  return { ok: true, note: `score=${score.score ?? 'null'}/${score.status} sources=${sources.length} ${summaryNote} ${publishNote}` };
};

export const cohortsBuild: Handler = async (ctx) => {
  const cfg = trendConfig(ctx);
  const nowIso = ctx.now();
  const dateKey = nowIso.slice(0, 10);
  const windowStart = new Date(Date.parse(nowIso) - 14 * 86_400_000).toISOString();
  const samples = await ctx.db.loadVelocitySamples(windowStart);
  const groups = new Map<string, number[]>();
  for (const s of samples) {
    const v = bestVelocity(s.snapshots, cfg);
    if ('invalid' in v) continue;
    const bucket = ageBucketOf((Date.parse(nowIso) - Date.parse(s.publishedAt)) / 3_600_000);
    for (const k of scopeKeys(s.platform, bucket, s.cityId, s.category)) groups.set(k, [...(groups.get(k) ?? []), v.viewsPerHour]);
  }
  let built = 0;
  let skipped = 0;
  for (const [scope, vel] of groups) {
    const t = buildCohortTable(scope, dateKey, vel, cfg.minimumNormalizationObservations);
    if (!t) {
      skipped += 1;
      continue;
    }
    await ctx.db.upsertCohort(t);
    built += 1;
  }
  return { ok: true, note: `samples=${samples.length} built=${built} skipped_small=${skipped}` };
};
