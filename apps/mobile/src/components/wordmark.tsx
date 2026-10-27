import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StickerText } from './map/sticker-text';

/** Kept for the root font loader; the wordmark itself now uses the rounded system face (ADR-026). */
export const WORDMARK_FONT = 'InterTight_700Bold';

/**
 * Elsewhere wordmark (ADR-026): lowercase "elsewhere" as a die-cut sticker — ink letters, thick white edge —
 * the same language as the map pins. Drawn as text: sharp at every size; accessible label "Elsewhere".
 */
export function Wordmark({ size = 20, color, style }: { size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Elsewhere" style={style}>
      <StickerText size={size} outline={Math.max(2, Math.round(size * 0.14))} color={color && color !== '#FFFFFF' ? color : undefined}>elsewhere</StickerText>
    </View>
  );
}
