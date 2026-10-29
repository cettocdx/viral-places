import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { MapPlacesQuery, SourcePostDto } from '@viral-places/contracts';
import { bboxForCity } from '@viral-places/api-client';
import { usePreferences } from '@/features/preferences/store';
import { apiClient } from './client';
import { appConfig } from '@/lib/config';
import { sourcePlayback } from '@/lib/source-playback';

/**
 * Yalnız kalıcı depoda dosyası olan videolar gösterilir (ürün sahibi, 29.10.2026): TikTok oynatıcısı, bağlantısı
 * ya da işareti hiçbir yerde çıkmaz; dosyası olmayan kaynak uygulamada yoktur.
 */
export function hasStoredVideo(post: SourcePostDto): boolean {
  return !appConfig.playStoredVideoFiles || sourcePlayback(post, { preferFile: true }).kind === 'video';
}

export const queryKeys = {
  cities: ['cities'] as const,
  city: (id: string | null) => ['city', id] as const,
  map: (q: MapPlacesQuery) => ['map', q] as const,
  place: (id: string) => ['place', id] as const,
  creator: (id: string) => ['creator', id] as const,
  search: (text: string, cityId: string | null) => ['search', cityId, text] as const,
  placesByIds: (ids: string[]) => ['placesByIds', [...ids].sort()] as const,
};

export function useCities() {
  return useQuery({ queryKey: queryKeys.cities, queryFn: () => apiClient.getCities(), staleTime: 10 * 60_000 });
}

/** Seçili şehir (tercihlerdeki lastCityId); yoksa kapsamı olan ilk şehir. */
export function useCity() {
  const cityId = usePreferences((s) => s.lastCityId);
  return useQuery({ queryKey: queryKeys.city(cityId), queryFn: () => apiClient.getCity(cityId), staleTime: 10 * 60_000 });
}

/** Kamera hareketi bitince çağrılır; anahtar bbox/zoom/kategori/filtre içerir (§21.1). */
export function useMapPlaces(query: MapPlacesQuery | null) {
  return useQuery({
    queryKey: query ? queryKeys.map(query) : ['map', 'idle'],
    queryFn: () => apiClient.getMapPlaces(query!),
    enabled: query !== null,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}

export function usePlace(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.place(id ?? ''), queryFn: () => apiClient.getPlace(id!), enabled: !!id, retry: 1, staleTime: 5 * 60_000, select: (d) => ({ ...d, sources: d.sources.filter(hasStoredVideo) }) });
}

export function useCreator(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.creator(id ?? ''), queryFn: () => apiClient.getCreator(id!), enabled: !!id, retry: 1, select: (d) => ({ ...d, posts: d.posts.filter(hasStoredVideo) }) });
}

export function useSearchPlaces(text: string) {
  const cityId = usePreferences((s) => s.lastCityId);
  return useQuery({ queryKey: queryKeys.search(text, cityId), queryFn: () => apiClient.searchPlaces(text, cityId), enabled: text.trim().length >= 2 });
}

export function usePlacesByIds(ids: string[]) {
  return useQuery({ queryKey: queryKeys.placesByIds(ids), queryFn: () => apiClient.getPlacesByIds(ids), enabled: ids.length > 0 });
}

/**
 * Follow suggestions (ADR-025): creators behind the current city's venues, ranked by how many venues they shared.
 * Real data only — the first venues on the map and their sources; nothing invented.
 */
export function useSuggestedCreators(cityId: string | undefined) {
  return useQuery({
    queryKey: ['suggested-creators', cityId ?? ''],
    enabled: !!cityId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const city = await apiClient.getCity(cityId);
      const map = await apiClient.getMapPlaces({ bbox: bboxForCity(city), zoom: 12, categories: [], trendingOnly: false, familyOnly: false, locale: 'tr', limit: 60 });
      const ids = map.items.filter((i) => i.type === 'place').slice(0, 14).map((i) => i.id);
      const details = await Promise.allSettled(ids.map((id) => apiClient.getPlace(id)));
      const byId = new Map<string, { creator: SourcePostDto['creator']; places: { id: string; name: string; thumb: string | null }[] }>();
      for (const d of details) {
        if (d.status !== 'fulfilled') continue;
        for (const src of d.value.sources) {
          const entry = byId.get(src.creator.id) ?? { creator: src.creator, places: [] };
          if (!entry.places.some((p) => p.id === d.value.id)) entry.places.push({ id: d.value.id, name: d.value.name, thumb: src.media.mode !== 'unavailable' ? src.media.thumbnailUrl : null });
          byId.set(src.creator.id, entry);
        }
      }
      return [...byId.values()].sort((a, b) => b.places.length - a.places.length).slice(0, 8);
    },
  });
}

/**
 * Ekrandaki mekanların detayı (ve video adresi) önceden çekilir: karta dokununca video beklemeden başlar
 * (ürün sahibi, 29.10.2026: "çok hızlı açılmalı"). Merkeze en yakın `limit` mekan; zaten önbellekte olan atlanır.
 */
export function usePrefetchPlaces(items: { id: string; location: { lat: number; lng: number } }[], center: { lat: number; lng: number } | null, limit = 24) {
  const client = useQueryClient();
  useEffect(() => {
    if (!center || items.length === 0) return;
    const near = [...items].sort((a, b) => (a.location.lat - center.lat) ** 2 + (a.location.lng - center.lng) ** 2 - ((b.location.lat - center.lat) ** 2 + (b.location.lng - center.lng) ** 2)).slice(0, limit);
    for (const it of near) void client.prefetchQuery({ queryKey: queryKeys.place(it.id), queryFn: () => apiClient.getPlace(it.id), staleTime: 5 * 60_000 });
  }, [client, items, center?.lat, center?.lng, limit]);
}
