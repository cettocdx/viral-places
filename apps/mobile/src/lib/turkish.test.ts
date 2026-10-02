import { describe, expect, it } from 'vitest';
import { locativeTr } from './turkish';

describe('locativeTr', () => {
  it('ünlü uyumu ve sert ünsüz', () => {
    expect(locativeTr('İstanbul')).toBe('İstanbul’da');
    expect(locativeTr('Paris')).toBe('Paris’te');
    expect(locativeTr('Londra')).toBe('Londra’da');
    expect(locativeTr('Milano')).toBe('Milano’da');
    expect(locativeTr('Barselona')).toBe('Barselona’da');
    expect(locativeTr('Roma')).toBe('Roma’da');
    expect(locativeTr('İzmir')).toBe('İzmir’de');
  });
});
