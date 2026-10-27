import { describe, expect, it } from 'vitest';
import { CALLOUT_BADGE_ALLOWANCE, CALLOUT_EDGE, CALLOUT_PIN_GAP, calloutFrame, calloutMaxHeight, calloutWidth, pointIsAnchorable, sumCounters, targetPinY } from './callout-layout';

const base = { screenWidth: 402, cardWidth: 338, cardHeight: 400, pinExtent: 40, tailHeight: 14, tailWidth: 30, cornerRadius: 30 };

describe('map callout geometry', () => {
  it('centres the card above the pin with the tail on the pin', () => {
    const f = calloutFrame({ ...base, point: { x: 201, y: 600 } });
    expect(f.left).toBe(32);
    expect(f.tailX).toBe(169);
    expect(f.top).toBe(600 - 40 - CALLOUT_PIN_GAP - 14 - 400);
  });
  it('keeps the card on screen near an edge while the tail still points at the pin', () => {
    const f = calloutFrame({ ...base, point: { x: 60, y: 600 } });
    expect(f.left).toBe(CALLOUT_EDGE);
    expect(f.tailX).toBe(45);
    const right = calloutFrame({ ...base, point: { x: 395, y: 600 } });
    expect(right.left).toBe(402 - CALLOUT_EDGE - 338);
    expect(right.tailX).toBe(338 - 45);
  });
  it('places the pin low enough for the card to clear the header', () => {
    const y = targetPinY({ topInset: 120, cardHeight: 400, pinExtent: 40, tailHeight: 14 });
    const f = calloutFrame({ ...base, point: { x: 201, y } });
    expect(f.top).toBe(120 + CALLOUT_BADGE_ALLOWANCE);
  });
  it('caps the card height and never returns an unusable size', () => {
    expect(calloutMaxHeight({ screenHeight: 874, topInset: 120, bottomInset: 90, pinExtent: 40, tailHeight: 14 })).toBe(874 - 120 - CALLOUT_BADGE_ALLOWANCE - 90 - 80 - 14 - CALLOUT_PIN_GAP - 24);
    expect(calloutMaxHeight({ screenHeight: 400, topInset: 200, bottomInset: 200, pinExtent: 40, tailHeight: 14 })).toBe(220);
  });
  it('sizes the card from the screen width within bounds', () => {
    expect(calloutWidth(402)).toBe(338);
    expect(calloutWidth(1024)).toBe(360);
    expect(calloutWidth(280)).toBe(260);
  });
  it('only anchors to pins inside the map', () => {
    expect(pointIsAnchorable({ x: 10, y: 10 }, { width: 100, height: 100 })).toBe(true);
    expect(pointIsAnchorable({ x: -1, y: 10 }, { width: 100, height: 100 })).toBe(false);
    expect(pointIsAnchorable(null, { width: 100, height: 100 })).toBe(false);
  });
  it('sums only the counters a source exposes', () => {
    expect(sumCounters(['23427', null, '100'])).toBe(23527);
    expect(sumCounters([null, undefined])).toBeNull();
    expect(sumCounters(['0'])).toBe(0);
  });
});
