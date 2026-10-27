/**
 * Geometry for the map callout (ADR-020): the card floats above its pin with a tail pointing at it,
 * as in the Places, Map & Pins reference. Pure functions so the edge cases are unit-tested.
 */

export interface ScreenPoint {
  x: number;
  y: number;
}

/** Side margin kept between the card and the screen edge. */
export const CALLOUT_EDGE = 16;
/** Gap between the tail tip and the top of the pin artwork. */
export const CALLOUT_PIN_GAP = 4;
/** The category badge rides on the card's top edge; keep it clear of the header chips. */
export const CALLOUT_BADGE_ALLOWANCE = 24;

export function calloutWidth(screenWidth: number): number {
  return Math.round(Math.min(360, Math.max(260, screenWidth * 0.84)));
}

/** Tallest card that still leaves its pin visible between the header and the bottom chrome. */
export function calloutMaxHeight(input: { screenHeight: number; topInset: number; bottomInset: number; pinExtent: number; tailHeight: number }): number {
  const { screenHeight, topInset, bottomInset, pinExtent, tailHeight } = input;
  return Math.max(220, screenHeight - topInset - CALLOUT_BADGE_ALLOWANCE - bottomInset - pinExtent * 2 - tailHeight - CALLOUT_PIN_GAP - 24);
}

/** Screen y where the pin must sit so the whole card fits under the header. */
export function targetPinY(input: { topInset: number; cardHeight: number; pinExtent: number; tailHeight: number }): number {
  return input.topInset + CALLOUT_BADGE_ALLOWANCE + input.cardHeight + input.tailHeight + CALLOUT_PIN_GAP + input.pinExtent;
}

/**
 * Card frame for a pin at `point`. The card is centred on the pin but kept on screen; the tail keeps
 * pointing at the pin even when the card is pushed sideways, within the card's rounded corners.
 */
export function calloutFrame(input: { point: ScreenPoint; screenWidth: number; cardWidth: number; cardHeight: number; pinExtent: number; tailHeight: number; tailWidth: number; cornerRadius: number }): { left: number; top: number; tailX: number } {
  const { point, screenWidth, cardWidth, cardHeight, pinExtent, tailHeight, tailWidth, cornerRadius } = input;
  const left = Math.min(Math.max(point.x - cardWidth / 2, CALLOUT_EDGE), Math.max(CALLOUT_EDGE, screenWidth - CALLOUT_EDGE - cardWidth));
  const minTail = cornerRadius + tailWidth / 2;
  const tailX = Math.min(Math.max(point.x - left, minTail), cardWidth - minTail);
  const top = point.y - pinExtent - CALLOUT_PIN_GAP - tailHeight - cardHeight;
  return { left, top, tailX };
}

/** Pin is far enough inside the map to anchor a card; otherwise the card hides until the pin is back. */
export function pointIsAnchorable(point: ScreenPoint | null, size: { width: number; height: number }): point is ScreenPoint {
  return !!point && point.x >= 0 && point.x <= size.width && point.y >= 0 && point.y <= size.height;
}

/** Sum of accessible counters (decimal strings); null when no source exposes the counter (null ≠ 0). */
export function sumCounters(values: ReadonlyArray<string | null | undefined>): number | null {
  let total = 0;
  let seen = false;
  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    total += n;
    seen = true;
  }
  return seen ? total : null;
}
