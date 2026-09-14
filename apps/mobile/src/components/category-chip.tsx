import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { CATEGORY_META, type Category } from '@viral-places/domain';
import { categoryTextColor, categoryTint, colors, hairline, radius, spacing, dimensions } from '@/theme';
import { useT } from '@/hooks/use-t';
import { hapticSelection } from '@/lib/haptics';
import { Icon } from './icon';
import { ThemedText } from './themed-text';

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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        hapticSelection();
        onPress(category);
      }}
      hitSlop={4}
      testID={`chip-${category}`}
    >
      {({ pressed }) => (
        <Animated.View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            minHeight: dimensions.iosTouchTargetMin - 4,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: radius.chip,
            backgroundColor: selected ? categoryTint(category, 0.18) : colors.surface,
            borderWidth: 1,
            borderColor: selected ? categoryTint(category, 0.6) : hairline,
            boxShadow: selected ? 'none' : '0 1px 3px rgba(17, 24, 39, 0.08)',
            transform: [{ scale: pressed ? 0.97 : 1 }],
            transitionProperty: 'transform',
            transitionDuration: 120,
          }}
        >
          <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={18} color={fg} />
          <ThemedText variant="bodyStrong" style={{ color: selected ? fg : colors.textPrimary }}>
            {label}
          </ThemedText>
        </Animated.View>
      )}
    </Pressable>
  );
}

/** "Yükselen" kategorilerden bağımsız aç/kapa filtresidir (§7.2). */
export function TrendingChip({ selected, onPress }: { selected: boolean; onPress: () => void }) {
  const { t } = useT();
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: selected }} accessibilityLabel={t('filter.trendingA11y')} onPress={onPress} hitSlop={4} testID="chip-trending">
      {({ pressed }) => (
        <Animated.View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            minHeight: dimensions.iosTouchTargetMin - 4,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: radius.chip,
            backgroundColor: selected ? colors.trending : colors.surface,
            borderWidth: 1,
            borderColor: selected ? colors.trending : hairline,
            boxShadow: selected ? 'none' : '0 1px 3px rgba(17, 24, 39, 0.08)',
            transform: [{ scale: pressed ? 0.97 : 1 }],
            transitionProperty: 'transform',
            transitionDuration: 120,
          }}
        >
          <Icon sf="flame.fill" material="local-fire-department" size={18} color={selected ? colors.surface : colors.trending} />
          <ThemedText variant="bodyStrong" style={{ color: selected ? colors.surface : colors.textPrimary }}>
            {t('filter.trending')}
          </ThemedText>
        </Animated.View>
      )}
    </Pressable>
  );
}
