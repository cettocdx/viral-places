import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { durations, hairline, shadows } from '@/theme';

/** Mekanın kendi markası (web sitesi ikonu). Beyaz zemin: ikonlar çoğunlukla açık zemin için çizilir. */
export function VenueLogo({ url, size, style }: { url: string | null | undefined; size: number; style?: StyleProp<ViewStyle> }) {
  if (!url) return null;
  const pad = Math.round(size * 0.14);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.26,
          borderCurve: 'continuous',
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: hairline,
          padding: pad,
          overflow: 'hidden',
          boxShadow: shadows.card,
        },
        style,
      ]}
    >
      <Image source={{ uri: url }} contentFit="contain" transition={durations.fast} style={{ flex: 1 }} accessibilityIgnoresInvertColors />
    </View>
  );
}
