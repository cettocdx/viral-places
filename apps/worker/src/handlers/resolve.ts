/** mention.resolve (§16): kendi kayıtlar → gerekirse sınırlı Places araması (cache-first) → deterministik eşleştirme → auto/review/unresolved. */
import { GooglePlacesClient, candidateFromCache, categoryFromTypes, resolveMention, type MatchConfig, type MentionInput, type VenueCandidate } from '@viral-places/pipeline';
import { reconcile, reserve } from '../budget-gate.ts';
import { env } from '../env.ts';
import { RETRY, type Ctx, type Handler } from './types.ts';

function matchConfig(ctx: Ctx): MatchConfig {
  const m = ctx.policy.matching;
  return { autoMinScore: m.proposalMinEvidenceScore, autoMinTopTwoGap: m.proposalMinTopTwoGap, reviewMinScore: 0.8, minEvidenceKinds: m.minEvidenceKinds, requireGeographicEvidence: m.requireGeographicEvidence, autoPublishEnabled: m.autoPublishEnabled && ctx.policy.features.autoPublish };
}

/** Konum hiyerarşisi (§16.1): açık yer etiketi > mention'daki şehir/mahalle > creator bağlamı. uploadCountryHint asla koordinat değildir. */
function hintsOf(m: { cityHint: string | null; addressHint: string | null; branchHint: string | null; locationTag: { name: string; lat: number | null; lng: number | null } | null }): { cityHint: string | null; areaHint: string | null; bias: { lat: number; lng: number; radiusMeters: number } | null } {
  const tagParts = m.locationTag?.name.split(',').map((s) => s.trim()) ?? [];
  const cityHint = m.cityHint ?? (tagParts.length >= 2 ? tagParts[tagParts.length - 1]! : null);
  const areaHint = m.addressHint ?? m.branchHint ?? (tagParts.length >= 1 ? tagParts[0]! : null);
  const bias = m.locationTag?.lat != null && m.locationTag.lng != null ? { lat: m.locationTag.lat, lng: m.locationTag.lng, radiusMeters: 1500 } : null;
  return { cityHint, areaHint, bias };
}

async function ensureVenueForCandidate(ctx: Ctx, cand: VenueCandidate, cacheHit: { placeId: string; lat: number | null; lng: number | null; expiresAt: string; city: string | null; neighborhood: string | null; types: string[]; name: string } | null, cityHint: string | null): Promise<string | null> {
  if (!cand.venueId.startsWith('google:')) return cand.venueId;
  const placeId = cand.venueId.slice('google:'.length);
  const existing = await ctx.db.venueByPlaceId(placeId);
  if (existing) return existing;
  const city = (cacheHit?.city ? await ctx.db.cityByName(cacheHit.city) : null) ?? (cityHint ? await ctx.db.cityByName(cityHint) : null);
  if (!city) return null; // kapsam dışı şehir: mekan yaratılmaz (§12.4 kapsam matrisi)
  const venueId = await ctx.db.createDraftVenue({ ownName: cacheHit?.name ?? cand.name, cityId: city.id, neighborhood: cacheHit?.neighborhood ?? cand.neighborhood, category: categoryFromTypes(cacheHit?.types ?? []) });
  await ctx.db.upsertExternalId(venueId, placeId);
  if (cacheHit?.lat != null && cacheHit.lng != null) await ctx.db.upsertGoogleVenueLocation(venueId, cacheHit.lat, cacheHit.lng, placeId, cacheHit.expiresAt);
  return venueId;
}

