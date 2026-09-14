/**
 * Tek görsel kaynak: @viral-places/design-tokens (config/design-tokens.json).
 * Ekranlar bileşenleri, bileşenler tokenları import eder. Hex değer burada tanımlanmaz.
 */
export {
  colors,
  spacing,
  radius,
  type,
  shadows,
  motion,
  dimensions,
  categoryColor,
  categoryTextColor,
  categoryTint,
  trendingColor,
  trendingTint,
  hexToRgba,
} from '@viral-places/design-tokens';
import { colors as c, hexToRgba as rgba } from '@viral-places/design-tokens';

/** Açık gri hairline; "her satırı ayrı kart" yerine gruplama için. */
export const hairline = rgba(c.textPrimary, 0.08);
export const surfaceMuted = rgba(c.textPrimary, 0.04);
export const overlayScrim = rgba(c.textPrimary, 0.35);
export const onDark = c.surface;
