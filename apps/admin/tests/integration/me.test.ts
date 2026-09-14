import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as colGet, POST as colPost } from '@/app/api/v1/me/collections/route';
import { DELETE as saveDel, GET as saveGet, POST as savePost } from '@/app/api/v1/me/saves/route';
import { DELETE as folDel, GET as folGet, POST as folPost } from '@/app/api/v1/me/follows/route';
import { GET as plansGet, POST as plansPost } from '@/app/api/v1/me/plans/route';
import { GET as planGet, PATCH as planPatch, DELETE as planDel } from '@/app/api/v1/me/plans/[id]/route';
import { POST as itemPost, PUT as itemsPut } from '@/app/api/v1/me/plans/[id]/items/route';
import { CREATOR_A, VENUE_PUBLISHED, VENUE_PUBLISHED_2, VENUE_UNPUBLISHED, call, createTestUser, deleteTestUser, type TestUser } from './helpers';

let A: TestUser;
let B: TestUser;
beforeAll(async () => {
  [A, B] = await Promise.all([createTestUser('a'), createTestUser('b')]);
});
afterAll(async () => {
  await Promise.all([A, B].filter(Boolean).map(deleteTestUser));
});

describe('me/* (kullanıcı JWT, RLS)', () => {
  it('token yoksa 401; bozuk token 401', async () => {
    expect((await call(colGet, { path: '/api/v1/me/collections' })).status).toBe(401);
    expect((await call(colGet, { path: '/api/v1/me/collections', token: 'garbage' })).status).toBe(401);
  });

  it('koleksiyon + kaydet; B, A verisini göremez ve A koleksiyonuna yazamaz', async () => {
    const c = await call(colPost, { method: 'POST', path: '/api/v1/me/collections', token: A.token, body: { title: 'Kahve' } });
    expect(c.status).toBe(201);
    const collectionId = c.json.id as string;

    const s = await call(savePost, { method: 'POST', path: '/api/v1/me/saves', token: A.token, body: { venueId: VENUE_PUBLISHED, collectionId } });
    expect(s.status).toBe(201);
    const again = await call(savePost, { method: 'POST', path: '/api/v1/me/saves', token: A.token, body: { venueId: VENUE_PUBLISHED, collectionId } });
    expect(again.status).toBe(201); // idempotent upsert

    const unpub = await call(savePost, { method: 'POST', path: '/api/v1/me/saves', token: A.token, body: { venueId: VENUE_UNPUBLISHED, collectionId } });
    expect(unpub.status).toBe(403);

    const list = await call(saveGet, { path: '/api/v1/me/saves', token: A.token });
    expect(list.json.items.length).toBe(1);
    expect(list.json.items[0].place.id).toBe(VENUE_PUBLISHED);

    const bList = await call(colGet, { path: '/api/v1/me/collections', token: B.token });
    expect(bList.json.items).toEqual([]);
    const bWrite = await call(savePost, { method: 'POST', path: '/api/v1/me/saves', token: B.token, body: { venueId: VENUE_PUBLISHED, collectionId } });
    expect(bWrite.status).toBe(403);
    const bDel = await call(saveDel, { method: 'DELETE', path: '/api/v1/me/saves', token: B.token, body: { venueId: VENUE_PUBLISHED } });
    expect(bDel.status).toBe(404);

    const aCols = await call(colGet, { path: '/api/v1/me/collections', token: A.token });
    expect(aCols.json.items[0].placeCount).toBe(1);
    const del = await call(saveDel, { method: 'DELETE', path: '/api/v1/me/saves', token: A.token, body: { venueId: VENUE_PUBLISHED } });
    expect(del.json.removed).toBe(1);
  });

  it('takip: ekle/listele/kaldır; doğrulama 422', async () => {
    expect((await call(folPost, { method: 'POST', path: '/api/v1/me/follows', token: A.token, body: { creatorId: CREATOR_A } })).status).toBe(201);
    const l = await call(folGet, { path: '/api/v1/me/follows', token: A.token });
    expect(l.json.items.map((i: any) => i.creatorId)).toEqual([CREATOR_A]);
    expect((await call(folGet, { path: '/api/v1/me/follows', token: B.token })).json.items).toEqual([]);
    expect((await call(folPost, { method: 'POST', path: '/api/v1/me/follows', token: A.token, body: { creatorId: 'x' } })).status).toBe(422);
    expect((await call(folDel, { method: 'DELETE', path: '/api/v1/me/follows', token: A.token, body: { creatorId: CREATOR_A } })).status).toBe(200);
  });

  it('plan: revision çakışması 409; öğe ekleme/sıralama revision artırır; B erişemez', async () => {
    const p = await call(plansPost, { method: 'POST', path: '/api/v1/me/plans', token: A.token, body: { title: 'Cumartesi', dateLocal: '2026-09-13', timezone: 'Europe/Istanbul' } });
    expect(p.status).toBe(201);
    const id = p.json.id as string;
    expect(p.json.revision).toBe(1);

    const stale = await call(planPatch, { method: 'PATCH', path: `/api/v1/me/plans/${id}`, token: A.token, params: { id }, body: { expectedRevision: 5, title: 'X' } });
    expect(stale.status).toBe(409);
    expect(stale.json.error.code).toBe('PLAN_REVISION_CONFLICT');
    const okPatch = await call(planPatch, { method: 'PATCH', path: `/api/v1/me/plans/${id}`, token: A.token, params: { id }, body: { expectedRevision: 1, title: 'Cumartesi kahve' } });
    expect(okPatch.status).toBe(200);
    expect(okPatch.json.revision).toBe(2);

    const i1 = await call(itemPost, { method: 'POST', path: `/api/v1/me/plans/${id}/items`, token: A.token, params: { id }, body: { venueId: VENUE_PUBLISHED, expectedRevision: 2 } });
    expect(i1.status).toBe(201);
    expect(i1.json.position).toBe(0);
    const i2 = await call(itemPost, { method: 'POST', path: `/api/v1/me/plans/${id}/items`, token: A.token, params: { id }, body: { venueId: VENUE_PUBLISHED_2, expectedRevision: 3 } });
    expect(i2.json.position).toBe(1);

    const badReorder = await call(itemsPut, { method: 'PUT', path: `/api/v1/me/plans/${id}/items`, token: A.token, params: { id }, body: { orderedItemIds: [i2.json.id, i1.json.id], expectedRevision: 3 } });
    expect(badReorder.status).toBe(409);
    const reorder = await call(itemsPut, { method: 'PUT', path: `/api/v1/me/plans/${id}/items`, token: A.token, params: { id }, body: { orderedItemIds: [i2.json.id, i1.json.id], expectedRevision: 4 } });
    expect(reorder.status).toBe(200);
    expect(reorder.json.revision).toBe(5);

    const detail = await call(planGet, { path: `/api/v1/me/plans/${id}`, token: A.token, params: { id } });
    expect(detail.json.items.map((i: any) => i.venueId)).toEqual([VENUE_PUBLISHED_2, VENUE_PUBLISHED]);

    expect((await call(planGet, { path: `/api/v1/me/plans/${id}`, token: B.token, params: { id } })).status).toBe(404);
    expect((await call(itemsPut, { method: 'PUT', path: `/api/v1/me/plans/${id}/items`, token: B.token, params: { id }, body: { orderedItemIds: [], expectedRevision: 5 } })).status).toBe(404);
    expect((await call(plansGet, { path: '/api/v1/me/plans', token: B.token })).json.items).toEqual([]);
    expect((await call(planDel, { method: 'DELETE', path: `/api/v1/me/plans/${id}`, token: A.token, params: { id } })).status).toBe(200);
  });
});
