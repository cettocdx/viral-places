/**
 * Aşama A/B/C planlayıcısı (§15.2): hak kapısı önce; medya izni yoksa yalnız metadata; ikisi de yoksa iş yok.
 * Bütçe bilinmiyorsa ücretli iş yok (§27.4). Aynı content hash için tekrar AI işi yok.
 */
import { aiInputPlan, type RightsRecord } from '@viral-places/policy';
import type { NormalizedPost } from './normalize';

export interface Budget {
  dailyHardLimitUsd: number | null;
  spentTodayUsd: number;
  reservedUsd: number;
  perJobMaxUsd: number | null;
}

export interface ExtractionJobPlan {
  postId: string;
  analysisMode: 'metadata_only' | 'native_video' | 'sampled_frames';
  inputs: { caption: boolean; media: boolean };
  estimatedCostUsd: number;
  reason: string[];
}

export type PlanResult = { kind: 'run'; plan: ExtractionJobPlan } | { kind: 'skip'; code: 'rights_denied' | 'budget_exceeded' | 'budget_unset' | 'already_extracted' | 'unavailable'; detail: string };

export interface PlannerInput {
  post: NormalizedPost;
  rights: RightsRecord | null;
  nowIso: string;
  alreadyExtractedHash: string | null;
  budget: Budget;
  /** Sağlayıcının belgelenmiş fiyatı; birimi belirsizse null ve iş planlanmaz. */
  priceUsd: { metadataOnlyPerPost: number | null; videoPerMinute: number | null };
}

export function planExtraction(input: PlannerInput): PlanResult {
  const { post, rights, nowIso, budget } = input;
  if (post.availability !== 'available') return { kind: 'skip', code: 'unavailable', detail: post.availability };
  if (input.alreadyExtractedHash === post.contentHash) return { kind: 'skip', code: 'already_extracted', detail: 'content hash unchanged' };
  const ai = aiInputPlan(rights, nowIso);
  if (ai.analysisMode === 'none') return { kind: 'skip', code: 'rights_denied', detail: 'no AI processing right (metadata or media)' };
  if (budget.dailyHardLimitUsd === null || budget.perJobMaxUsd === null) return { kind: 'skip', code: 'budget_unset', detail: 'daily/perJob limit unknown' };

  const useVideo = ai.media && post.mediaCapabilities.downloadUrlPresent && post.mediaCapabilities.durationMs !== null;
  const minutes = useVideo ? (post.mediaCapabilities.durationMs as number) / 60000 : 0;
  const price = useVideo ? input.priceUsd.videoPerMinute : input.priceUsd.metadataOnlyPerPost;
  if (price === null) return { kind: 'skip', code: 'budget_unset', detail: 'price unit unknown' };
  const estimated = useVideo ? minutes * price : price;
  if (estimated > budget.perJobMaxUsd) return { kind: 'skip', code: 'budget_exceeded', detail: `job ${estimated.toFixed(4)} > perJobMax` };
  if (budget.spentTodayUsd + budget.reservedUsd + estimated > budget.dailyHardLimitUsd) return { kind: 'skip', code: 'budget_exceeded', detail: 'daily hard limit' };

  return {
    kind: 'run',
    plan: {
      postId: post.platformPostId,
      analysisMode: useVideo ? 'native_video' : 'metadata_only',
      inputs: { caption: ai.metadata, media: useVideo },
      estimatedCostUsd: Number(estimated.toFixed(6)),
      reason: [useVideo ? 'media_right_and_download' : 'metadata_only_right', 'budget_ok'],
    },
  };
}
