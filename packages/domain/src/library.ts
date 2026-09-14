/**
 * Misafir/yerel kütüphane kuralları: koleksiyon, kaydet, takip, gün planı (§7.5, §19.4, §20, §21.3).
 * Saf fonksiyonlar; depolama ve kimlik üretimi dışarıdan verilir.
 */
import type { IdGenerator } from './ids';

export interface Collection {
  id: string;
  title: string;
  createdAt: string;
  /** İlk sürüm private (§18.2). */
  visibility: 'private';
}

export interface Save {
  id: string;
  venueId: string;
  collectionId: string;
  createdAt: string;
}

export interface Follow {
  creatorId: string;
  createdAt: string;
}

export interface PlanItem {
  id: string;
  venueId: string;
  position: number;
  intendedTime: string | null;
  durationMinutes: number | null;
  note: string | null;
}

export interface Plan {
  id: string;
  title: string;
  cityId: string;
  /** Yerel tarih YYYY-MM-DD; IANA timezone ile birlikte anlamlıdır. */
  dateLocal: string;
  timezone: string;
  revision: number;
  items: PlanItem[];
  createdAt: string;
  updatedAt: string;
}

export interface LibraryState {
  collections: Collection[];
  saves: Save[];
  follows: Follow[];
  plans: Plan[];
  /** Son kullanılan koleksiyon modalda öne gelir (§7.5). */
  lastUsedCollectionId: string | null;
}

export const DEFAULT_COLLECTION_TITLE_KEY = 'library.defaultCollection';

export function emptyLibrary(): LibraryState {
  return { collections: [], saves: [], follows: [], plans: [], lastUsedCollectionId: null };
}

export interface Ctx {
  now: () => string;
  newId: IdGenerator;
}

export class PlanRevisionConflict extends Error {
  readonly code = 'PLAN_REVISION_CONFLICT';
  constructor(readonly expected: number, readonly actual: number) {
    super(`plan revision conflict: expected ${expected}, actual ${actual}`);
  }
}

export function createCollection(state: LibraryState, title: string, ctx: Ctx): { state: LibraryState; collection: Collection } {
  const trimmed = title.trim().slice(0, 80);
  if (!trimmed) throw new Error('COLLECTION_TITLE_REQUIRED');
  const collection: Collection = { id: ctx.newId(), title: trimmed, createdAt: ctx.now(), visibility: 'private' };
  return { state: { ...state, collections: [...state.collections, collection] }, collection };
}

export function ensureDefaultCollection(state: LibraryState, defaultTitle: string, ctx: Ctx): { state: LibraryState; collectionId: string } {
  const existing = state.lastUsedCollectionId
    ? state.collections.find((c) => c.id === state.lastUsedCollectionId)
    : state.collections[0];
  if (existing) return { state, collectionId: existing.id };
  const created = createCollection(state, defaultTitle, ctx);
  return { state: { ...created.state, lastUsedCollectionId: created.collection.id }, collectionId: created.collection.id };
}

/** Aynı mekan aynı koleksiyona iki kez kaydedilmez (idempotent, §19.2 PUT /me/saves). */
export function addSave(state: LibraryState, venueId: string, collectionId: string, ctx: Ctx): LibraryState {
  if (!state.collections.some((c) => c.id === collectionId)) throw new Error('COLLECTION_NOT_FOUND');
  const exists = state.saves.some((s) => s.venueId === venueId && s.collectionId === collectionId);
  const saves = exists ? state.saves : [...state.saves, { id: ctx.newId(), venueId, collectionId, createdAt: ctx.now() }];
  return { ...state, saves, lastUsedCollectionId: collectionId };
}

export function removeSave(state: LibraryState, venueId: string, collectionId?: string): LibraryState {
  return {
    ...state,
    saves: state.saves.filter((s) => !(s.venueId === venueId && (collectionId === undefined || s.collectionId === collectionId))),
  };
}

export function isSaved(state: LibraryState, venueId: string): boolean {
  return state.saves.some((s) => s.venueId === venueId);
}

export function deleteCollection(state: LibraryState, collectionId: string): LibraryState {
  return {
    ...state,
    collections: state.collections.filter((c) => c.id !== collectionId),
    saves: state.saves.filter((s) => s.collectionId !== collectionId),
    lastUsedCollectionId: state.lastUsedCollectionId === collectionId ? null : state.lastUsedCollectionId,
  };
}

