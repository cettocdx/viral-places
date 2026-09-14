import { View } from 'react-native';
import { CATEGORY_META, type Category } from '@viral-places/domain';
import { categoryColor, colors, radius, spacing, trendingColor } from '@/theme';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';

export interface VenueMarkerProps {
  category: Category;
  score: number | null;
  trending: boolean;
  selected: boolean;
  /** Yoğun alanda etiket gizlenir; yalnız seçili/uygun zoom'da skor gösterilir (§7.2). */
  showLabel: boolean;
}

const PIN = 36;

/** Kategori renkli pin + ikon; trend vurgusu kırmızı halka olarak eklenir, kategori rengi silinmez. */
export function VenueMarker({ category, score, trending, selected, showLabel }: VenueMarkerProps) {
  const meta = CATEGORY_META[category];
  const fill = categoryColor(category);
  const size = selected ? PIN + 6 : PIN;
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius.chip,
          backgroundColor: fill,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 3,
          borderColor: trending ? trendingColor : colors.surface,
          boxShadow: selected ? '0 4px 10px rgba(17, 24, 39, 0.28)' : '0 2px 6px rgba(17, 24, 39, 0.18)',
        }}
      >
        <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={selected ? 19 : 17} color={colors.surface} />
      </View>
      {showLabel && score !== null ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.chip,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
            boxShadow: '0 1px 4px rgba(17, 24, 39, 0.16)',
            flexDirection: 'row',
            gap: 3,
            alignItems: 'center',
          }}
        >
          {trending ? <Icon sf="flame.fill" material="local-fire-department" size={11} color={trendingColor} /> : null}
          <ThemedText variant="caption" style={{ color: trending ? trendingColor : fill, fontVariant: ['tabular-nums'] }}>
            {score}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

export function ClusterMarker({ count }: { count: number }) {
  return (
    <View
      accessibilityLabel={`${count}`}
      style={{
        minWidth: PIN + 4,
        height: PIN + 4,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.chip,
        backgroundColor: colors.primaryAction,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: colors.surface,
        boxShadow: '0 2px 6px rgba(17, 24, 39, 0.18)',
      }}
    >
      <ThemedText variant="caption" tone="inverse" style={{ fontVariant: ['tabular-nums'] }}>
        {count}
      </ThemedText>
    </View>
  );
}
