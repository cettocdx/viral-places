import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { colors } from '@/theme';

/**
 * Apple'ın iOS 26 Liquid Glass materyali (expo-glass-effect) — harita üstündeki yüzen kontroller için.
 * Cihaz desteklemiyorsa beyaz yüzey + gölgeye düşer (apple-design §12: materyal hiyerarşi; hafif/ince).
 */
export function GlassSurface({
  children,
  style,
  interactive = false,
  fallbackShadow = '0 4px 14px rgba(17, 24, 39, 0.10)',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
  fallbackShadow?: string;
}) {
  if (process.env.EXPO_OS === 'ios' && isLiquidGlassAvailable()) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive={interactive} colorScheme="light" style={style}>
        {children}
      </GlassView>
    );
  }
  return <View style={[{ backgroundColor: colors.surface, boxShadow: fallbackShadow }, style]}>{children}</View>;
}

export const liquidGlass = process.env.EXPO_OS === 'ios' && isLiquidGlassAvailable();
