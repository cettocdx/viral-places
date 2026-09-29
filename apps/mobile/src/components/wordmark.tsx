import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/theme';

/** Wordmark yazı tipi (kök layout'ta useFonts ile yüklenir). */
export const WORDMARK_FONT = 'InterTight_700Bold';

/**
 * Elsewhere wordmark: "ELSE" + aynalanmış "WHERE" → ELSEƎRƎHW. Ortadaki E ile Ǝ kollarından buluşur
 * (uygulama ikonu bu birleşimden türetildi). Metin olarak çizilir: her boyutta keskin, erişilebilir etiket "Elsewhere".
 */
export function Wordmark({ size = 20, color, style }: { size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const tint = color ?? colors.textPrimary;
  const text = { fontFamily: WORDMARK_FONT, fontSize: size, lineHeight: size * 1.1, letterSpacing: size * 0.02, color: tint, includeFontPadding: false } as const;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Elsewhere" style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      <Text style={text} allowFontScaling={false}>
        ELSE
      </Text>
      <Text style={[text, { transform: [{ scaleX: -1 }] }]} allowFontScaling={false}>
        WHERE
      </Text>
    </View>
  );
}
