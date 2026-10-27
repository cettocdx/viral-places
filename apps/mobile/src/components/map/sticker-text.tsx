import { Platform, Text, View, type TextStyle } from 'react-native';
import { mapTheme } from '@/theme';

/** SF Pro Rounded on iOS; the reference labels are rounded die-cut stickers (ADR-020). */
export const STICKER_FONT = Platform.select({ ios: 'ui-rounded', default: undefined });

/** Twelve white copies around the ink text: React Native has no text stroke, and map snapshots need plain views. */
const OUTLINE = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { x: Math.cos(a), y: Math.sin(a) };
});

export interface StickerTextProps {
  children: string;
  size: number;
  /** Outline thickness in points. */
  outline?: number;
  color?: string;
  outlineColor?: string;
  /** Map annotations are rasterized at a fixed size; their scalable label lives on the parent's accessibility label. */
  allowFontScaling?: boolean;
  style?: TextStyle;
}

/** Heavy ink text with a white die-cut edge, as on the reference pins and card badge. */
export function StickerText({ children, size, outline = 3, color = mapTheme.ink, outlineColor = mapTheme.paper, allowFontScaling = false, style }: StickerTextProps) {
  const text: TextStyle = { fontFamily: STICKER_FONT, fontSize: size, lineHeight: Math.round(size * 1.15), fontWeight: '800', letterSpacing: -0.2, ...style };
  return (
    <View accessible={false} style={{ padding: outline }}>
      {OUTLINE.map((o, i) => (
        <Text
          key={i}
          allowFontScaling={allowFontScaling}
          numberOfLines={1}
          style={{ ...text, color: outlineColor, position: 'absolute', left: outline + o.x * outline, top: outline + o.y * outline }}
        >
          {children}
        </Text>
      ))}
      <Text allowFontScaling={allowFontScaling} numberOfLines={1} style={{ ...text, color }}>
        {children}
      </Text>
    </View>
  );
}
