// Tek görsel kaynak: config/design-tokens.json (bkz. şartname §6.3).
// Bu paket React Native'e bağımlı değildir; yalnız değer sağlar.
import { designTokens } from './tokens.generated';

export { designTokens };

/** Açık tema temel paleti (config/design-tokens.json). Tip string'e genişletilir: şema değişimi literal tiplerle çelişmesin. */
export type ColorTokens = Record<keyof typeof designTokens.colors, string>;
const lightColors: ColorTokens = { ...designTokens.colors };

/**
 * Karanlık tema (HIG "Dark Mode"): nötrler koyulaşır, vurgular bir ton parlar (koyu zeminde algısal kontrast).
 * Kategori anlamları değişmez; renk tek başına bilgi taşımaz (§6.3).
 */
export const darkColors: ColorTokens = {
  ...lightColors,
  background: '#0B0F14',
  surface: '#161C24',
  textPrimary: '#F2F4F7',
  textSecondary: '#98A2B3',
  primaryAction: '#E7ECF3',
  food: '#5B93FF',
  coffee: '#B08968',
  nightlife: '#A78BFA',
  family: '#F2B544',
  familyText: '#F5C86B',
  culture: '#2FB4B6',
  sightseeing: '#34C08B',
  shopping: '#E36BAE',
  trending: '#FF5A66',
};

export type ColorScheme = 'light' | 'dark';
let activeScheme: ColorScheme = 'light';
const schemeListeners = new Set<(s: ColorScheme) => void>();

/**
 * MUTABLE palet: 39 dosya `colors.x`'i statik import eder; şema değişince değerler yerinde güncellenir,
 * kök layout `key={scheme}` ile yeniden mount ederek tüm bileşenlerin taze değeri okumasını sağlar.
 */
export const colors: ColorTokens = { ...lightColors };

export function applyColorScheme(scheme: ColorScheme): void {
  if (scheme === activeScheme) return;
  activeScheme = scheme;
  Object.assign(colors, scheme === 'dark' ? darkColors : lightColors);
  for (const cb of schemeListeners) cb(scheme);
}

export function currentColorScheme(): ColorScheme {
  return activeScheme;
}

/** Türev değer tutan modüller (ör. mobil theme) şema değişiminde kendini tazelemek için abone olur. */
export function onColorSchemeChange(cb: (s: ColorScheme) => void): () => void {
  schemeListeners.add(cb);
  return () => schemeListeners.delete(cb);
}
export const spacingScale = designTokens.spacing;
export const radius = designTokens.radius;
export const typography = designTokens.typography;
export const dimensions = designTokens.dimensions;
export const motion = designTokens.motion;
export const navigationOrder = designTokens.navigation;

/** 4'lük ızgara adları; şartname aralık sistemi 4,8,12,16,20,24,32. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;
export type SpacingKey = keyof typeof spacing;

export type CategoryKey =
  | 'food'
  | 'coffee'
  | 'nightlife'
  | 'family'
  | 'culture'
  | 'sightseeing'
  | 'shopping';

/** Kategori rengi; renk hiçbir bilginin tek taşıyıcısı olamaz (ikon + metin de gerekir). */
export function categoryColor(category: CategoryKey): string {
  return colors[category];
}

/** Beyaz üstüne yazı için aile/amber tonunun koyu karşılığı. */
export function categoryTextColor(category: CategoryKey): string {
  return category === 'family' ? colors.familyText : colors[category];
}

/** Açık yüzey üstünde yumuşak tint (chip / rozet arka planı). */
export function categoryTint(category: CategoryKey, alpha = 0.12): string {
  return hexToRgba(colors[category], alpha);
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Yükselen/trend vurgusu: kategori rengini silmez, ek sinyal olarak kullanılır. (let: şema değişince tazelenir) */
export let trendingColor = colors.trending;
export let trendingTint = hexToRgba(colors.trending, 0.12);
onColorSchemeChange(() => {
  trendingColor = colors.trending;
  trendingTint = hexToRgba(colors.trending, 0.12);
});

export const shadows = {
  card: '0 1px 2px rgba(17, 24, 39, 0.06)',
  raised: '0 6px 16px rgba(17, 24, 39, 0.10)',
  overlay: '0 10px 28px rgba(17, 24, 39, 0.16)',
} as const;

export const type = {
  screenTitle: { fontSize: typography.screenTitle[0], lineHeight: typography.screenTitle[0] * 1.15, fontWeight: '700', letterSpacing: -0.5 },
  sectionTitle: { fontSize: typography.sectionTitle[0], lineHeight: typography.sectionTitle[0] * 1.25, fontWeight: '700', letterSpacing: -0.3 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: typography.body[0], lineHeight: typography.body[0] * 1.4, fontWeight: '400' },
  bodyStrong: { fontSize: typography.body[0], lineHeight: typography.body[0] * 1.4, fontWeight: '600' },
  helper: { fontSize: typography.helper[1], lineHeight: typography.helper[1] * 1.35, fontWeight: '400' },
  caption: { fontSize: typography.helper[0], lineHeight: typography.helper[0] * 1.35, fontWeight: '500', letterSpacing: 0.1 },
} as const;
