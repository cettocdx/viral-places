import { describe, expect, it } from 'vitest';
import { en } from './en';
import { tr } from './tr';
import { translate } from './index';

describe('i18n', () => {
  it('en has exactly the same keys as tr', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
  });
  it('interpolates params and leaves unknown placeholders visible', () => {
    expect(translate('tr', 'coverage.monitored', { count: 3 })).toBe('3 izlenen creator');
    expect(translate('en', 'explore.searchPlaceholder', {})).toBe('Explore {city}…');
  });
  it('never contains banned superlatives (§2.3)', () => {
    const banned = ['en iyi restoran', 'kesinlikle gitmelisin', '%100 doğrulandı'];
    const all = Object.values(tr).join(' ').toLowerCase();
    for (const b of banned) expect(all.includes(b)).toBe(false);
  });
});
