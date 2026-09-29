'use client';

import { useState, useTransition } from 'react';
import { decideCreator, type CreatorCandidate } from './actions';

const KIND_LABEL: Record<string, string> = {
  food_reviewer: 'Yemek öneren',
  travel_reviewer: 'Gezi öneren',
  lifestyle: 'Yaşam tarzı',
};

function compact(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export function PeopleClient({ candidates, approvedCount }: { candidates: CreatorCandidate[]; approvedCount: number }) {
  const [pending, start] = useTransition();
  const [decided, setDecided] = useState<Record<string, 'approved' | 'rejected'>>({});
  const [note, setNote] = useState<string | null>(null);
  const approvedNow = approvedCount + Object.values(decided).filter((v) => v === 'approved').length;

  const decide = (id: string, verdict: 'approved' | 'rejected') =>
    start(async () => {
      const r = await decideCreator(id, verdict);
      if (r.error) setNote(r.error);
      else setDecided((d) => ({ ...d, [id]: verdict }));
    });

  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 920, margin: '0 auto', padding: 24, color: '#111827' }}>
      <h1 style={{ fontSize: 26, margin: '0 0 4px' }}>Doğru kişiler</h1>
      <p style={{ color: '#5B616E', margin: '0 0 6px' }}>
        Yalnız burada onayladığın hesapların mekan önerileri uygulamaya girer. Haber, marka, eğlence ve mekanın kendi hesabı otomatik elendi.
      </p>
      <p style={{ color: '#1C7C4A', margin: '0 0 20px', fontWeight: 600 }}>
        {approvedNow} onaylı · {candidates.length - Object.keys(decided).length} aday bekliyor
      </p>
      {note ? <p style={{ color: '#B42318' }}>{note}</p> : null}

      <div style={{ display: 'grid', gap: 12 }}>
        {candidates.map((c) => {
          const d = decided[c.accountId];
          return (
            <div key={c.accountId} style={{ border: '1px solid #E5E7EB', borderRadius: 14, padding: 16, display: 'flex', gap: 14, opacity: d ? 0.45 : 1 }}>
              {c.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.avatarUrl} alt="" width={56} height={56} style={{ borderRadius: 28, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 28, background: '#F2F4F7', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <a href={`https://www.tiktok.com/@${c.handle}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700, fontSize: 17, color: '#111827' }}>
                    @{c.handle}
                  </a>
                  <span style={{ color: '#5B616E', fontSize: 14 }}>{c.displayName}</span>
                  <span style={{ fontSize: 13, color: '#344054', background: '#F2F4F7', borderRadius: 8, padding: '2px 8px' }}>{compact(c.followers)} takipçi</span>
                  <span style={{ fontSize: 13, color: '#344054', background: '#F2F4F7', borderRadius: 8, padding: '2px 8px' }}>{KIND_LABEL[c.kind ?? ''] ?? c.kind}</span>
                  {c.istanbulFocused ? <span style={{ fontSize: 13, color: '#1C7C4A', background: '#E7F6EC', borderRadius: 8, padding: '2px 8px' }}>İstanbul odaklı</span> : null}
                  {(c.followers ?? 0) < 50_000 ? <span style={{ fontSize: 13, color: '#8A6100', background: '#FFF6E0', borderRadius: 8, padding: '2px 8px' }}>50k altı</span> : null}
                </div>
                <div style={{ color: '#344054', fontSize: 14, marginTop: 6 }}>{c.reason}</div>
                <div style={{ color: '#5B616E', fontSize: 13, marginTop: 4 }}>
                  {c.recommendPosts} mekan öneren video · {c.totalPosts} video incelendi
                </div>
                {c.samples.length > 0 ? (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#5B616E', fontSize: 13 }}>
                    {c.samples.map((s, i) => (
                      <li key={i} style={{ marginBottom: 2 }}>{s}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 110, flexShrink: 0 }}>
                {d ? (
                  <span style={{ color: '#5B616E', fontSize: 14, textAlign: 'right' }}>{d === 'approved' ? 'onaylandı' : 'reddedildi'}</span>
                ) : (
                  <>
                    <button type="button" disabled={pending} onClick={() => decide(c.accountId, 'approved')} style={{ background: '#111827', color: '#fff', border: 0, borderRadius: 10, padding: '10px 12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                      Onayla
                    </button>
                    <button type="button" disabled={pending} onClick={() => decide(c.accountId, 'rejected')} style={{ background: '#fff', color: '#111827', border: '1px solid #D0D5DD', borderRadius: 10, padding: '10px 12px', fontSize: 14, cursor: 'pointer' }}>
                      Reddet
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {candidates.length === 0 ? <p style={{ color: '#5B616E' }}>Bekleyen aday yok.</p> : null}
    </main>
  );
}
