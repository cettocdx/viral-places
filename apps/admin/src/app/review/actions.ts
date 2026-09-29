'use server';

import { revalidatePath } from 'next/cache';
import { serviceClient } from '@/lib/supabase';

const ACTOR = '00000000-0000-0000-0000-000000000000';

export interface ReviewRow {
  id: string;
  rawPlaceName: string;
  candidateName: string | null;
  candidateCity: string | null;
  venueId: string | null;
  score: number | null;
  reasons: string[];
  cityHint: string | null;
  areaHint: string | null;
  createdAt: string;
}

/** Açık mention_resolution görevleri; karar için gereken alanlar subject_ref içinde durur (§16.2). */
export async function listQueue(limit = 200): Promise<ReviewRow[]> {
  const { data, error } = await serviceClient().rpc('admin_list_review_tasks', { p_status: 'open', p_limit: limit });
  if (error) throw error;
  type Task = { id: string; kind: string; created_at: string; subject_ref: Record<string, unknown> };
  return ((data ?? []) as Task[])
    .filter((t) => t.kind === 'mention_resolution')
    .map((t) => {
      const s = t.subject_ref ?? {};
      const top = (s.topCandidates as Array<{ venueId: string; name: string; city: string }> | undefined)?.[0] ?? null;
      return {
        id: t.id,
        rawPlaceName: String(s.rawPlaceName ?? '—'),
        candidateName: top?.name ?? null,
        candidateCity: top?.city ?? null,
        venueId: (s.venueId as string | null) ?? null,
        score: typeof s.score === 'number' ? s.score : null,
        reasons: Array.isArray(s.reasons) ? (s.reasons as string[]) : [],
        cityHint: (s.cityHint as string | null) ?? null,
        areaHint: (s.areaHint as string | null) ?? null,
        createdAt: t.created_at,
      };
    });
}

async function decide(taskId: string, venueId: string | null, decision: 'approve' | 'reject'): Promise<string | null> {
  const { error } = await serviceClient().rpc('decide_review_task', { p_task_id: taskId, p_decision: decision, p_venue_id: decision === 'approve' ? venueId : null, p_actor: ACTOR, p_reason: null });
  return error ? String(error.message ?? error) : null;
}

export async function decideOne(taskId: string, venueId: string | null, decision: 'approve' | 'reject'): Promise<{ error: string | null }> {
  const err = await decide(taskId, venueId, decision);
  revalidatePath('/review');
  return { error: err };
}

/** Toplu onay: yalnız eşiği geçen, sert çelişkisi olmayan ve mekanı belli olan eşleşmeler. */
export async function approveSafe(minScore: number): Promise<{ approved: number; skipped: number; failed: number }> {
  let approved = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of await listQueue(200)) {
    const safe = row.venueId !== null && (row.score ?? 0) >= minScore && !row.reasons.some((r) => r.startsWith('hard_conflict:'));
    if (!safe) {
      skipped += 1;
      continue;
    }
    const err = await decide(row.id, row.venueId, 'approve');
    if (err) failed += 1;
    else approved += 1;
  }
  revalidatePath('/review');
  return { approved, skipped, failed };
}
