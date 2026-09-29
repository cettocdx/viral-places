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
import { colors as c, hexToRgba as rgba, onColorSchemeChange, currentColorScheme } from '@viral-places/design-tokens';

function isDark(): boolean {
  return currentColorScheme() === 'dark';
}

/** Hairline/scrim: karanlık modda beyaz tabanlı düşük alfa (HIG: koyu zeminde ayrım açık çizgiyle). let: şema değişince tazelenir. */
export let hairline = rgba(c.textPrimary, 0.08);
export let surfaceMuted = rgba(c.textPrimary, 0.04);
export let overlayScrim = 'rgba(0, 0, 0, 0.35)';
export let onDark = c.surface;
onColorSchemeChange(() => {
  hairline = isDark() ? 'rgba(255, 255, 255, 0.10)' : rgba(c.textPrimary, 0.08);
  surfaceMuted = isDark() ? 'rgba(255, 255, 255, 0.06)' : rgba(c.textPrimary, 0.04);
  overlayScrim = isDark() ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.35)';
  onDark = isDark() ? c.textPrimary : c.surface;
});
