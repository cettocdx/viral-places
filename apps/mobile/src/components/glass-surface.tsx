import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { colors, mapTheme, shadows } from '@/theme';
import { currentColorScheme } from '@viral-places/design-tokens';

/**
 * Apple'ın iOS 26 Liquid Glass materyali (expo-glass-effect) — harita üstündeki yüzen kontroller için.
 * Cihaz desteklemiyorsa beyaz yüzey + gölgeye düşer (apple-design §12: materyal hiyerarşi; hafif/ince).
 */
export function GlassSurface({
  children,
  style,
  interactive = false,
  fallbackShadow = shadows.raised,
  appearance = 'surface',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
  fallbackShadow?: string;
  appearance?: 'surface' | 'map';
}) {
  if (process.env.EXPO_OS === 'ios' && isLiquidGlassAvailable()) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive={interactive} colorScheme={appearance === 'map' ? 'dark' : currentColorScheme()} style={style}>
        {children}
      </GlassView>
    );
  }
  return <View style={[{ backgroundColor: appearance === 'map' ? mapTheme.chrome : colors.surface, boxShadow: fallbackShadow, ...(appearance === 'map' ? { borderWidth: 1, borderColor: mapTheme.chromeBorder } : {}) }, style]}>{children}</View>;
}

export const liquidGlass = process.env.EXPO_OS === 'ios' && isLiquidGlassAvailable();
