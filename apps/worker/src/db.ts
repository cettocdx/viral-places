/**
 * Worker DB katmanı (postgres.js, doğrudan bağlantı; service yetkisi). Tüm private/geo erişimi buradan geçer.
 * Sayaçlar bigint → number (2^53 altı beklenir; aşan değer null'a düşer ve quality_flags'e yazılır).
 */
import postgres from 'postgres';
import type { RightsRecord } from '@viral-places/policy';
import type { NormalizedPost, VenueCandidate, PlacesCacheEntry, CohortTable, ScoringPost, VenueScoreOutput, PlaceMention } from '@viral-places/pipeline';

export type Sql = ReturnType<typeof postgres>;

export interface JobRow {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  attempt_count: number;
  correlation_id: string | null;
  idempotency_key: string;
}

export interface MonitoringRow {
  account_id: string;
  creator_id: string;
  platform: 'tiktok' | 'instagram';
  platform_user_id: string;
  handle: string;
  enabled: boolean;
  next_poll_at: string | null;
  lease_until: string | null;
  watermark: { newestPublishedAt: string | null; seenIds: string[] };
  rights_policy_id: string | null;
  provider: string;
  consecutive_failures: number;
  posts_last_30d: number;
  last_polled_at: string | null;
}

export interface PostRow {
  id: string;
  account_id: string;
  creator_id: string;
  platform: 'tiktok' | 'instagram';
  platform_post_id: string;
  canonical_url: string;
  published_at: string;
  observed_at: string;
  caption: string | null;
  language: string | null;
  content_hash: string | null;
  sponsored_status: 'declared' | 'none_declared' | 'unknown';
  rights_policy_id: string | null;
  availability: string;
  hashtags: string[];
  location_tag: { name: string; platformLocationId: string | null; lat: number | null; lng: number | null } | null;
  thumbnail_url: string | null;
  media_duration_ms: number | null;
  download_url_present: boolean;
  last_extracted_hash: string | null;
  handle: string;
  provider: string | null;
  city_hint_from_creator: string | null;
}

const toIso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? new Date(v).toISOString() : null);
const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'bigint' ? Number(v) : Number(v);
  return Number.isSafeInteger(n) || Number.isFinite(n) ? n : null;
};

