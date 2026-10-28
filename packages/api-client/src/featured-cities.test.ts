import { describe, expect, it } from 'vitest';
import { FEATURED_CITIES, curateCities, isFeaturedCityName } from './featured-cities';

const c = (name: string, placeCount = 1) => ({ id: name, name, placeCount });

describe('featured cities', () => {
  it('puts the chosen cities first, in the chosen order, İstanbul first', () => {
    const out = curateCities([c('Ağrı'), c('Paris'), c('Algora'), c('İstanbul'), c('Riodeva'), c('Firenze')], 'tr');
    expect(out.slice(0, 3).map((x) => x.name)).toEqual(['İstanbul', 'Paris', 'Floransa']);
  });
  it('then lists other cities with places, most places first, and drops empty ones', () => {
    const out = curateCities([c('Bodrum', 1), c('Chicago', 7), c('Paris', 38), c('Empty', 0), c('Adana', 1)], 'tr');
    expect(out.map((x) => x.name)).toEqual(['Paris', 'Chicago', 'Adana', 'Bodrum']);
  });
  it('localizes names and matches spelling variants', () => {
    expect(curateCities([c('Londra'), c('Barselona'), c('Istanbul')], 'en').map((x) => x.name)).toEqual(['Istanbul', 'London', 'Barcelona']);
  });
  it('recognizes featured labels in both languages', () => {
    expect(isFeaturedCityName('Floransa')).toBe(true);
    expect(isFeaturedCityName('London')).toBe(true);
    expect(isFeaturedCityName('Chicago')).toBe(false);
  });
  it('lists fifteen cities with İstanbul as the default', () => {
    expect(FEATURED_CITIES).toHaveLength(15);
    expect(FEATURED_CITIES[0]!.key).toBe('istanbul');
  });
});
