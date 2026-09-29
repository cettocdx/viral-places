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

/**
 * Basılı/seçili durum tonu: aydınlıkta koyu, karanlıkta açık örtü. Sabit koyu rgba karanlık modda görünmüyordu
 * (HIG "Dark Mode": geri bildirim her iki görünümde de algılanmalı).
 */
export function pressedTint(alpha = 0.05): string {
  return isDark() ? `rgba(255, 255, 255, ${alpha + 0.03})` : rgba(c.textPrimary, alpha);
}

/**
 * Tek basılı-durum sözlüğü (apple-design turu, 20.09.2026): iki kalıp var, üçüncüsü yok.
 * 'control' (buton, chip, ikon) küçülür; 'row' (satır, kart, hücre) zemin tonu alır.
 * opacity kullanılmaz: yarı saydam yüzey harita üstünde arkadaki içeriği gösteriyordu.
 */
export function pressFeedback(pressed: boolean, kind: 'control' | 'row' = 'control') {
  if (kind === 'row') return { backgroundColor: pressed ? pressedTint() : 'transparent' };
  return { transform: [{ scale: pressed ? 0.97 : 1 }] };
}

/** Hareket süreleri: token aralığı 160-260 ms (config/design-tokens.json motion). */
export const durations = { fast: 160, base: 200, slow: 260 } as const;

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
