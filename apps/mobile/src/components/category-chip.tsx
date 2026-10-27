import type { ReactNode } from 'react';
import { Pressable, useWindowDimensions, type AccessibilityRole, type AccessibilityState } from 'react-native';
import Animated from 'react-native-reanimated';
import { CATEGORY_META, type Category } from '@viral-places/domain';
import { categoryTextColor, categoryTint, colors, dimensions, durations, hairline, mapTheme, radius, shadows, spacing } from '@/theme';
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
            minHeight: Math.round((process.env.EXPO_OS === 'android' ? dimensions.androidTouchTargetMin : dimensions.iosTouchTargetMin) * Math.min(fontScale, 1.8)),
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
          <ThemedText variant="helperStrong" style={{ color: textColor }} numberOfLines={1}>
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
  appearance?: 'surface' | 'map';
}

/** Kategori chip'i: ikon + metin + renk; renk tek taşıyıcı değildir (§6.3). */
export function CategoryChip({ category, selected, onPress, appearance = 'surface' }: CategoryChipProps) {
  const { t } = useT();
  const meta = CATEGORY_META[category];
  const onMap = appearance === 'map';
  const fg = onMap ? selected ? mapTheme.ink : mapTheme.text : categoryTextColor(category);
  const label = t(meta.labelKey);
  return (
    <FilterChip
      label={label}
      icon={<Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={18} color={fg} />}
      selected={selected}
      onPress={() => onPress(category)}
      fill={onMap ? selected ? mapTheme.paper : mapTheme.chrome : selected ? categoryTint(category, 0.18) : colors.surface}
      borderColor={onMap ? selected ? mapTheme.paper : mapTheme.chromeBorder : selected ? categoryTint(category, 0.6) : hairline}
      textColor={onMap ? fg : selected ? fg : colors.textPrimary}
      testID={`chip-${category}`}
    />
  );
}

/** "Yükselen" kategorilerden bağımsız aç/kapa filtresidir (§7.2). */
export function TrendingChip({ selected, onPress, appearance = 'surface' }: { selected: boolean; onPress: () => void; appearance?: 'surface' | 'map' }) {
  const { t } = useT();
  const onMap = appearance === 'map';
  return (
    <FilterChip
      label={t('filter.trending')}
      icon={<Icon sf="flame.fill" material="local-fire-department" size={18} color={onMap ? selected ? mapTheme.ink : mapTheme.text : selected ? colors.surface : colors.trending} />}
      selected={selected}
      onPress={onPress}
      fill={onMap ? selected ? mapTheme.accent : mapTheme.chrome : selected ? colors.trending : colors.surface}
      borderColor={onMap ? mapTheme.chromeBorder : selected ? colors.trending : hairline}
      textColor={onMap ? selected ? mapTheme.ink : mapTheme.text : selected ? colors.surface : colors.textPrimary}
      accessibilityRole="switch"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={t('filter.trendingA11y')}
      testID="chip-trending"
    />
  );
}
