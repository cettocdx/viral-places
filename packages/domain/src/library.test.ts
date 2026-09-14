import { describe, expect, it } from 'vitest';
import {
  addPlanItem,
  addSave,
  createCollection,
  createPlan,
  emptyLibrary,
  ensureDefaultCollection,
  follow,
  isFollowing,
  isSaved,
  PlanRevisionConflict,
  removeSave,
  reorderPlanItems,
  unfollow,
  type Ctx,
} from './library';

function ctx(): Ctx {
  let n = 0;
  return { now: () => '2026-09-11T09:00:00Z', newId: () => `id-${++n}` };
}

describe('library: saves', () => {
  it('saving the same venue twice into the same collection is idempotent', () => {
    const c = ctx();
    let s = emptyLibrary();
    const created = createCollection(s, 'Kaydedilenler', c);
    s = created.state;
    s = addSave(s, 'venue-1', created.collection.id, c);
    s = addSave(s, 'venue-1', created.collection.id, c);
    expect(s.saves).toHaveLength(1);
    expect(isSaved(s, 'venue-1')).toBe(true);
    expect(s.lastUsedCollectionId).toBe(created.collection.id);
  });

  it('removeSave clears the save', () => {
    const c = ctx();
    let s = emptyLibrary();
    const d = ensureDefaultCollection(s, 'Kaydedilenler', c);
    s = addSave(d.state, 'venue-1', d.collectionId, c);
    s = removeSave(s, 'venue-1');
    expect(isSaved(s, 'venue-1')).toBe(false);
  });

  it('saving into an unknown collection throws', () => {
    expect(() => addSave(emptyLibrary(), 'v', 'nope', ctx())).toThrow('COLLECTION_NOT_FOUND');
  });
});

describe('library: follows', () => {
  it('follow is idempotent and unfollow reverses it', () => {
    const c = ctx();
    let s = follow(emptyLibrary(), 'creator-1', c);
    s = follow(s, 'creator-1', c);
    expect(s.follows).toHaveLength(1);
    expect(isFollowing(s, 'creator-1')).toBe(true);
    s = unfollow(s, 'creator-1');
    expect(isFollowing(s, 'creator-1')).toBe(false);
  });
});

describe('library: plans', () => {
  it('creates a plan with local date + IANA timezone and revision 1', () => {
    const { plan } = createPlan(emptyLibrary(), { title: 'Cumartesi', cityId: 'city-ist', dateLocal: '2026-09-13', timezone: 'Europe/Istanbul' }, ctx());
    expect(plan.revision).toBe(1);
    expect(plan.timezone).toBe('Europe/Istanbul');
  });

  it('rejects invalid local date or timezone', () => {
    expect(() => createPlan(emptyLibrary(), { title: '', cityId: 'c', dateLocal: '13/09/2026', timezone: 'Europe/Istanbul' }, ctx())).toThrow('PLAN_DATE_INVALID');
    expect(() => createPlan(emptyLibrary(), { title: '', cityId: 'c', dateLocal: '2026-09-13', timezone: 'UTC+3' }, ctx())).toThrow('PLAN_TIMEZONE_INVALID');
  });

  it('adding the same venue twice does not duplicate; each mutation bumps revision', () => {
    const c = ctx();
    const created = createPlan(emptyLibrary(), { title: 'x', cityId: 'c', dateLocal: '2026-09-13', timezone: 'Europe/Istanbul' }, c);
    let s = created.state;
    let r = addPlanItem(s, created.plan.id, 'v1', c);
    expect(r.added).toBe(true);
    r = addPlanItem(r.state, created.plan.id, 'v1', c);
    expect(r.added).toBe(false);
    s = addPlanItem(r.state, created.plan.id, 'v2', c).state;
    const plan = s.plans[0]!;
    expect(plan.items.map((i) => i.venueId)).toEqual(['v1', 'v2']);
    expect(plan.revision).toBe(3);
  });

  it('reorder with stale expectedRevision throws PLAN_REVISION_CONFLICT (no silent last-writer-wins)', () => {
    const c = ctx();
    const created = createPlan(emptyLibrary(), { title: 'x', cityId: 'c', dateLocal: '2026-09-13', timezone: 'Europe/Istanbul' }, c);
    let s = addPlanItem(created.state, created.plan.id, 'v1', c).state;
    s = addPlanItem(s, created.plan.id, 'v2', c).state;
    const plan = s.plans[0]!;
    const ids = plan.items.map((i) => i.id);
    expect(() => reorderPlanItems(s, plan.id, [ids[1]!, ids[0]!], 1, c)).toThrow(PlanRevisionConflict);
    const next = reorderPlanItems(s, plan.id, [ids[1]!, ids[0]!], plan.revision, c);
    expect(next.plans[0]!.items.map((i) => i.venueId)).toEqual(['v2', 'v1']);
    expect(next.plans[0]!.items.map((i) => i.position)).toEqual([0, 1]);
  });
});