/** Uygulama içi takip; platformda follow yapmaz (§20). Tekrar çağrı güvenli. */
export function follow(state: LibraryState, creatorId: string, ctx: Ctx): LibraryState {
  if (state.follows.some((f) => f.creatorId === creatorId)) return state;
  return { ...state, follows: [...state.follows, { creatorId, createdAt: ctx.now() }] };
}

export function unfollow(state: LibraryState, creatorId: string): LibraryState {
  return { ...state, follows: state.follows.filter((f) => f.creatorId !== creatorId) };
}

export function isFollowing(state: LibraryState, creatorId: string): boolean {
  return state.follows.some((f) => f.creatorId === creatorId);
}

export interface NewPlanInput {
  title: string;
  cityId: string;
  dateLocal: string;
  timezone: string;
}

const DATE_LOCAL = /^\d{4}-\d{2}-\d{2}$/;

export function createPlan(state: LibraryState, input: NewPlanInput, ctx: Ctx): { state: LibraryState; plan: Plan } {
  if (!DATE_LOCAL.test(input.dateLocal)) throw new Error('PLAN_DATE_INVALID');
  if (!input.timezone.includes('/')) throw new Error('PLAN_TIMEZONE_INVALID');
  const now = ctx.now();
  const plan: Plan = {
    id: ctx.newId(),
    title: input.title.trim().slice(0, 80) || input.dateLocal,
    cityId: input.cityId,
    dateLocal: input.dateLocal,
    timezone: input.timezone,
    revision: 1,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
  return { state: { ...state, plans: [...state.plans, plan] }, plan };
}

function replacePlan(state: LibraryState, plan: Plan): LibraryState {
  return { ...state, plans: state.plans.map((p) => (p.id === plan.id ? plan : p)) };
}

function requirePlan(state: LibraryState, planId: string): Plan {
  const plan = state.plans.find((p) => p.id === planId);
  if (!plan) throw new Error('PLAN_NOT_FOUND');
  return plan;
}

/** Plan ekleme rezervasyon değildir. Aynı mekan aynı plana iki kez eklenmez. */
export function addPlanItem(state: LibraryState, planId: string, venueId: string, ctx: Ctx): { state: LibraryState; added: boolean } {
  const plan = requirePlan(state, planId);
  if (plan.items.some((i) => i.venueId === venueId)) return { state, added: false };
  const item: PlanItem = {
    id: ctx.newId(),
    venueId,
    position: plan.items.length,
    intendedTime: null,
    durationMinutes: null,
    note: null,
  };
  const next: Plan = { ...plan, items: [...plan.items, item], revision: plan.revision + 1, updatedAt: ctx.now() };
  return { state: replacePlan(state, next), added: true };
}

export function removePlanItem(state: LibraryState, planId: string, itemId: string, ctx: Ctx): LibraryState {
  const plan = requirePlan(state, planId);
  const items = plan.items.filter((i) => i.id !== itemId).map((i, idx) => ({ ...i, position: idx }));
  return replacePlan(state, { ...plan, items, revision: plan.revision + 1, updatedAt: ctx.now() });
}

/** Durak sırası atomik değişir; expectedRevision uyuşmazsa 409 benzeri hata (§19.4). */
export function reorderPlanItems(
  state: LibraryState,
  planId: string,
  orderedItemIds: string[],
  expectedRevision: number,
  ctx: Ctx,
): LibraryState {
  const plan = requirePlan(state, planId);
  if (plan.revision !== expectedRevision) throw new PlanRevisionConflict(expectedRevision, plan.revision);
  const byId = new Map(plan.items.map((i) => [i.id, i]));
  if (orderedItemIds.length !== plan.items.length || orderedItemIds.some((id) => !byId.has(id))) {
    throw new Error('PLAN_ITEMS_MISMATCH');
  }
  const items = orderedItemIds.map((id, idx) => ({ ...byId.get(id)!, position: idx }));
  return replacePlan(state, { ...plan, items, revision: plan.revision + 1, updatedAt: ctx.now() });
}

export function deletePlan(state: LibraryState, planId: string): LibraryState {
  return { ...state, plans: state.plans.filter((p) => p.id !== planId) };
}

/** Farklı ülkelerdeki mekanlar aynı güne eklenince açık uyarı (§7.5). Karar kullanıcıya bırakılır. */
export function planSpansMultipleCountries(plan: Plan, countryByVenue: (venueId: string) => string | null): boolean {
  const codes = new Set(plan.items.map((i) => countryByVenue(i.venueId)).filter((c): c is string => !!c));
  return codes.size > 1;
}
