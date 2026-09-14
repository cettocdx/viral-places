import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { colors, dimensions, hairline, radius, spacing } from '@/theme';
import { ThemedText } from './themed-text';
import { GlassSurface, liquidGlass } from './glass-surface';

const variants = {
  primary: { bg: colors.primaryAction, fg: colors.surface, border: 'transparent' },
  secondary: { bg: colors.surface, fg: colors.textPrimary, border: hairline },
  ghost: { bg: 'transparent', fg: colors.textPrimary, border: 'transparent' },
} as const;

const sizes = {
  md: { minHeight: dimensions.iosTouchTargetMin, paddingHorizontal: spacing.lg },
  lg: { minHeight: dimensions.primaryButtonMinHeight, paddingHorizontal: spacing.xl },
} as const;

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/** Basma geri bildirimi: scale 0.97, 120ms (feedback; Reanimated CSS transition, UI thread). */
export function Button({ title, onPress, variant = 'primary', size = 'lg', icon, loading, disabled, style, accessibilityLabel, testID }: ButtonProps) {
  const v = variants[variant];
  const isDisabled = !!(disabled || loading);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={onPress}
      pressRetentionOffset={12}
      testID={testID}
      style={style}
    >
      {({ pressed }) => (
        <Animated.View
          style={{
            backgroundColor: v.bg,
            borderColor: v.border,
            borderWidth: variant === 'secondary' ? 1 : 0,
            borderRadius: radius.cardSmall,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: spacing.sm,
            opacity: isDisabled ? 0.45 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
            transitionProperty: 'transform',
            transitionDuration: 120,
            ...sizes[size],
          }}
        >
          {loading ? (
            <ActivityIndicator color={v.fg} />
          ) : (
            <>
              {icon ? <View>{icon}</View> : null}
              <ThemedText variant="headline" style={{ color: v.fg }} numberOfLines={2}>
                {title}
              </ThemedText>
            </>
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

/** Dairesel ikon butonu (geri, paylaş, kaydet) — en az 44pt dokunma alanı. */
export function IconButton({
  children,
  onPress,
  accessibilityLabel,
  selected,
  style,
  testID,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      hitSlop={6}
      testID={testID}
      style={({ pressed }) => [{ opacity: pressed && !liquidGlass ? 0.8 : 1 }, style]}
    >
      <GlassSurface
        interactive
        style={{
          width: dimensions.iosTouchTargetMin,
          height: dimensions.iosTouchTargetMin,
          borderRadius: radius.chip,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          ...(selected ? { backgroundColor: colors.primaryAction } : {}),
        }}
        fallbackShadow="0 2px 8px rgba(17, 24, 39, 0.10)"
      >
        {children}
      </GlassSurface>
    </Pressable>
  );
}
