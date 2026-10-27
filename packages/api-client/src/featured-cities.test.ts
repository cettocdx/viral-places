import { describe, expect, it } from 'vitest';
import { FEATURED_CITIES, curateCities } from './featured-cities';

const c = (name: string) => ({ id: name, name });

describe('featured cities', () => {
  it('keeps only the chosen cities, in the chosen order, İstanbul first', () => {
    const out = curateCities([c('Ağrı'), c('Paris'), c('Algora'), c('İstanbul'), c('Riodeva'), c('Firenze')], 'tr');
    expect(out.map((x) => x.name)).toEqual(['İstanbul', 'Paris', 'Floransa']);
  });
  it('localizes names and matches spelling variants', () => {
    expect(curateCities([c('Londra'), c('Barselona'), c('Istanbul')], 'en').map((x) => x.name)).toEqual(['Istanbul', 'London', 'Barcelona']);
  });
  it('lists fifteen cities with İstanbul as the default', () => {
    expect(FEATURED_CITIES).toHaveLength(15);
    expect(FEATURED_CITIES[0]!.key).toBe('istanbul');
  });
});
