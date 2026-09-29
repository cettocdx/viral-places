import type { ReactNode } from 'react';
import { Pressable, useWindowDimensions, type AccessibilityRole, type AccessibilityState } from 'react-native';
import Animated from 'react-native-reanimated';
import { CATEGORY_META, type Category } from '@viral-places/domain';
import { categoryTextColor, categoryTint, colors, dimensions, durations, hairline, radius, shadows, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { hapticSelection } from '@/lib/haptics';
import { Icon } from './icon';
import { ThemedText } from './themed-text';

export interface FilterChipProps {
  label: string;
  icon?: ReactNode;
  selected: boolean;
  onPress: () => void;
  fill: string;
  borderColor: string;
  textColor: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Tek chip tabanı: kategori ve "yükselen" filtreleri aynı yüzeyi, yüksekliği ve basma tepkisini paylaşır.
 * Dokunma hedefi tam 44 pt (HIG "Accessibility"): önceden 40 pt + hitSlop ile telafi ediliyordu.
 */
export function FilterChip({ label, icon, selected, onPress, fill, borderColor, textColor, accessibilityRole = 'button', accessibilityState, accessibilityLabel, testID }: FilterChipProps) {
  const { fontScale } = useWindowDimensions();
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState ?? { selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      testID={testID}
    >
      {({ pressed }) => (
        <Animated.View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            minHeight: Math.round(dimensions.iosTouchTargetMin * Math.min(fontScale, 1.8)),
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: radius.chip,
            backgroundColor: fill,
            borderWidth: 1,
            borderColor,
            boxShadow: selected ? 'none' : shadows.card,
            transform: [{ scale: pressed ? 0.97 : 1 }],
            transitionProperty: 'transform',
            transitionDuration: durations.fast,
          }}
        >
          {icon}
          <ThemedText variant="bodyStrong" style={{ color: textColor }} numberOfLines={1}>
            {label}
          </ThemedText>
        </Animated.View>
      )}
    </Pressable>
  );
}

export interface CategoryChipProps {
  category: Category;
  selected: boolean;
  onPress: (category: Category) => void;
}

/** Kategori chip'i: ikon + metin + renk; renk tek taşıyıcı değildir (§6.3). */
export function CategoryChip({ category, selected, onPress }: CategoryChipProps) {
  const { t } = useT();
  const meta = CATEGORY_META[category];
  const fg = categoryTextColor(category);
  const label = t(meta.labelKey);
  return (
    <FilterChip
      label={label}
      icon={<Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={18} color={fg} />}
      selected={selected}
      onPress={() => onPress(category)}
      fill={selected ? categoryTint(category, 0.18) : colors.surface}
      borderColor={selected ? categoryTint(category, 0.6) : hairline}
      textColor={selected ? fg : colors.textPrimary}
      testID={`chip-${category}`}
    />
  );
}

/** "Yükselen" kategorilerden bağımsız aç/kapa filtresidir (§7.2). */
export function TrendingChip({ selected, onPress }: { selected: boolean; onPress: () => void }) {
  const { t } = useT();
  return (
    <FilterChip
      label={t('filter.trending')}
      icon={<Icon sf="flame.fill" material="local-fire-department" size={18} color={selected ? colors.surface : colors.trending} />}
      selected={selected}
      onPress={onPress}
      fill={selected ? colors.trending : colors.surface}
      borderColor={selected ? colors.trending : hairline}
      textColor={selected ? colors.surface : colors.textPrimary}
      accessibilityRole="switch"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={t('filter.trendingA11y')}
      testID="chip-trending"
    />
  );
}
