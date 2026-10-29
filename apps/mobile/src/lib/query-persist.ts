import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query';
import { zustandSqliteStorage } from '@/lib/kv-storage';

/**
 * Sorgu önbelleği diskte (29.10.2026, "yüklenme hızı"): şehirler, şehrin mekanları ve mekan detayları cihazda
 * saklanır; uygulama son veriyle anında açılır, sorgular arka planda tazelenir. 7 günden eski kayıt atılır.
 * Kişisel veri yok; yalnız herkese açık API yanıtları.
 */
const KEY = 'vp.query-cache.v1';
const MAX_AGE = 7 * 24 * 3600 * 1000;
const PERSISTED = new Set(['cities', 'city', 'city-places', 'place']);
const MAX_PLACES = 400;

export function restoreQueryCache(client: QueryClient) {
  try {
    const raw = zustandSqliteStorage.getItem(KEY) as string | null;
    if (!raw) return;
    const saved = JSON.parse(raw) as { at: number; state: Parameters<typeof hydrate>[1] };
    if (!saved?.state || Date.now() - saved.at > MAX_AGE) return;
    hydrate(client, saved.state);
  } catch { /* bozuk kayıt: yok say */ }
}

export function persistQueryCache(client: QueryClient) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    timer = null;
    try {
      const places = client.getQueryCache().findAll({ queryKey: ['place'] }).sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt).slice(0, MAX_PLACES);
      const keepPlace = new Set(places.map((q) => q.queryHash));
      const state = dehydrate(client, {
        shouldDehydrateQuery: (q) => q.state.status === 'success' && PERSISTED.has(String(q.queryKey[0])) && (q.queryKey[0] !== 'place' || keepPlace.has(q.queryHash)),
      });
      zustandSqliteStorage.setItem(KEY, JSON.stringify({ at: Date.now(), state }));
    } catch { /* disk dolu vb.: önbellek isteğe bağlı */ }
  };
  return client.getQueryCache().subscribe((e) => {
    if (e.type !== 'updated' || e.action.type !== 'success' || !PERSISTED.has(String(e.query.queryKey[0]))) return;
    if (!timer) timer = setTimeout(save, 2000);
  });
}
