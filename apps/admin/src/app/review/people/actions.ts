'use server';

import { revalidatePath } from 'next/cache';
import { serviceClient } from '@/lib/supabase';

export interface CreatorCandidate {
  accountId: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  followers: number | null;
  verdict: string;
  kind: string | null;
  istanbulFocused: boolean | null;
  score: number | null;
  recommendPosts: number;
  totalPosts: number;
  reason: string | null;
  samples: string[];
}

/** Aday / onaylı / reddedilmiş hesaplar (private.creator_vetting). Yalnız yerel ya da korunan ortamda çalışır. */
export async function listCreators(verdict: 'candidate' | 'approved' | 'rejected'): Promise<CreatorCandidate[]> {
  const { data, error } = await serviceClient().rpc('admin_list_creator_candidates', { p_verdict: verdict, p_limit: 300 });
  if (error) throw error;
  type Row = { account_id: string; handle: string; display_name: string | null; avatar_url: string | null; follower_count: number | null; verdict: string; kind: string | null; istanbul_focused: boolean | null; score: number | null; recommend_posts: number; total_posts: number; reason: string | null; sample_captions: unknown };
  return ((data ?? []) as Row[]).map((r) => ({
    accountId: r.account_id,
    handle: r.handle,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    followers: r.follower_count === null ? null : Number(r.follower_count),
    verdict: r.verdict,
    kind: r.kind,
    istanbulFocused: r.istanbul_focused,
    score: r.score === null ? null : Number(r.score),
    recommendPosts: Number(r.recommend_posts),
    totalPosts: Number(r.total_posts),
    reason: r.reason,
    samples: Array.isArray(r.sample_captions) ? (r.sample_captions as string[]) : [],
  }));
}

export async function decideCreator(accountId: string, verdict: 'approved' | 'rejected' | 'candidate'): Promise<{ error: string | null }> {
  const { error } = await serviceClient().rpc('admin_decide_creator', { p_account_id: accountId, p_verdict: verdict });
  revalidatePath('/review/people');
  return { error: error ? String(error.message ?? error) : null };
}
