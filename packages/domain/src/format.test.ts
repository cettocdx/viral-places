import { describe, expect, it } from 'vitest';
import { ageHours, formatCompactCount, formatDistanceLabel } from './format';
import { bboxContains, haversineMeters } from './geo';

describe('formatCompactCount', () => {
  it('keeps null (no data) distinct from "0" (real zero)', () => {
    expect(formatCompactCount(null, 'tr')).toBeNull();
    expect(formatCompactCount('0', 'tr')).toBe('0');
  });
  it('formats decimal strings without converting big IDs elsewhere', () => {
    expect(formatCompactCount('3200000', 'tr')).toBe('3,2M');
    expect(formatCompactCount('3200000', 'en')).toBe('3.2M');
    expect(formatCompactCount('12400', 'tr')).toBe('12,4K');
    expect(formatCompactCount(999, 'tr')).toBe('999');
  });
});

describe('distance', () => {
  it('rounds to 50 m steps below 1 km and labels bird-eye distance', () => {
    expect(formatDistanceLabel(137, 'tr')).toBe('150 m');
    expect(formatDistanceLabel(1234, 'tr')).toBe('1,2 km');
  });
  it('haversine between Karaköy and Kadıköy is a few km', () => {
    const d = haversineMeters({ lat: 41.0236, lng: 28.977 }, { lat: 40.982, lng: 29.025 });
    expect(d).toBeGreaterThan(5000);
    expect(d).toBeLessThan(8000);
  });
  it('bbox with antimeridian is split into two ranges', () => {
    expect(bboxContains({ west: 170, south: -10, east: -170, north: 10 }, { lat: 0, lng: 179 })).toBe(true);
    expect(bboxContains({ west: 170, south: -10, east: -170, north: 10 }, { lat: 0, lng: 0 })).toBe(false);
  });
});

describe('ageHours', () => {
  it('computes hours and never returns negative', () => {
    expect(ageHours('2026-09-11T08:00:00Z', '2026-09-11T09:00:00Z')).toBe(1);
    expect(ageHours('2026-09-11T10:00:00Z', '2026-09-11T09:00:00Z')).toBe(0);
  });
});
