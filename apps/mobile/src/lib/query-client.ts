import { QueryClient } from '@tanstack/react-query';
import { persistQueryCache, restoreQueryCache } from './query-persist';

export const queryClient = new QueryClient({
  defaultOptions: {
    // gcTime ≥ disk önbelleğinin ömrü: geri yüklenen veri kullanılmadan silinmesin.
    queries: { staleTime: 5 * 60_000, gcTime: 24 * 3600 * 1000, retry: 3, retryDelay: (n) => Math.min(800 * 2 ** n, 6000), refetchOnWindowFocus: false },
  },
});
restoreQueryCache(queryClient);
persistQueryCache(queryClient);
