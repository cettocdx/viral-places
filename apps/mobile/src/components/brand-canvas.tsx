import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { spacing } from '@/theme';
import { Wordmark } from './wordmark';

/**
 * Markalı görsel alanı: mekan sayfasının tepesi (video değil, marka yeri — ürün sahibi, 21.09.2026) ve kapak görseli olmayan kartlar.
 * Wordmark metin olarak çizilir, yani her ekran yoğunluğunda keskin kalır; ® işareti kullanılmaz.
 */
export function BrandCanvas({ height, size, style, children }: { height?: number; size?: number; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ height, backgroundColor: '#0B0F14', alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Wordmark size={size ?? 34} color="#FFFFFF" />
      {children ? <View style={{ position: 'absolute', left: spacing.lg, bottom: spacing.lg }}>{children}</View> : null}
    </View>
  );
}
