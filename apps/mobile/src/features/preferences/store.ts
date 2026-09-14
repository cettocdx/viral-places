import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandSqliteStorage } from '@/lib/kv-storage';
import type { Locale } from '@/i18n';

interface PreferencesStore {
  locale: Locale;
  distanceUnit: 'km' | 'mi';
  /** Son seçilen şehir; konum izni yoksa harita buradan açılır (§7.2). */
  lastCityId: string | null;
  hydrated: boolean;
  setLocale: (l: Locale) => void;
  setDistanceUnit: (u: 'km' | 'mi') => void;
  setLastCityId: (id: string) => void;
  setHydrated: () => void;
}

export const usePreferences = create<PreferencesStore>()(
  persist(
    (set) => ({
      locale: 'tr',
      distanceUnit: 'km',
      lastCityId: null,
      hydrated: false,
      setLocale: (locale) => set({ locale }),
      setDistanceUnit: (distanceUnit) => set({ distanceUnit }),
      setLastCityId: (lastCityId) => set({ lastCityId }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'vp.preferences.v1',
      storage: createJSONStorage(() => zustandSqliteStorage),
      partialize: (s) => ({ locale: s.locale, distanceUnit: s.distanceUnit, lastCityId: s.lastCityId }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