export const mentionResolve: Handler = async (ctx, job) => {
  const mentionId = String(job.payload.mentionId ?? '');
  const m = await ctx.db.getMention(mentionId);
  if (!m) return { ok: false, code: 'mention_not_found', retryAfterSeconds: RETRY.none };
  if (m.resolutionStatus === 'approved' || m.resolutionStatus === 'rejected') return { ok: true, note: 'already_decided' };
  const version = ctx.policy.matching.version;
  if (!m.rawPlaceName) {
    await ctx.db.updateMentionResolution(mentionId, { status: 'unresolved', venueId: null, candidatePlaceId: null, resolution: { reasons: ['no_place_name'] }, resolverVersion: version });
    return { ok: true, note: 'no_place_name' };
  }
  const { cityHint, areaHint, bias } = hintsOf(m);
  const input: MentionInput = { rawPlaceName: m.rawPlaceName, cityHint, neighborhoodOrAddressHint: areaHint, categoryCandidates: m.categoryCandidates, evidenceKinds: m.locationTag ? Array.from(new Set([...m.evidenceKinds, 'creator_supplied'])) : m.evidenceKinds };

  let candidates: VenueCandidate[] = await ctx.db.findOwnVenueCandidates(cityHint, m.rawPlaceName);
  const cacheById = new Map<string, Awaited<ReturnType<typeof ctx.db.placesCacheByQuery>>[number]>();
  const queryText = [m.rawPlaceName, areaHint, cityHint].filter(Boolean).join(' ');
  if ((cityHint || areaHint || bias) && ctx.dataMode === 'live') {
    let entries = await ctx.db.placesCacheByQuery(queryText);
    if (entries.length === 0 && env.googlePlacesKey()) {
      const price = env.pricePlacesPer1k();
      if (price !== null) {
        const res = await reserve(ctx, { id: `places-${job.id}`, jobKind: 'places.search', estimatedUsd: price / 1000, newPosts: 0, videoMinutes: 0, outboxId: job.id });
        if (res.ok) {
          const client = new GooglePlacesClient({ apiKey: env.googlePlacesKey()!, usdPer1kRequests: price, now: ctx.now });
          const r = await client.searchText({ name: m.rawPlaceName, cityHint, areaHint, languageCode: 'tr', ...(m.uploadCountryHint ? { regionCode: m.uploadCountryHint.toLowerCase() } : {}), locationBias: bias });
          if (r.ok) {
            await ctx.db.placesCacheUpsert(r.entries);
            entries = r.entries;
            await reconcile(ctx, res.reservationId, r.requestCostUsd, { kind: 'provider.places', provider: 'google_places', unitKind: 'request', units: 1, ref: { mentionId, query: queryText } });
          } else {
            await reconcile(ctx, res.reservationId, null, { kind: 'provider.places_failed', provider: 'google_places', unitKind: 'request', units: 0, ref: { mentionId, code: r.code } });
            if (r.code === 'places_rate_limited') return { ok: false, code: r.code, retryAfterSeconds: RETRY.provider };
          }
        }
      } else {
        ctx.log('warn', 'places_price_unknown', { mentionId });
      }
    }
    for (const e of entries) {
      cacheById.set(`google:${e.placeId}`, e);
      if (!candidates.some((c) => c.venueId === `google:${e.placeId}`)) candidates.push(candidateFromCache(e));
    }
  }
  const resolution = resolveMention(input, candidates, matchConfig(ctx));
  if (resolution.status === 'unresolved') {
    await ctx.db.updateMentionResolution(mentionId, { status: 'unresolved', venueId: null, candidatePlaceId: null, resolution: { ...resolution, candidates: candidates.length }, resolverVersion: version });
    return { ok: true, note: `unresolved:${resolution.reasons.join(',')}` };
  }
  const top = candidates.find((c) => c.venueId === resolution.venueId)!;
  const cacheHit = cacheById.get(top.venueId) ?? null;
  const venueId = await ensureVenueForCandidate(ctx, top, cacheHit, cityHint);
  if (!venueId) {
    await ctx.db.updateMentionResolution(mentionId, { status: 'unresolved', venueId: null, candidatePlaceId: cacheHit?.placeId ?? null, resolution: { ...resolution, reasons: ['city_out_of_coverage'] }, resolverVersion: version });
    return { ok: true, note: 'city_out_of_coverage' };
  }
  if (resolution.status === 'auto_match') {
    await ctx.db.updateMentionResolution(mentionId, { status: 'auto_match', venueId, candidatePlaceId: cacheHit?.placeId ?? null, resolution, resolverVersion: version });
    await ctx.db.upsertVenuePostLink(venueId, m.postId, m.mentionId, m.recommendation, 'approved', version);
    await ctx.db.audit('mention.auto_match', { mentionId, venueId }, resolution, null, job.id);
    await ctx.db.enqueue('venue.refresh', { venueId, reason: 'auto_match' }, `venue.refresh:${venueId}:${mentionId}`, job.id);
    return { ok: true, note: `auto_match:${venueId}` };
  }
  await ctx.db.updateMentionResolution(mentionId, { status: 'review_required', venueId, candidatePlaceId: cacheHit?.placeId ?? null, resolution, resolverVersion: version });
  await ctx.db.upsertVenuePostLink(venueId, m.postId, m.mentionId, m.recommendation, 'review_required', version);
  const taskId = await ctx.db.createReviewTask('mention_resolution', { mentionId, postId: m.postId, venueId, score: resolution.score, reasons: resolution.reasons, rawPlaceName: m.rawPlaceName, cityHint, areaHint, topCandidates: candidates.slice(0, 3).map((c) => ({ venueId: c.venueId, name: c.name, city: c.city })) }, Math.round((resolution.score ?? 0) * 100));
  return { ok: true, note: `review_required:${taskId}` };
};
