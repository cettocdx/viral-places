'use client';

import { useState, useTransition } from 'react';
import { approveSafe, decideOne, type ReviewRow } from './actions';

const MIN_SCORE = 0.85;

function scoreColor(score: number | null): string {
  if (score === null) return '#8A8F98';
  if (score >= 0.9) return '#1C7C4A';
  if (score >= MIN_SCORE) return '#8A6100';
  return '#8A8F98';
}

export function QueueClient({ rows }: { rows: ReviewRow[] }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, 'approve' | 'reject'>>({});
  const safeCount = rows.filter((r) => r.venueId && (r.score ?? 0) >= MIN_SCORE && !r.reasons.some((x) => x.startsWith('hard_conflict:'))).length;

  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 900, margin: '0 auto', padding: 24, color: '#111827' }}>
      <h1 style={{ fontSize: 26, margin: '0 0 4px' }}>Onay kuyruğu</h1>
      <p style={{ color: '#5B616E', margin: '0 0 20px' }}>
        {rows.length} açık eşleşme · {safeCount} tanesi güvenli eşikte (puan ≥ {MIN_SCORE}, çelişkisiz)
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={pending || safeCount === 0}
          onClick={() =>
            start(async () => {
              const r = await approveSafe(MIN_SCORE);
              setNote(`${r.approved} onaylandı, ${r.skipped} atlandı${r.failed ? `, ${r.failed} hata` : ''}. Sayfayı yenile.`);
            })
          }
          style={{ background: '#111827', color: '#fff', border: 0, borderRadius: 10, padding: '12px 18px', fontSize: 15, fontWeight: 600, cursor: pending ? 'wait' : 'pointer' }}
        >
          Güvenli olanları onayla ({safeCount})
        </button>
        <a href="/review" style={{ color: '#2563EB', textDecoration: 'none', fontSize: 14 }}>Yenile</a>
        {note ? <span style={{ color: '#1C7C4A', fontSize: 14 }}>{note}</span> : null}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map((r) => {
          const decided = done[r.id];
          return (
            <div key={r.id} style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, display: 'flex', gap: 14, alignItems: 'center', opacity: decided ? 0.45 : 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{r.rawPlaceName}</div>
                <div style={{ color: '#5B616E', fontSize: 14, marginTop: 2 }}>
                  → {r.candidateName ?? 'aday yok'}
                  {r.candidateCity ? ` · ${r.candidateCity}` : ''}
                  {r.areaHint ? ` · ipucu: ${r.areaHint}` : r.cityHint ? ` · ipucu: ${r.cityHint}` : ''}
                </div>
                {r.reasons.length > 0 ? <div style={{ color: '#8A8F98', fontSize: 12, marginTop: 4 }}>{r.reasons.join(' · ')}</div> : null}
              </div>
              <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: scoreColor(r.score), width: 52, textAlign: 'right' }}>{r.score === null ? '—' : r.score.toFixed(2)}</div>
              {decided ? (
                <span style={{ fontSize: 14, color: '#5B616E', width: 150, textAlign: 'right' }}>{decided === 'approve' ? 'onaylandı' : 'reddedildi'}</span>
              ) : (
                <div style={{ display: 'flex', gap: 8, width: 150, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    disabled={pending || !r.venueId}
                    onClick={() => start(async () => { const res = await decideOne(r.id, r.venueId, 'approve'); if (!res.error) setDone((d) => ({ ...d, [r.id]: 'approve' })); else setNote(res.error); })}
                    style={{ background: '#111827', color: '#fff', border: 0, borderRadius: 8, padding: '8px 14px', fontSize: 14, cursor: 'pointer' }}
                  >
                    Onayla
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => start(async () => { const res = await decideOne(r.id, null, 'reject'); if (!res.error) setDone((d) => ({ ...d, [r.id]: 'reject' })); else setNote(res.error); })}
                    style={{ background: '#fff', color: '#111827', border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 12px', fontSize: 14, cursor: 'pointer' }}
                  >
                    Yok
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {rows.length === 0 ? <p style={{ color: '#5B616E' }}>Kuyruk boş.</p> : null}
    </main>
  );
}
