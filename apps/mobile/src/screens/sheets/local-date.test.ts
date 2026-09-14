import { describe, expect, it } from 'vitest';
import { localDateInTimezone } from './local-date';

describe('localDateInTimezone', () => {
  it('uses the city timezone, not UTC (22:30Z is next day in Istanbul)', () => {
    const now = new Date('2026-09-11T22:30:00Z');
    expect(localDateInTimezone('Europe/Istanbul', now)).toBe('2026-09-12');
    expect(localDateInTimezone('UTC', now)).toBe('2026-09-11');
    expect(localDateInTimezone('America/Los_Angeles', now)).toBe('2026-09-11');
  });
});
