import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, type } from '@/theme';

type Variant = keyof typeof type;

export interface ThemedTextProps extends TextProps {
  variant?: Variant;
  tone?: 'primary' | 'secondary' | 'inverse';
}

export function ThemedText({ variant = 'body', tone = 'primary', style, ...props }: ThemedTextProps) {
  const color = tone === 'inverse' ? colors.surface : tone === 'secondary' ? colors.textSecondary : colors.textPrimary;
  return <Text {...props} style={[type[variant] as TextStyle, { color }, style]} />;
}
