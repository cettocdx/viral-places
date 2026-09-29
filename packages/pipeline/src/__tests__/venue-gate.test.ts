import { describe, expect, it } from 'vitest';
import { categoryFromTypes } from '../places/google-places';
import { isFoodDrinkPlace, venueGate } from '../venue-gate';

const restaurant = { name: 'Ata Lokantası', types: ['turkish_restaurant', 'restaurant', 'food'], businessStatus: 'OPERATIONAL' };

describe('venueGate', () => {
  it('gerçek bir restoranı geçirir', () => {
    expect(venueGate({ ...restaurant, creatorHandle: 'gencomert' })).toEqual({ ok: true });
  });

  it('semtleri reddeder (canlı veride "Beşiktaş", "İstanbul" mekan olmuştu)', () => {
    expect(venueGate({ name: 'Beşiktaş', types: ['sublocality', 'political'], businessStatus: null })).toMatchObject({ ok: false });
    const r = venueGate({ name: 'İstanbul', types: ['locality', 'political'], businessStatus: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons).toEqual(expect.arrayContaining(['administrative_or_route', 'name_is_district']));
  });

  it('köprü, park, AVM ve mağaza yeme-içme değildir', () => {
    for (const types of [['bridge', 'tourist_attraction'], ['park', 'tourist_attraction'], ['shopping_mall', 'food_court', 'store'], ['electronics_store', 'store']]) {
      expect(venueGate({ name: 'Bir Yer', types, businessStatus: 'OPERATIONAL' }).ok).toBe(false);
    }
  });

  it('kapanmış işletmeyi reddeder', () => {
    expect(venueGate({ ...restaurant, businessStatus: 'CLOSED_PERMANENTLY' }).ok).toBe(false);
  });

  it('mekanın kendi hesabından gelen reklamı reddeder', () => {
    const r = venueGate({ name: 'Kokoreççi Tekin Usta', types: ['restaurant'], businessStatus: 'OPERATIONAL', creatorHandle: 'kokorecitekinusta' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons).toContain('self_promotion');
  });

  it('isFoodDrinkPlace mekan yaratmadan önce aynı kuralı uygular', () => {
    expect(isFoodDrinkPlace(['cafe', 'food'], 'OPERATIONAL')).toBe(true);
    expect(isFoodDrinkPlace(['political', 'locality'], null)).toBe(false);
  });
});

describe('categoryFromTypes', () => {
  it('eşleşmeyen türde varsayılan "food" değil null döner', () => {
    expect(categoryFromTypes(['political', 'locality'])).toBeNull();
    expect(categoryFromTypes(['cafe'])).toBe('coffee');
  });
});
