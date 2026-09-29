import { Text, useWindowDimensions, type TextProps, type TextStyle } from 'react-native';
import { colors, onDark, type } from '@/theme';

type Variant = keyof typeof type;

/** Dynamic Type sınırı (HIG "Typography"): başlık düzeni bozmadan 1.6'ya, okuma metni 2.0'a kadar büyür. */
const MAX_SCALE: Record<Variant, number> = {
  screenTitle: 1.6,
  sectionTitle: 1.6,
  headline: 1.8,
  body: 2,
  bodyStrong: 2,
  helper: 2,
  helperStrong: 2,
  caption: 2,
};

export interface ThemedTextProps extends TextProps {
  variant?: Variant;
  tone?: 'primary' | 'secondary' | 'inverse';
}

export function ThemedText({ variant = 'body', tone = 'primary', style, ...props }: ThemedTextProps) {
  // inverse: ters yüzey (koyu daire / koyu şerit) üstündeki metin; karanlık modda beyaz yanlış olur.
  const color = tone === 'inverse' ? onDark : tone === 'secondary' ? colors.textSecondary : colors.textPrimary;
  // lineHeight tokende mutlak pt: büyük yazı ayarında satırlar kırpılıyordu, yazıyla birlikte ölçeklenir.
  const { lineHeight, ...rest } = type[variant] as TextStyle;
  const { fontScale } = useWindowDimensions();
  const scale = Math.min(fontScale, MAX_SCALE[variant]);
  return (
    <Text
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      {...props}
      style={[rest, lineHeight === undefined ? null : { lineHeight: lineHeight * scale }, { color }, style]}
    />
  );
}
