import { useQuery } from '@tanstack/react-query';
import type { MapPlacesQuery } from '@viral-places/contracts';
import { apiClient } from './client';

export const queryKeys = {
  city: ['city'] as const,
  map: (q: MapPlacesQuery) => ['map', q] as const,
  place: (id: string) => ['place', id] as const,
  creator: (id: string) => ['creator', id] as const,
  search: (text: string) => ['search', text] as const,
  placesByIds: (ids: string[]) => ['placesByIds', [...ids].sort()] as const,
};

export function useCity() {
  return useQuery({ queryKey: queryKeys.city, queryFn: () => apiClient.getCity(), staleTime: Infinity });
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
  return useQuery({ queryKey: queryKeys.place(id ?? ''), queryFn: () => apiClient.getPlace(id!), enabled: !!id, retry: 1 });
}

export function useCreator(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.creator(id ?? ''), queryFn: () => apiClient.getCreator(id!), enabled: !!id, retry: 1 });
}

export function useSearchPlaces(text: string) {
  return useQuery({ queryKey: queryKeys.search(text), queryFn: () => apiClient.searchPlaces(text), enabled: text.trim().length >= 2 });
}

export function usePlacesByIds(ids: string[]) {
  return useQuery({ queryKey: queryKeys.placesByIds(ids), queryFn: () => apiClient.getPlacesByIds(ids), enabled: ids.length > 0 });
}
