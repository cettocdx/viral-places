import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  addPlanItem,
  addSave,
  createCollection,
  createPlan,
  deleteCollection,
  deletePlan,
  emptyLibrary,
  ensureDefaultCollection,
  follow,
  removePlanItem,
  removeSave,
  reorderPlanItems,
  unfollow,
  type Collection,
  type Ctx,
  type LibraryState,
  type NewPlanInput,
  type Plan,
} from '@viral-places/domain';
import { newId, nowIso } from '@/lib/ids';
import { zustandSqliteStorage } from '@/lib/kv-storage';

const ctx: Ctx = { now: nowIso, newId };

interface LibraryStore {
  library: LibraryState;
  hydrated: boolean;
  /** Silinen koleksiyon için geri al (§7.5). */
  undoSnapshot: LibraryState | null;
  setHydrated: () => void;
  createCollection: (title: string) => Collection;
  ensureDefaultCollection: (defaultTitle: string) => string;
  save: (venueId: string, collectionId: string) => void;
  unsave: (venueId: string, collectionId?: string) => void;
  deleteCollection: (collectionId: string) => void;
  undoDelete: () => void;
  follow: (creatorId: string) => void;
  unfollow: (creatorId: string) => void;
  createPlan: (input: NewPlanInput) => Plan;
  addToPlan: (planId: string, venueId: string) => boolean;
  removeFromPlan: (planId: string, itemId: string) => void;
  reorderPlan: (planId: string, orderedItemIds: string[], expectedRevision: number) => void;
  deletePlan: (planId: string) => void;
  clearAll: () => void;
}

export const useLibraryStore = create<LibraryStore>()(
  persist(
    (set, get) => ({
      library: emptyLibrary(),
      hydrated: false,
      undoSnapshot: null,
      setHydrated: () => set({ hydrated: true }),
      createCollection: (title) => {
        const r = createCollection(get().library, title, ctx);
        set({ library: r.state });
        return r.collection;
      },
      ensureDefaultCollection: (defaultTitle) => {
        const r = ensureDefaultCollection(get().library, defaultTitle, ctx);
        set({ library: r.state });
        return r.collectionId;
      },
      save: (venueId, collectionId) => set({ library: addSave(get().library, venueId, collectionId, ctx) }),
      unsave: (venueId, collectionId) => set({ library: removeSave(get().library, venueId, collectionId) }),
      deleteCollection: (collectionId) => set({ undoSnapshot: get().library, library: deleteCollection(get().library, collectionId) }),
      undoDelete: () => {
        const snap = get().undoSnapshot;
        if (snap) set({ library: snap, undoSnapshot: null });
      },
      follow: (creatorId) => set({ library: follow(get().library, creatorId, ctx) }),
      unfollow: (creatorId) => set({ library: unfollow(get().library, creatorId) }),
      createPlan: (input) => {
        const r = createPlan(get().library, input, ctx);
        set({ library: r.state });
        return r.plan;
      },
      addToPlan: (planId, venueId) => {
        const r = addPlanItem(get().library, planId, venueId, ctx);
        set({ library: r.state });
        return r.added;
      },
      removeFromPlan: (planId, itemId) => set({ library: removePlanItem(get().library, planId, itemId, ctx) }),
      reorderPlan: (planId, orderedItemIds, expectedRevision) =>
        set({ library: reorderPlanItems(get().library, planId, orderedItemIds, expectedRevision, ctx) }),
      deletePlan: (planId) => set({ library: deletePlan(get().library, planId) }),
      clearAll: () => set({ library: emptyLibrary(), undoSnapshot: null }),
    }),
    {
      name: 'vp.library.guest.v1',
      storage: createJSONStorage(() => zustandSqliteStorage),
      partialize: (s) => ({ library: s.library }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

export const useIsSaved = (venueId: string) => useLibraryStore((s) => s.library.saves.some((x) => x.venueId === venueId));
export const useIsFollowing = (creatorId: string) => useLibraryStore((s) => s.library.follows.some((x) => x.creatorId === creatorId));
