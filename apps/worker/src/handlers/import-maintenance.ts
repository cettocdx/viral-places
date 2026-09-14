/** import.process (§19.2 kullanıcı linki) ve maintenance.daily (§16.4 cache temizliği, §27.4 rezervasyon TTL + günlük rapor). */
import { ProviderError, buildDailyReport, parseImportUrl } from '@viral-places/pipeline';
import { RETRY, type Handler } from './types.ts';

export const importProcess: Handler = async (ctx, job) => {
  const importId = String(job.payload.importId ?? '');
  const req = await ctx.db.getImportRequest(importId);
  if (!req) return { ok: false, code: 'import_not_found', retryAfterSeconds: RETRY.none };
  if (req.status !== 'queued' && req.status !== 'blocked') return { ok: true, note: `status_${req.status}` };
  const target = parseImportUrl(req.normalizedUrl);
  if (target.kind === 'unsupported') {
    await ctx.db.updateImportRequest(importId, 'unresolved', null, `url_${target.reason}`);
    return { ok: true, note: 'unsupported_url' };
  }
  if (target.kind === 'short_link') {
    await ctx.db.updateImportRequest(importId, 'unresolved', null, 'short_link_unresolved'); // yönlendirme çözümleme yalnız allowlist host ile ayrı iş (SSRF)
    return { ok: true, note: 'short_link' };
  }
  const adapter = ctx.dataMode === 'demo' ? ctx.adapters.get('fixture') : ctx.adapters.primaryFor(target.platform);
  if (!adapter) {
    await ctx.db.updateImportRequest(importId, 'blocked', null, 'provider_unavailable');
    return { ok: true, note: 'provider_unavailable' };
  }
  const rights = await ctx.db.getRights('user-import');
  if (!rights) {
    await ctx.db.updateImportRequest(importId, 'blocked', null, 'rights_policy_missing:user-import');
    return { ok: true, note: 'rights_missing' };
  }
  try {
    if (target.kind === 'profile') {
      const c = await adapter.fetchCreator({ platform: target.platform, handle: target.handle, platformCreatorId: null });
      await ctx.db.upsertDiscoveryCandidate({ platform: c.platform, platformCreatorId: c.platformCreatorId, handle: c.handle, canonicalUrl: c.canonicalUrl, foundVia: `user_import:${importId}`, foundAt: ctx.now(), sampleCaptions: [] });
      await ctx.db.updateImportRequest(importId, 'unresolved', null, 'profile_added_to_discovery');
      return { ok: true, note: 'profile_candidate' };
    }
    const post = await adapter.fetchPost({ platform: target.platform, platformPostId: target.platform === 'tiktok' ? target.platformPostId : null, canonicalUrl: target.normalizedUrl, rightsPolicyId: 'user-import', dataMode: ctx.dataMode === 'demo' ? 'synthetic' : 'live' });
    const account = await ctx.db.createCreatorAccount({ platform: post.platform, platformUserId: post.platformCreatorId, handle: post.handle, canonicalUrl: post.platform === 'tiktok' ? `https://www.tiktok.com/@${post.handle}` : `https://www.instagram.com/${post.handle}/`, displayName: null });
    const runUuid = await ctx.db.createProviderRun({ provider: adapter.provider, runId: post.providerRunId, platform: post.platform, accountId: account.id, status: 'succeeded', costMicroUsd: null, correlationId: job.id });
    const postId = await ctx.db.upsertPost(account.id, post, runUuid);
    await ctx.db.setImportSourcePost(importId, postId);
    await ctx.db.updateImportRequest(importId, 'processing', null, null);
    await ctx.db.enqueue('post.extract', { postId, contentHash: post.contentHash, precheck: ['user_import'] }, `post.extract:${postId}:${post.contentHash}`, job.id);
    return { ok: true, note: `post=${postId}` };
  } catch (e) {
    const pe = e instanceof ProviderError ? e : null;
    if (pe?.retryable) return { ok: false, code: pe.code, retryAfterSeconds: RETRY.provider };
    await ctx.db.updateImportRequest(importId, 'failed', null, pe?.code ?? 'fetch_failed');
    return { ok: true, note: `failed:${pe?.code ?? 'unknown'}` };
  }
};

export const maintenanceDaily: Handler = async (ctx) => {
  const expired = await ctx.db.expireStaleReservations();
  const purged = await ctx.db.purgeExpiredPlacesCache();
  const hidden = await ctx.db.hideVenuesWithExpiredLocations();
  const resolvedImports = await ctx.db.resolveImportsFromLinks();
  const day = ctx.now().slice(0, 10);
  const c = await ctx.db.dailyCostSummary(day);
  const report = buildDailyReport({ day, newPosts: c.newPosts, duplicates: 0, videoMinutes: c.videoMinutes, correctNewVenues: 0, aiCostUsd: c.aiUsd, reviewCostUsd: 0, providerCostUsd: c.providerUsd });
  ctx.log('info', 'daily_report', { ...report, expiredReservations: expired, purgedCache: purged, hiddenVenues: hidden, resolvedImports });
  return { ok: true, note: `expired=${expired} purged=${purged} hidden=${hidden} imports=${resolvedImports}` };
};
