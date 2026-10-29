import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Category } from '@viral-places/domain';
import { zustandSqliteStorage } from '@/lib/kv-storage';

export type VisitStatus = 'want' | 'been';

interface VisitsStore {
  /** Mekan başına kullanıcının izi: gideceğim / gittim (cihazda; hesapla eşitleme sonra). */
  visits: Record<string, { status: VisitStatus; at: string }>;
  /** İlk açılıştaki zevk seçimi; akış bu kategorileri öne alır. */
  tastes: Category[];
  onboarded: boolean;
  hydrated: boolean;
  setVisit: (venueId: string, status: VisitStatus | null) => void;
  setTastes: (tastes: Category[]) => void;
  finishOnboarding: () => void;
  setHydrated: () => void;
}

export const useVisitsStore = create<VisitsStore>()(
  persist(
    (set, get) => ({
      visits: {},
      tastes: [],
      onboarded: false,
      hydrated: false,
      setVisit: (venueId, status) => {
        const next = { ...get().visits };
        if (status && next[venueId]?.status !== status) next[venueId] = { status, at: new Date().toISOString() };
        else delete next[venueId];
        set({ visits: next });
      },
      setTastes: (tastes) => set({ tastes }),
      finishOnboarding: () => set({ onboarded: true }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'vp.visits.v1',
      storage: createJSONStorage(() => zustandSqliteStorage),
      partialize: (s) => ({ visits: s.visits, tastes: s.tastes, onboarded: s.onboarded }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

export const useVisit = (venueId: string) => useVisitsStore((s) => s.visits[venueId]?.status ?? null);
