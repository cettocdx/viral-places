/** post.extract (§15.2 A→D): hak → hash → bütçe → izinli girdiler (caption/altyazı/yer etiketi) → Claude → doğrulama → mention'lar → eşleştirme işleri. */
import { EXTRACT_PROMPT_VERSION, PlaceExtractor, inputHashOf, planExtraction, type ExtractionEnvelope } from '@viral-places/pipeline';
import { aiInputPlan } from '@viral-places/policy';
import { reconcile, reserve } from '../budget-gate.ts';
import { env } from '../env.ts';
import { RETRY, type Ctx, type Handler } from './types.ts';

const EST_METADATA_ONLY_USD = 0.06; // ~4k giriş + 1.2k çıkış token, claude-opus-5 liste fiyatı; gerçek usage ile uzlaştırılır

function hasAnthropicCredentials(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export const postExtract: Handler = async (ctx, job) => {
  const postId = String(job.payload.postId ?? '');
  const post = await ctx.db.getPost(postId);
  if (!post) return { ok: false, code: 'post_not_found', retryAfterSeconds: RETRY.none };
  const nowIso = ctx.now();
  const rights = await ctx.db.getRights(post.rights_policy_id);
  const ai = aiInputPlan(rights, nowIso);
  const modelId = env.extractionModel();
  const skip = async (code: string, detail: string) => {
    await ctx.db.insertExtractionRun({ postId, promptVersion: EXTRACT_PROMPT_VERSION, modelId, inputHash: `skip:${post.content_hash ?? postId}:${code}`, analysisMode: 'metadata_only', status: 'skipped', skipCode: code, issues: [{ code, detail }] });
    return { ok: true as const, note: `skipped:${code}` };
  };
  if (ai.analysisMode === 'none') return skip('rights_denied', 'may_send_metadata_to_ai=false');
  if (post.availability !== 'available') return skip('unavailable', post.availability);
  if (post.last_extracted_hash && post.content_hash && post.last_extracted_hash.startsWith(post.content_hash)) return skip('already_extracted', 'content hash unchanged');

  // İzinli transkript: TikTok otomatik altyazısı (metadata AI hakkı + sağlayıcı) — ses/video dosyası indirilmez
  let transcript = await ctx.db.getTranscript(postId);
  if (!transcript && post.platform === 'tiktok' && ctx.dataMode === 'live' && ctx.adapters.scrapeCreators && env.priceScrapeCreatorsPerCredit() !== null) {
    const tr = await reserve(ctx, { id: `transcript-${job.id}`, jobKind: 'provider.transcript', estimatedUsd: env.priceScrapeCreatorsPerCredit()!, newPosts: 0, videoMinutes: 0, outboxId: job.id });
    if (tr.ok) {
      try {
        const t = await ctx.adapters.scrapeCreators.fetchTranscript(post.canonical_url, post.language ?? undefined);
        if (t) {
          await ctx.db.upsertTranscript(postId, { source: 'tiktok_captions', language: post.language, segments: t.segments, rightsPolicyId: post.rights_policy_id, expiresAt: null });
          transcript = { segments: t.segments, language: post.language };
        }
        await reconcile(ctx, tr.reservationId, env.priceScrapeCreatorsPerCredit(), { kind: 'provider.transcript', provider: 'scrapecreators', unitKind: 'request', units: 1, ref: { postId } });
      } catch (e) {
        await reconcile(ctx, tr.reservationId, null, { kind: 'provider.transcript_failed', provider: 'scrapecreators', unitKind: 'request', units: 0, ref: { postId, err: (e as Error).message?.slice(0, 200) } });
      }
    }
  }

  const envelope: ExtractionEnvelope = {
    sourcePostId: postId,
    analysisMode: transcript && transcript.segments.length > 0 ? 'transcript' : 'metadata_only',
    sourceFields: {
      caption: post.caption,
      permittedTranscriptSegments: transcript?.segments ?? [],
      permittedCreatorContext: [post.location_tag ? `Gönderi yer etiketi: ${post.location_tag.name}` : null, post.hashtags.length ? `Hashtag'ler: ${post.hashtags.map((h) => `#${h}`).join(' ')}` : null].filter(Boolean).join('\n') || null,
    },
    providedMediaDurationMs: post.media_duration_ms,
    localeHint: post.language ?? 'tr',
  };
  const inputHash = inputHashOf(envelope, EXTRACT_PROMPT_VERSION, modelId);
  const existing = await ctx.db.findExtractionByHash(postId, inputHash);
  if (existing && existing.status === 'ok') return { ok: true, note: 'already_extracted_same_hash' };

  const plan = planExtraction({
    post: { ...post, availability: 'available', contentHash: post.content_hash ?? '', mediaCapabilities: { downloadUrlPresent: post.download_url_present, durationMs: post.media_duration_ms } } as never,
    rights,
    nowIso,
    alreadyExtractedHash: null,
    budget: { dailyHardLimitUsd: ctx.policy.budget.dailyHardLimitUsd ?? (ctx.dataMode === 'demo' ? 0 : null), spentTodayUsd: 0, reservedUsd: 0, perJobMaxUsd: ctx.policy.budget.perJobMaxUsd ?? (ctx.dataMode === 'demo' ? 0 : null) },
    priceUsd: { metadataOnlyPerPost: EST_METADATA_ONLY_USD, videoPerMinute: null },
  });
  if (plan.kind === 'skip' && plan.code !== 'budget_exceeded' && plan.code !== 'budget_unset') return skip(plan.code, plan.detail);
  if (!hasAnthropicCredentials()) return skip('ai_provider_unconfigured', 'ANTHROPIC_API_KEY/ANTHROPIC_AUTH_TOKEN yok (BLOCKED: AI sağlayıcı)');
  const res = await reserve(ctx, { id: `extract-${job.id}`, jobKind: 'ai.extract', estimatedUsd: EST_METADATA_ONLY_USD, newPosts: 1, videoMinutes: 0, outboxId: job.id });
  if (!res.ok) return skip(res.code, res.detail);

  const extractor = new PlaceExtractor({ model: modelId, effort: env.extractionEffort() });
  const out = await extractor.extract(envelope);
  const usageRef = { kind: 'ai.extract', provider: 'anthropic', unitKind: 'tokens', units: out.run.usage.inputTokens + out.run.usage.outputTokens, ref: { postId, modelId: out.run.modelId, promptVersion: out.run.promptVersion, attempts: out.run.attempts } };
  await reconcile(ctx, res.reservationId, out.run.estimatedCostUsd, usageRef);
  const base = { postId, promptVersion: out.run.promptVersion, modelId: out.run.modelId, inputHash, analysisMode: envelope.analysisMode, usage: out.run.usage, estimatedCostMicroUsd: out.run.estimatedCostUsd === null ? null : Math.round(out.run.estimatedCostUsd * 1e6), attempts: out.run.attempts, durationMs: out.run.durationMs };
  if (out.status === 'error') {
    await ctx.db.insertExtractionRun({ ...base, status: 'error', issues: [{ code: out.code, detail: out.detail }] });
    return out.code === 'provider_error' ? { ok: false, code: out.code, detail: out.detail, retryAfterSeconds: RETRY.transient } : { ok: true, note: `error:${out.code}` };
  }
  if (out.status === 'refused') {
    await ctx.db.insertExtractionRun({ ...base, status: 'refused', issues: [{ code: 'refusal', detail: out.category ?? '' }] });
    await ctx.db.createReviewTask('extraction_refused', { postId }, 1);
    return { ok: true, note: 'refused' };
  }
  if (out.status === 'invalid') {
    await ctx.db.insertExtractionRun({ ...base, status: 'invalid', output: out.rawOutput, issues: out.issues });
    await ctx.db.createReviewTask('extraction_invalid', { postId, issues: out.issues.slice(0, 10) }, 2);
    return { ok: true, note: `invalid:${out.issues.length}` };
  }
  const runId = await ctx.db.insertExtractionRun({ ...base, status: 'ok', output: out.extraction });
  if (out.extraction.abstain || out.extraction.mentions.length === 0) return { ok: true, note: `abstain:${out.extraction.abstainReason ?? 'no_mentions'}` };
  const ids = await ctx.db.insertMentions(runId, postId, out.extraction.mentions, ctx.policy.matching.version);
  for (const id of ids) await ctx.db.enqueue('mention.resolve', { mentionId: id, postId }, `mention.resolve:${id}`, job.id);
  return { ok: true, note: `mentions=${ids.length} mode=${envelope.analysisMode}` };
};
