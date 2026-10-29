import { describe, expect, it } from 'vitest';
import { hhmm, openState, parseOpeningHours } from './opening-hours';

describe('opening hours', () => {
  it('parses day ranges and evaluates open/closed', () => {
    const w = parseOpeningHours('Mo-Fr 09:00-18:00; Sa 10:00-14:00');
    expect(openState(w, { day: 0, minute: 10 * 60 })).toEqual({ open: true, until: 18 * 60 });
    expect(openState(w, { day: 0, minute: 8 * 60 })).toEqual({ open: false, until: 9 * 60 });
    expect(openState(w, { day: 6, minute: 12 * 60 })).toEqual({ open: false, until: null });
  });
  it('handles overnight ranges into the next day', () => {
    const w = parseOpeningHours('Mo-Su 18:00-02:00');
    expect(openState(w, { day: 2, minute: 23 * 60 })?.open).toBe(true);
    expect(openState(w, { day: 3, minute: 60 })).toEqual({ open: true, until: 120 });
  });
  it('knows 24/7 and refuses what it cannot read', () => {
    expect(openState(parseOpeningHours('24/7'), { day: 4, minute: 3 * 60 })?.open).toBe(true);
    expect(parseOpeningHours('Mo-Fr 09:00-18:00; PH off')).toBeNull();
    expect(parseOpeningHours(null)).toBeNull();
    expect(hhmm(23 * 60 + 5)).toBe('23:05');
  });
});