export class Db {
  readonly sql: Sql;
  constructor(url: string) {
    this.sql = postgres(url, { max: 4, idle_timeout: 30, types: { bigint: postgres.BigInt } });
  }
  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }

  // ---------- iş kuyruğu ----------
  async claimJobs(limit: number, leaseSeconds: number, kinds: string[] | null): Promise<JobRow[]> {
    const rows = await this.sql`select * from public.claim_outbox_jobs(${limit}, ${leaseSeconds}, ${kinds})`;
    return rows.map((r) => ({ id: r.id as string, kind: r.kind as string, payload: (r.payload ?? {}) as Record<string, unknown>, attempt_count: Number(r.attempt_count), correlation_id: (r.correlation_id as string | null) ?? null, idempotency_key: r.idempotency_key as string }));
  }
  async finishJob(id: string, ok: boolean, opts: { errorCode?: string; errorDetail?: string; retryAfterSeconds?: number | null; maxAttempts?: number } = {}): Promise<void> {
    await this.sql`select public.finish_outbox_job(${id}, ${ok}, ${opts.errorCode ?? null}, ${opts.errorDetail ?? null}, ${opts.retryAfterSeconds ?? null}, ${opts.maxAttempts ?? 4})`;
  }
  async enqueue(kind: string, payload: Record<string, unknown>, idempotencyKey: string, correlationId: string | null = null, runAfter: string | null = null): Promise<{ jobId: string; inserted: boolean }> {
    const [r] = await this.sql`select * from public.enqueue_job(${kind}, ${this.sql.json(payload as never)}, ${idempotencyKey}, ${correlationId}, ${runAfter ?? this.sql`now()`})`;
    return { jobId: r!.job_id as string, inserted: r!.inserted as boolean };
  }

  // ---------- izleme / haklar ----------
  async listMonitoring(): Promise<MonitoringRow[]> {
    const rows = await this.sql`
      select m.account_id, a.creator_id, a.platform, a.platform_user_id, a.handle, m.enabled, m.next_poll_at, m.lease_until, m.watermark, m.rights_policy_id, m.provider, m.consecutive_failures, m.posts_last_30d, m.last_polled_at
      from private.creator_monitoring m join public.creator_accounts a on a.id = m.account_id`;
    return rows.map((r) => ({ ...r, next_poll_at: toIso(r.next_poll_at), lease_until: toIso(r.lease_until), last_polled_at: toIso(r.last_polled_at), watermark: { newestPublishedAt: (r.watermark?.newestPublishedAt as string | undefined) ?? null, seenIds: (r.watermark?.seenIds as string[] | undefined) ?? [] }, consecutive_failures: Number(r.consecutive_failures), posts_last_30d: Number(r.posts_last_30d) }) as MonitoringRow);
  }
  async leaseMonitoring(accountId: string, leaseUntil: string): Promise<boolean> {
    const rows = await this.sql`update private.creator_monitoring set lease_until = ${leaseUntil} where account_id = ${accountId} and (lease_until is null or lease_until < now()) returning account_id`;
    return rows.length === 1;
  }
  async updateMonitoringAfterPoll(accountId: string, u: { watermark?: MonitoringRow['watermark']; nextPollAt: string | null; postsLast30d?: number; consecutiveFailures: number; lastErrorCode: string | null; disabledReason?: string | null }): Promise<void> {
    await this.sql`update private.creator_monitoring set
      watermark = coalesce(${u.watermark ? this.sql.json(u.watermark as never) : null}, watermark),
      next_poll_at = ${u.nextPollAt}, lease_until = null, last_polled_at = now(),
      posts_last_30d = coalesce(${u.postsLast30d ?? null}, posts_last_30d),
      consecutive_failures = ${u.consecutiveFailures}, last_error_code = ${u.lastErrorCode},
      enabled = case when ${u.disabledReason ?? null}::text is null then enabled else false end,
      disabled_reason = ${u.disabledReason ?? null}
      where account_id = ${accountId}`;
  }
  async getRights(policyId: string | null): Promise<RightsRecord | null> {
    if (!policyId) return null;
    const [r] = await this.sql`select * from private.rights_policies where id = ${policyId}`;
    if (!r) return null;
    return { policyId: r.id as string, policyVersion: r.policy_version as string, approvedBy: (r.approved_by as string | null) ?? null, approvedAt: toIso(r.approved_at), expiresAt: toIso(r.expires_at), revokedAt: toIso(r.revoked_at), permissions: (r.permissions ?? {}) as RightsRecord['permissions'] };
  }
  async findAccountByPlatformId(platform: string, platformUserId: string): Promise<{ id: string; creator_id: string; handle: string } | null> {
    const [r] = await this.sql`select id, creator_id, handle from public.creator_accounts where platform = ${platform}::public.social_platform and platform_user_id = ${platformUserId}`;
    return r ? { id: r.id as string, creator_id: r.creator_id as string, handle: r.handle as string } : null;
  }

  // ---------- sağlayıcı koşuları / gönderiler / metrikler ----------
  async createProviderRun(p: { provider: string; runId: string; platform: 'tiktok' | 'instagram' | null; accountId: string | null; status: string; costMicroUsd: number | null; stats?: { seen: number; new: number; edited: number; rejected: number; coverageGap: boolean }; errorCode?: string | null; correlationId?: string | null }): Promise<string> {
    const [r] = await this.sql`insert into private.provider_runs (provider, run_id, platform, account_id, status, cost_micro_usd, posts_seen, posts_new, posts_edited, posts_rejected, coverage_gap, error_code, correlation_id, finished_at)
      values (${p.provider}, ${p.runId}, ${p.platform}, ${p.accountId}, ${p.status}, ${p.costMicroUsd}, ${p.stats?.seen ?? null}, ${p.stats?.new ?? null}, ${p.stats?.edited ?? null}, ${p.stats?.rejected ?? null}, ${p.stats?.coverageGap ?? null}, ${p.errorCode ?? null}, ${p.correlationId ?? null}, now())
      on conflict (provider, run_id) do update set status = excluded.status, cost_micro_usd = coalesce(excluded.cost_micro_usd, private.provider_runs.cost_micro_usd), posts_seen = excluded.posts_seen, posts_new = excluded.posts_new, posts_edited = excluded.posts_edited, posts_rejected = excluded.posts_rejected, coverage_gap = excluded.coverage_gap, error_code = excluded.error_code, finished_at = now()
      returning id`;
    return r!.id as string;
  }
  async getKnownPost(platform: string, platformPostId: string): Promise<{ id: string; contentHash: string | null; lastExtractedHash: string | null } | null> {
    const [r] = await this.sql`select id, content_hash, last_extracted_hash from private.source_posts where platform = ${platform}::public.social_platform and platform_post_id = ${platformPostId}`;
    return r ? { id: r.id as string, contentHash: (r.content_hash as string | null) ?? null, lastExtractedHash: (r.last_extracted_hash as string | null) ?? null } : null;
  }
  /** unique(platform, platform_post_id): yeni gözlem yeni post değil, yeni metrik snapshot'ıdır (§13.4). */
  async upsertPost(accountId: string, post: NormalizedPost, providerRunUuid: string | null): Promise<string> {
    const [r] = await this.sql`insert into private.source_posts (account_id, platform, platform_post_id, canonical_url, published_at, observed_at, status, content_hash, caption, language, sponsored_status, rights_policy_id, provider_run_id, schema_version, provider, availability, hashtags, location_tag, thumbnail_url, platform_shortcode, upload_country_hint, media_duration_ms, download_url_present)
      values (${accountId}, ${post.platform}::public.social_platform, ${post.platformPostId}, ${post.canonicalUrl}, ${post.publishedAt}, ${post.observedAt}, 'discovered', ${post.contentHash}, ${post.caption}, ${post.language}, ${post.sponsoredStatus}, ${post.rightsPolicyId}, ${providerRunUuid}, ${post.schemaVersion}, ${post.provider}, ${post.availability}, ${post.hashtags ?? []}, ${post.locationTag ? this.sql.json(post.locationTag as never) : null}, ${post.thumbnailUrl ?? null}, ${post.platformShortcode ?? null}, ${post.uploadCountryHint}, ${post.mediaCapabilities.durationMs}, ${post.mediaCapabilities.downloadUrlPresent})
      on conflict (platform, platform_post_id) do update set
        observed_at = excluded.observed_at, content_hash = excluded.content_hash, caption = excluded.caption, language = coalesce(excluded.language, private.source_posts.language),
        sponsored_status = case when excluded.sponsored_status = 'unknown' then private.source_posts.sponsored_status else excluded.sponsored_status end,
        availability = excluded.availability, hashtags = excluded.hashtags, location_tag = coalesce(excluded.location_tag, private.source_posts.location_tag),
        thumbnail_url = coalesce(excluded.thumbnail_url, private.source_posts.thumbnail_url), media_duration_ms = coalesce(excluded.media_duration_ms, private.source_posts.media_duration_ms),
        download_url_present = excluded.download_url_present, provider = excluded.provider, provider_run_id = coalesce(excluded.provider_run_id, private.source_posts.provider_run_id)
      returning id`;
    const id = r!.id as string;
    const flags: string[] = [];
    if (post.metrics.views === null) flags.push('views_null');
    await this.sql`insert into private.post_metrics (post_id, provider_run_id, observed_at, views, likes, comments, shares, saves, quality_flags)
      values (${id}, ${providerRunUuid}, ${post.observedAt}, ${post.metrics.views}, ${post.metrics.likes}, ${post.metrics.comments}, ${post.metrics.shares}, ${post.metrics.saves}, ${flags})`;
    return id;
  }
  async insertMetrics(postId: string, providerRunUuid: string | null, observedAt: string, m: { views: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null }): Promise<void> {
    await this.sql`insert into private.post_metrics (post_id, provider_run_id, observed_at, views, likes, comments, shares, saves) values (${postId}, ${providerRunUuid}, ${observedAt}, ${m.views}, ${m.likes}, ${m.comments}, ${m.shares}, ${m.saves})`;
  }
  async setPostAvailability(postId: string, availability: string): Promise<void> {
    await this.sql`update private.source_posts set availability = ${availability}, last_availability_check_at = now() where id = ${postId}`;
  }
  async getPost(postId: string): Promise<PostRow | null> {
    const [r] = await this.sql`select p.*, a.handle, a.creator_id, null::text as city_hint_from_creator from private.source_posts p join public.creator_accounts a on a.id = p.account_id where p.id = ${postId}`;
    if (!r) return null;
    return { ...r, published_at: toIso(r.published_at)!, observed_at: toIso(r.observed_at)!, hashtags: (r.hashtags as string[]) ?? [], media_duration_ms: toNum(r.media_duration_ms), location_tag: (r.location_tag as PostRow['location_tag']) ?? null } as PostRow;
  }
  async postsForAccountInWindow(accountId: string, windowStart: string): Promise<Array<{ id: string; platform_post_id: string; canonical_url: string; platform: 'tiktok' | 'instagram'; published_at: string; last_observed_at: string | null }>> {
    const rows = await this.sql`select p.id, p.platform_post_id, p.canonical_url, p.platform, p.published_at, (select max(observed_at) from private.post_metrics m where m.post_id = p.id) as last_observed_at
      from private.source_posts p where p.account_id = ${accountId} and p.published_at >= ${windowStart} and p.availability = 'available'`;
    return rows.map((r) => ({ ...r, published_at: toIso(r.published_at)!, last_observed_at: toIso(r.last_observed_at) }) as never);
  }
  async countPostsLast30d(accountId: string): Promise<number> {
    const [r] = await this.sql`select count(*)::int as n from private.source_posts where account_id = ${accountId} and published_at >= now() - interval '30 days'`;
    return Number(r!.n);
  }

  // ---------- çıkarım / mention ----------
  async findExtractionByHash(postId: string, inputHash: string): Promise<{ id: string; status: string } | null> {
    const [r] = await this.sql`select id, status from private.extraction_runs where post_id = ${postId} and input_hash = ${inputHash}`;
    return r ? { id: r.id as string, status: r.status as string } : null;
  }
  async insertExtractionRun(e: { postId: string; promptVersion: string; modelId: string; inputHash: string; analysisMode: string; status: string; skipCode?: string | null; output?: unknown; issues?: unknown; usage?: unknown; estimatedCostMicroUsd?: number | null; attempts?: number; durationMs?: number | null }): Promise<string> {
    const [r] = await this.sql`insert into private.extraction_runs (post_id, prompt_version, model_id, input_hash, analysis_mode, status, skip_code, output, issues, usage, estimated_cost_micro_usd, attempts, duration_ms)
      values (${e.postId}, ${e.promptVersion}, ${e.modelId}, ${e.inputHash}, ${e.analysisMode}, ${e.status}, ${e.skipCode ?? null}, ${e.output === undefined ? null : this.sql.json(e.output as never)}, ${this.sql.json((e.issues ?? []) as never)}, ${this.sql.json((e.usage ?? {}) as never)}, ${e.estimatedCostMicroUsd ?? null}, ${e.attempts ?? 0}, ${e.durationMs ?? null})
      on conflict (post_id, input_hash) do update set status = excluded.status, output = excluded.output, issues = excluded.issues, usage = excluded.usage, attempts = excluded.attempts
      returning id`;
    if (e.status === 'ok') await this.sql`update private.source_posts set last_extracted_hash = ${e.inputHash} where id = ${e.postId}`;
    return r!.id as string;
  }
  async insertMentions(runId: string, postId: string, mentions: PlaceMention[], resolverVersion: string): Promise<string[]> {
    const ids: string[] = [];
    for (const m of mentions) {
      const [r] = await this.sql`insert into private.place_mentions (post_id, extraction_run_id, mention_id, raw_place_name, city_hint, country_hint, address_hint, branch_hint, category_candidates, recommendation, evidence, claims, family_attributes, suggested_items, uncertainty_reasons, resolver_version)
        values (${postId}, ${runId}, ${m.mentionId}, ${m.rawPlaceName}, ${m.cityHint}, ${m.countryHint}, ${m.addressHint}, ${m.branchHint}, ${m.categoryCandidates}, ${m.recommendation}, ${this.sql.json(m.evidence as never)}, ${this.sql.json(m.claims as never)}, ${this.sql.json(m.familyAttributes as never)}, ${this.sql.json(m.suggestedItems as never)}, ${m.uncertaintyReasons}, ${resolverVersion})
        on conflict (extraction_run_id, mention_id) do update set raw_place_name = excluded.raw_place_name returning id`;
      ids.push(r!.id as string);
    }
    return ids;
  }
  async getMention(id: string): Promise<(PlaceMention & { id: string; postId: string; resolutionStatus: string; evidenceKinds: string[]; locationTag: PostRow['location_tag']; platform: 'tiktok' | 'instagram'; uploadCountryHint: string | null }) | null> {
    const [r] = await this.sql`select m.*, p.location_tag, p.platform, p.upload_country_hint from private.place_mentions m join private.source_posts p on p.id = m.post_id where m.id = ${id}`;
    if (!r) return null;
    const evidence = (r.evidence ?? []) as PlaceMention['evidence'];
    return { id: r.id as string, postId: r.post_id as string, mentionId: r.mention_id as string, rawPlaceName: r.raw_place_name as string | null, cityHint: r.city_hint as string | null, countryHint: r.country_hint as string | null, addressHint: r.address_hint as string | null, branchHint: r.branch_hint as string | null, categoryCandidates: (r.category_candidates as string[]) ?? [], recommendation: r.recommendation as PlaceMention['recommendation'], familyAttributes: (r.family_attributes ?? []) as PlaceMention['familyAttributes'], suggestedItems: (r.suggested_items ?? []) as PlaceMention['suggestedItems'], claims: (r.claims ?? []) as PlaceMention['claims'], evidence, uncertaintyReasons: (r.uncertainty_reasons as string[]) ?? [], resolutionStatus: r.resolution_status as string, evidenceKinds: Array.from(new Set(evidence.map((e) => e.kind))), locationTag: (r.location_tag as PostRow['location_tag']) ?? null, platform: r.platform as 'tiktok' | 'instagram', uploadCountryHint: (r.upload_country_hint as string | null) ?? null };
  }
  async updateMentionResolution(id: string, u: { status: string; venueId: string | null; candidatePlaceId: string | null; resolution: unknown; resolverVersion: string }): Promise<void> {
    await this.sql`update private.place_mentions set resolution_status = ${u.status}, resolved_venue_id = ${u.venueId}, candidate_place_id = ${u.candidatePlaceId}, resolution = ${this.sql.json(u.resolution as never)}, resolver_version = ${u.resolverVersion} where id = ${id}`;
  }
  async upsertVenuePostLink(venueId: string, postId: string, mentionId: string, stance: string, status: 'approved' | 'review_required' | 'unresolved' | 'rejected', resolverVersion: string): Promise<void> {
    await this.sql`insert into private.venue_post_links (venue_id, post_id, mention_id, stance, resolution_status, resolver_version) values (${venueId}, ${postId}, ${mentionId}, ${stance}, ${status}, ${resolverVersion})
      on conflict (venue_id, post_id, mention_id) do update set resolution_status = excluded.resolution_status, stance = excluded.stance, resolver_version = excluded.resolver_version`;
  }
  async findOwnVenueCandidates(cityHint: string | null, nameHint: string | null): Promise<VenueCandidate[]> {
    // Kendi kayıtlarımız: alias + ad; şehir ipucu varsa şehir adıyla daraltılır (§16.1 madde 2). LIKE ile geniş aday; puanlama matcher'da.
    const like = nameHint ? `%${nameHint.split(/\s+/)[0]!.toLocaleLowerCase('tr')}%` : '%';
    const rows = await this.sql`select v.id, v.own_name, v.neighborhood, v.primary_category, v.status, c.name as city_name,
        coalesce(array_agg(al.alias) filter (where al.alias is not null), '{}') as aliases
      from public.venues v join public.cities c on c.id = v.city_id left join public.venue_aliases al on al.venue_id = v.id
      where (${cityHint}::text is null or lower(c.name) = lower(${cityHint}))
        and (lower(v.own_name) like ${like} or exists (select 1 from public.venue_aliases a2 where a2.venue_id = v.id and lower(a2.alias) like ${like}))
      group by v.id, c.name limit 25`;
    return rows.map((r) => ({ venueId: r.id as string, name: r.own_name as string, aliases: (r.aliases as string[]) ?? [], city: r.city_name as string, neighborhood: (r.neighborhood as string | null) ?? null, category: r.primary_category as string, status: r.status === 'takedown' ? 'permanently_closed' : 'open' }));
  }
  async placesCacheByQuery(queryText: string): Promise<PlacesCacheEntry[]> {
    const rows = await this.sql`select * from private.google_places_cache where query_text = ${queryText} and expires_at > now()`;
    return rows.map((r) => ({ placeId: r.place_id as string, name: r.name as string, formattedAddress: (r.formatted_address as string | null) ?? null, lat: toNum(r.lat), lng: toNum(r.lng), types: (r.types as string[]) ?? [], businessStatus: (r.business_status as string | null) ?? null, city: (r.city as string | null) ?? null, neighborhood: (r.neighborhood as string | null) ?? null, fetchedAt: toIso(r.fetched_at)!, expiresAt: toIso(r.expires_at)!, queryText: (r.query_text as string) ?? '' }));
  }
  async placesCacheUpsert(entries: PlacesCacheEntry[]): Promise<void> {
    for (const e of entries) {
      await this.sql`insert into private.google_places_cache (place_id, name, formatted_address, lat, lng, types, business_status, city, neighborhood, query_text, fetched_at, expires_at)
        values (${e.placeId}, ${e.name}, ${e.formattedAddress}, ${e.lat}, ${e.lng}, ${e.types}, ${e.businessStatus}, ${e.city}, ${e.neighborhood}, ${e.queryText}, ${e.fetchedAt}, ${e.expiresAt})
        on conflict (place_id) do update set name = excluded.name, formatted_address = excluded.formatted_address, lat = excluded.lat, lng = excluded.lng, types = excluded.types, business_status = excluded.business_status, city = excluded.city, neighborhood = excluded.neighborhood, query_text = excluded.query_text, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at`;
    }
  }
  async createReviewTask(kind: string, subjectRef: Record<string, unknown>, priority: number): Promise<string> {
    const key = subjectRef.mentionId ?? subjectRef.postId ?? null;
    if (key) {
      const [existing] = await this.sql`select id from private.review_tasks where kind = ${kind} and status = 'open' and (subject_ref->>'mentionId' = ${String(key)} or subject_ref->>'postId' = ${String(key)}) limit 1`;
      if (existing) return existing.id as string;
    }
    const [r] = await this.sql`insert into private.review_tasks (kind, subject_ref, priority) values (${kind}, ${this.sql.json(subjectRef as never)}, ${priority}) returning id`;
    return r!.id as string;
  }
  async getTranscript(postId: string): Promise<{ segments: Array<{ startMs: number; endMs: number; text: string }>; language: string | null } | null> {
    const [r] = await this.sql`select segments, language from private.post_transcripts where post_id = ${postId} and (expires_at is null or expires_at > now())`;
    return r ? { segments: (r.segments ?? []) as never, language: (r.language as string | null) ?? null } : null;
  }
  async upsertTranscript(postId: string, t: { source: string; language: string | null; segments: unknown; rightsPolicyId: string | null; expiresAt: string | null }): Promise<void> {
    await this.sql`insert into private.post_transcripts (post_id, source, language, segments, rights_policy_id, expires_at) values (${postId}, ${t.source}, ${t.language}, ${this.sql.json(t.segments as never)}, ${t.rightsPolicyId}, ${t.expiresAt})
      on conflict (post_id) do update set source = excluded.source, language = excluded.language, segments = excluded.segments, rights_policy_id = excluded.rights_policy_id, fetched_at = now(), expires_at = excluded.expires_at`;
  }

  // ---------- bütçe ----------
  async getBudgetDay(day: string): Promise<{ spentUsd: number; newPosts: number; videoMinutes: number; reservations: Array<{ id: string; estimatedUsd: number; leaseUntil: string; reconciledAt: string | null; jobKind: string; reservedAt: string; actualUsd: number | null }> }> {
    await this.sql`insert into private.budget_days (day) values (${day}) on conflict (day) do nothing`;
    const [d] = await this.sql`select * from private.budget_days where day = ${day}`;
    const res = await this.sql`select * from private.budget_reservations where day = ${day}`;
    return { spentUsd: Number(d!.spent_micro_usd) / 1e6, newPosts: Number(d!.new_posts), videoMinutes: Number(d!.video_minutes), reservations: res.map((r) => ({ id: r.id as string, estimatedUsd: Number(r.estimated_micro_usd) / 1e6, leaseUntil: toIso(r.lease_until)!, reconciledAt: toIso(r.reconciled_at), jobKind: r.job_kind as string, reservedAt: toIso(r.reserved_at)!, actualUsd: r.actual_micro_usd === null ? null : Number(r.actual_micro_usd) / 1e6 })) };
  }
  async getBudgetMonthSpentUsd(month: string): Promise<number> {
    const [r] = await this.sql`select coalesce(sum(spent_micro_usd), 0) as s from private.budget_days where to_char(day, 'YYYY-MM') = ${month}`;
    return Number(r!.s) / 1e6;
  }
  async insertReservation(day: string, r: { id: string; jobKind: string; estimatedUsd: number; leaseUntil: string; outboxId: string | null; newPosts: number; videoMinutes: number }): Promise<void> {
    await this.sql`insert into private.budget_reservations (id, day, job_kind, outbox_id, estimated_micro_usd, lease_until) values (${r.id}, ${day}, ${r.jobKind}, ${r.outboxId}, ${Math.round(r.estimatedUsd * 1e6)}, ${r.leaseUntil})`;
    await this.sql`update private.budget_days set new_posts = new_posts + ${r.newPosts}, video_minutes = video_minutes + ${r.videoMinutes} where day = ${day}`;
  }
  async reconcileReservation(id: string, actualUsd: number): Promise<void> {
    const rows = await this.sql`update private.budget_reservations set actual_micro_usd = ${Math.round(actualUsd * 1e6)}, reconciled_at = now() where id = ${id} and reconciled_at is null returning day`;
    if (rows[0]) await this.sql`update private.budget_days set spent_micro_usd = spent_micro_usd + ${Math.round(actualUsd * 1e6)} where day = ${rows[0].day as string}`;
  }
  async expireStaleReservations(): Promise<number> {
    const rows = await this.sql`update private.budget_reservations set reconciled_at = now(), actual_micro_usd = coalesce(actual_micro_usd, 0) where reconciled_at is null and lease_until < now() returning id`;
    return rows.length;
  }
  async insertCostEvent(e: { kind: string; provider: string | null; unitKind: string; units: number; microUsd: number | null; ref: Record<string, unknown> }): Promise<void> {
    await this.sql`insert into private.cost_events (kind, provider, unit_kind, units, micro_usd, ref) values (${e.kind}, ${e.provider}, ${e.unitKind}, ${e.units}, ${e.microUsd}, ${this.sql.json(e.ref as never)})`;
  }

  // ---------- skor / projeksiyon ----------
  async venue(venueId: string): Promise<{ id: string; ownName: string; cityId: string; cityName: string; status: string; category: string; neighborhood: string | null } | null> {
    const [r] = await this.sql`select v.id, v.own_name, v.city_id, c.name as city_name, v.status, v.primary_category, v.neighborhood from public.venues v join public.cities c on c.id = v.city_id where v.id = ${venueId}`;
    return r ? { id: r.id as string, ownName: r.own_name as string, cityId: r.city_id as string, cityName: r.city_name as string, status: r.status as string, category: r.primary_category as string, neighborhood: (r.neighborhood as string | null) ?? null } : null;
  }
  async loadVenueScoringPosts(venueId: string, windowStart: string, nowIso: string): Promise<Array<ScoringPost & { rightsPolicyId: string | null; renderPostId: string }>> {
    const rows = await this.sql`
      select p.id, p.platform, p.published_at, p.availability, p.sponsored_status, p.rights_policy_id, a.creator_id, l.stance, l.resolution_status,
        (select json_agg(json_build_object('observedAt', m.observed_at, 'views', m.views) order by m.observed_at) from private.post_metrics m where m.post_id = p.id) as snapshots,
        (select coalesce(json_agg(mm.views), '[]'::json) from (
           select distinct on (p2.id) m2.views from private.source_posts p2 join private.post_metrics m2 on m2.post_id = p2.id
           where p2.account_id = p.account_id and p2.id <> p.id and m2.views is not null and p2.published_at < p.published_at order by p2.id, m2.observed_at desc limit 20) mm) as history_views,
        (select r.expires_at from private.rights_policies r where r.id = p.rights_policy_id) as rights_expires_at,
        (select r.revoked_at from private.rights_policies r where r.id = p.rights_policy_id) as rights_revoked_at,
        (select r.approved_at from private.rights_policies r where r.id = p.rights_policy_id) as rights_approved_at
      from private.venue_post_links l join private.source_posts p on p.id = l.post_id join public.creator_accounts a on a.id = p.account_id
      where l.venue_id = ${venueId} and p.published_at >= ${windowStart} and l.resolution_status in ('approved', 'review_required', 'unresolved')`;
    const nowMs = Date.parse(nowIso);
    return rows.map((r) => {
      const approved = !!r.rights_approved_at;
      const revoked = r.rights_revoked_at ? Date.parse(toIso(r.rights_revoked_at)!) <= nowMs : false;
      const expired = r.rights_expires_at ? Date.parse(toIso(r.rights_expires_at)!) <= nowMs : false;
      const snaps = ((r.snapshots ?? []) as Array<{ observedAt: string; views: number | string | null }>).map((s) => ({ observedAt: new Date(s.observedAt).toISOString(), views: toNum(s.views) }));
      return { postId: r.id as string, renderPostId: r.id as string, creatorId: r.creator_id as string, platform: r.platform as 'tiktok' | 'instagram', publishedAt: toIso(r.published_at)!, snapshots: snaps, availability: r.availability as ScoringPost['availability'], rightsValid: approved && !revoked && !expired, linkApproved: r.resolution_status === 'approved', stance: r.stance as ScoringPost['stance'], sponsoredStatus: r.sponsored_status as ScoringPost['sponsoredStatus'], isDuplicateOfOtherPost: false, creatorHistoryViews: ((r.history_views ?? []) as Array<number | string>).map((v) => toNum(v)).filter((v): v is number => v !== null), rightsPolicyId: (r.rights_policy_id as string | null) ?? null };
    });
  }
  async loadCohorts(versionDate: string): Promise<Map<string, CohortTable>> {
    const rows = await this.sql`select * from private.normalization_cohorts where version = ${`cohort-v1-${versionDate}`}`;
    const m = new Map<string, CohortTable>();
    for (const r of rows) m.set(r.scope as string, { scope: r.scope as string, version: r.version as string, velocities: (r.velocities as number[]) ?? [], observations: Number(r.observations) });
    return m;
  }
  async upsertCohort(t: CohortTable): Promise<void> {
    await this.sql`insert into private.normalization_cohorts (scope, version, velocities, observations) values (${t.scope}, ${t.version}, ${t.velocities}, ${t.observations}) on conflict (scope, version) do update set velocities = excluded.velocities, observations = excluded.observations, built_at = now()`;
  }
  async loadVelocitySamples(windowStart: string): Promise<Array<{ platform: 'tiktok' | 'instagram'; publishedAt: string; cityId: string | null; category: string | null; snapshots: Snapshot[] }>> {
    const rows = await this.sql`
      select p.platform, p.published_at,
        (select v.city_id from private.venue_post_links l join public.venues v on v.id = l.venue_id where l.post_id = p.id and l.resolution_status = 'approved' limit 1) as city_id,
        (select v.primary_category::text from private.venue_post_links l join public.venues v on v.id = l.venue_id where l.post_id = p.id and l.resolution_status = 'approved' limit 1) as category,
        (select json_agg(json_build_object('observedAt', m.observed_at, 'views', m.views) order by m.observed_at) from private.post_metrics m where m.post_id = p.id) as snapshots
      from private.source_posts p where p.published_at >= ${windowStart} and p.availability = 'available' and p.sponsored_status <> 'declared'`;
    return rows.map((r) => ({ platform: r.platform as 'tiktok' | 'instagram', publishedAt: toIso(r.published_at)!, cityId: (r.city_id as string | null) ?? null, category: (r.category as string | null) ?? null, snapshots: ((r.snapshots ?? []) as Array<{ observedAt: string; views: number | string | null }>).map((s) => ({ observedAt: new Date(s.observedAt).toISOString(), views: toNum(s.views) })) }));
  }
  async writeVenueScore(o: VenueScoreOutput, lastObservationAt: string | null): Promise<void> {
    await this.sql`insert into public.venue_scores (venue_id, as_of, score_version, normalization_version, score, status, trending, window_days, eligible_posts, distinct_creators, accessible_views, metrics_coverage, baseline_partial, baseline_scope, components_json, reason_codes, last_successful_observation_at, window_start, window_end)
      values (${o.venueId}, ${o.asOf}, ${o.scoreVersion}, ${o.normalizationVersion}, ${o.score}, ${o.status}, ${o.trending}, ${Math.round((Date.parse(o.windowEnd) - Date.parse(o.windowStart)) / 86_400_000)}, ${o.eligiblePosts}, ${o.distinctCreators}, ${o.accessibleViews}, ${o.metricsCoverage}, ${o.baselinePartial}, ${o.baselineScope}, ${this.sql.json(o.components as never)}, ${o.reasonCodes}, ${lastObservationAt}, ${o.windowStart}, ${o.windowEnd})
      on conflict (venue_id) do update set as_of = excluded.as_of, score_version = excluded.score_version, normalization_version = excluded.normalization_version, score = excluded.score, status = excluded.status, trending = excluded.trending, window_days = excluded.window_days, eligible_posts = excluded.eligible_posts, distinct_creators = excluded.distinct_creators, accessible_views = excluded.accessible_views, metrics_coverage = excluded.metrics_coverage, baseline_partial = excluded.baseline_partial, baseline_scope = excluded.baseline_scope, components_json = excluded.components_json, reason_codes = excluded.reason_codes, last_successful_observation_at = excluded.last_successful_observation_at, window_start = excluded.window_start, window_end = excluded.window_end`;
    await this.sql`insert into private.venue_score_runs (venue_id, as_of, score_version, normalization_version, result) values (${o.venueId}, ${o.asOf}, ${o.scoreVersion}, ${o.normalizationVersion}, ${this.sql.json(o as never)})`;
  }
  async loadApprovedLinks(venueId: string): Promise<Array<{ decidedBy: string | null; postId: string; mentionId: string; creatorId: string; platform: 'tiktok' | 'instagram'; publishedAt: string; observedAt: string; views: number | null; sponsoredStatus: string; stance: string; canonicalUrl: string; thumbnailUrl: string | null; rightsPolicyId: string | null; claims: PlaceMention['claims']; evidence: PlaceMention['evidence']; recommendation: PlaceMention['recommendation']; extractedAt: string }>> {
    const rows = await this.sql`
      select l.post_id, l.mention_id, l.stance, l.decided_by, p.platform, p.published_at, p.canonical_url, p.thumbnail_url, p.rights_policy_id, p.sponsored_status, a.creator_id,
        (select m.observed_at from private.post_metrics m where m.post_id = p.id order by m.observed_at desc limit 1) as observed_at,
        (select m.views from private.post_metrics m where m.post_id = p.id order by m.observed_at desc limit 1) as views,
        pm.claims, pm.evidence, pm.recommendation, pm.created_at as extracted_at
      from private.venue_post_links l join private.source_posts p on p.id = l.post_id join public.creator_accounts a on a.id = p.account_id
      left join lateral (select claims, evidence, recommendation, created_at from private.place_mentions x where x.post_id = l.post_id and x.mention_id = l.mention_id and x.resolution_status = 'approved' order by created_at desc limit 1) pm on true
      where l.venue_id = ${venueId} and l.resolution_status = 'approved' and p.availability = 'available' order by p.published_at desc limit 50`;
    return rows.map((r) => ({ decidedBy: (r.decided_by as string | null) ?? null, postId: r.post_id as string, mentionId: r.mention_id as string, creatorId: r.creator_id as string, platform: r.platform as 'tiktok' | 'instagram', publishedAt: toIso(r.published_at)!, observedAt: toIso(r.observed_at) ?? toIso(r.published_at)!, views: toNum(r.views), sponsoredStatus: r.sponsored_status as string, stance: r.stance as string, canonicalUrl: r.canonical_url as string, thumbnailUrl: (r.thumbnail_url as string | null) ?? null, rightsPolicyId: (r.rights_policy_id as string | null) ?? null, claims: (r.claims ?? []) as PlaceMention['claims'], evidence: (r.evidence ?? []) as PlaceMention['evidence'], recommendation: (r.recommendation ?? 'unclear') as PlaceMention['recommendation'], extractedAt: toIso(r.extracted_at) ?? toIso(r.published_at)! }));
  }
  async replaceVenueSources(venueId: string, rows: Array<{ postId: string; creatorId: string; platform: string; publishedAt: string; observedAt: string; views: number | null; sponsoredStatus: string; stance: string; renderMode: string; sourceUrl: string | null; thumbnailUrl: string | null; rightsPolicyId: string; rightsExpiresAt: string | null; rank: number }>): Promise<void> {
    await this.sql.begin(async (tx) => {
      await tx`delete from public.venue_sources where venue_id = ${venueId}`;
      for (const s of rows) {
        await tx`insert into public.venue_sources (venue_id, source_post_id, creator_id, platform, published_at, observed_at, views, sponsored_status, stance, render_mode, source_url, thumbnail_url, rights_policy_id, rights_expires_at, rank)
          values (${venueId}, ${s.postId}, ${s.creatorId}, ${s.platform}::public.social_platform, ${s.publishedAt}, ${s.observedAt}, ${s.views}, ${s.sponsoredStatus}, ${s.stance}, ${s.renderMode}::public.render_mode, ${s.sourceUrl}, ${s.thumbnailUrl}, ${s.rightsPolicyId}, ${s.rightsExpiresAt}, ${s.rank})`;
      }
    });
  }
  async writeVenueSummary(venueId: string, locale: 'tr' | 'en', claims: unknown, sourceVersion: string, modelVersion: string | null, generatedAt: string, expiresAt: string | null): Promise<void> {
    await this.sql`insert into public.venue_summaries (venue_id, locale, claims_json, source_version, model_version, generated_at, expires_at) values (${venueId}, ${locale}, ${this.sql.json(claims as never)}, ${sourceVersion}, ${modelVersion}, ${generatedAt}, ${expiresAt})
      on conflict (venue_id, locale) do update set claims_json = excluded.claims_json, source_version = excluded.source_version, model_version = excluded.model_version, generated_at = excluded.generated_at, expires_at = excluded.expires_at`;
  }
  async venuesLinkedToPost(postId: string): Promise<string[]> {
    const rows = await this.sql`select distinct venue_id from private.venue_post_links where post_id = ${postId} and resolution_status = 'approved'`;
    return rows.map((r) => r.venue_id as string);
  }
  async upsertGoogleVenueLocation(venueId: string, lat: number, lng: number, placeId: string, expiresAt: string): Promise<void> {
    await this.sql`insert into geo.venue_locations (venue_id, location, source_type, source_ref, expires_at) values (${venueId}, extensions.st_setsrid(extensions.st_makepoint(${lng}, ${lat}), 4326)::extensions.geography, 'google_cache', ${placeId}, ${expiresAt})
      on conflict (venue_id) do update set location = excluded.location, source_type = excluded.source_type, source_ref = excluded.source_ref, expires_at = excluded.expires_at, observed_at = now()
      where geo.venue_locations.source_type in ('google_cache', 'synthetic')`;
  }
  async upsertExternalId(venueId: string, placeId: string): Promise<void> {
    await this.sql`insert into public.venue_external_ids (venue_id, provider, external_id) values (${venueId}, 'google_places', ${placeId}) on conflict (venue_id, provider) do update set external_id = excluded.external_id, checked_at = now()`;
  }
  async venueByPlaceId(placeId: string): Promise<string | null> {
    const [r] = await this.sql`select venue_id from public.venue_external_ids where provider = 'google_places' and external_id = ${placeId}`;
    return r ? (r.venue_id as string) : null;
  }
  async createDraftVenue(v: { ownName: string; cityId: string; neighborhood: string | null; category: string }): Promise<string> {
    const [r] = await this.sql`insert into public.venues (own_name, city_id, neighborhood, primary_category, status, data_mode) values (${v.ownName}, ${v.cityId}, ${v.neighborhood}, ${v.category}::public.category, 'draft', 'live') returning id`;
    return r!.id as string;
  }
  async cityByName(name: string): Promise<{ id: string; name: string } | null> {
    const [r] = await this.sql`select id, name from public.cities where lower(name) = lower(${name}) or slug = lower(${name}) limit 1`;
    return r ? { id: r.id as string, name: r.name as string } : null;
  }

  async getInbox(inboxId: string): Promise<{ payload: Record<string, unknown>; processedAt: string | null } | null> {
    const [r] = await this.sql`select payload, processed_at from private.ingest_inbox where id = ${inboxId}`;
    return r ? { payload: (r.payload ?? {}) as Record<string, unknown>, processedAt: toIso(r.processed_at) } : null;
  }
  async markInboxProcessed(inboxId: string): Promise<void> {
    await this.sql`update private.ingest_inbox set processed_at = now() where id = ${inboxId}`;
  }
  /** Import/keşif ile gelen yeni creator: unclaimed, live; platform kimliği string (§13.2). */
  async createCreatorAccount(c: { platform: 'tiktok' | 'instagram'; platformUserId: string; handle: string; canonicalUrl: string; displayName: string | null }): Promise<{ id: string; creator_id: string; handle: string }> {
    const existing = await this.findAccountByPlatformId(c.platform, c.platformUserId);
    if (existing) return existing;
    return this.sql.begin(async (tx) => {
      const [cr] = await tx`insert into public.creators (display_name, claim_status, status, data_mode) values (${c.displayName ?? c.handle}, 'unclaimed', 'active', 'live') returning id`;
      const [acc] = await tx`insert into public.creator_accounts (creator_id, platform, platform_user_id, handle, canonical_url) values (${cr!.id as string}, ${c.platform}::public.social_platform, ${c.platformUserId}, ${c.handle}, ${c.canonicalUrl}) on conflict (platform, platform_user_id) do update set handle = excluded.handle returning id, creator_id, handle`;
      await tx`insert into private.creator_monitoring (account_id, enabled) values (${acc!.id as string}, false) on conflict (account_id) do nothing`;
      return { id: acc!.id as string, creator_id: acc!.creator_id as string, handle: acc!.handle as string };
    });
  }
  async setVenueStatus(venueId: string, status: string): Promise<void> {
    await this.sql`update public.venues set status = ${status}::public.venue_status where id = ${venueId}`;
  }
  async venueHasValidLocation(venueId: string): Promise<boolean> {
    const [r] = await this.sql`select 1 as ok from geo.venue_locations where venue_id = ${venueId} and (expires_at is null or expires_at > now())`;
    return !!r;
  }
  async resolveImportsFromLinks(): Promise<number> {
    const rows = await this.sql`update public.import_requests i set status = 'resolved', result_venue_id = l.venue_id
      from private.venue_post_links l where i.status = 'processing' and i.source_post_id = l.post_id and l.resolution_status = 'approved' returning i.id`;
    return rows.length;
  }
  async setImportSourcePost(importId: string, postId: string): Promise<void> {
    await this.sql`update public.import_requests set source_post_id = ${postId} where id = ${importId}`;
  }

  // ---------- import / keşif / audit / bakım ----------
  async getImportRequest(id: string): Promise<{ id: string; normalizedUrl: string; status: string } | null> {
    const [r] = await this.sql`select id, normalized_url, status from public.import_requests where id = ${id}`;
    return r ? { id: r.id as string, normalizedUrl: r.normalized_url as string, status: r.status as string } : null;
  }
  async updateImportRequest(id: string, status: string, resultVenueId: string | null, errorCode: string | null): Promise<void> {
    await this.sql`update public.import_requests set status = ${status}, result_venue_id = ${resultVenueId}, error_code = ${errorCode} where id = ${id}`;
  }
  async listQueuedImports(limit: number): Promise<Array<{ id: string }>> {
    const rows = await this.sql`select id from public.import_requests where status = 'queued' order by created_at limit ${limit}`;
    return rows.map((r) => ({ id: r.id as string }));
  }
  async upsertDiscoveryCandidate(c: { platform: string; platformCreatorId: string; handle: string; canonicalUrl: string; foundVia: string; foundAt: string; sampleCaptions: string[] }): Promise<void> {
    await this.sql`insert into private.creator_discovery_candidates (platform, platform_creator_id, handle, canonical_url, found_via, found_at, sample_captions) values (${c.platform}::public.social_platform, ${c.platformCreatorId}, ${c.handle}, ${c.canonicalUrl}, ${c.foundVia}, ${c.foundAt}, ${this.sql.json(c.sampleCaptions as never)})
      on conflict (platform, platform_creator_id) do update set handle = excluded.handle, sample_captions = excluded.sample_captions`;
  }
  async audit(action: string, subjectRef: Record<string, unknown>, after: unknown, reason: string | null, correlationId: string | null): Promise<void> {
    await this.sql`insert into private.audit_events (actor_id, action, subject_ref, after, reason, correlation_id) values (null, ${action}, ${this.sql.json(subjectRef as never)}, ${after === undefined ? null : this.sql.json(after as never)}, ${reason}, ${correlationId})`;
  }
  async purgeExpiredPlacesCache(): Promise<number> {
    const [r] = await this.sql`select public.purge_expired_places_cache() as n`;
    return Number(r!.n);
  }
  async hideVenuesWithExpiredLocations(): Promise<number> {
    const rows = await this.sql`update public.venues v set status = 'hidden' where v.status = 'published' and exists (select 1 from geo.venue_locations l where l.venue_id = v.id and l.expires_at is not null and l.expires_at <= now()) returning v.id`;
    return rows.length;
  }
  async dailyCostSummary(day: string): Promise<{ aiUsd: number; providerUsd: number; newPosts: number; videoMinutes: number }> {
    const [r] = await this.sql`select coalesce(sum(case when kind like 'ai.%' then micro_usd end), 0) as ai, coalesce(sum(case when kind like 'provider.%' then micro_usd end), 0) as prov from private.cost_events where observed_at::date = ${day}::date`;
    const [d] = await this.sql`select new_posts, video_minutes from private.budget_days where day = ${day}`;
    return { aiUsd: Number(r!.ai) / 1e6, providerUsd: Number(r!.prov) / 1e6, newPosts: Number(d?.new_posts ?? 0), videoMinutes: Number(d?.video_minutes ?? 0) };
  }
}

export type { Snapshot } from '@viral-places/scoring';
import type { Snapshot } from '@viral-places/scoring';
