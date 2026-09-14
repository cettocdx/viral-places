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
  /** Yoğun alanda etiket gizlenir; yalnız seçili/uygun zoom'da kısa skor rozeti gösterilir (§7.2). */
  showLabel: boolean;
}

const PIN = 36;
const SELECTED_PIN = PIN + 6;
/**
 * Marker görünümü sabit genişliktedir: pin solda, kısa rozet için sağda yer ayrılır. Böylece rozet
 * açılıp kapanınca pin koordinattan kaymaz; harita anchor'ı pin merkezine göre hesaplanır.
 */
export const MARKER_WIDTH = 96;

export function pinSize(selected: boolean): number {
  return selected ? SELECTED_PIN : PIN;
}

/** react-native-maps `anchor` değeri: pin merkezi koordinatın tam üstünde. */
export function markerAnchor(selected: boolean): { x: number; y: number } {
  return { x: pinSize(selected) / 2 / MARKER_WIDTH, y: 0.5 };
}

/** Kategori renkli pin + ikon; trend vurgusu kırmızı halka olarak eklenir, kategori rengi silinmez. */
export function VenueMarker({ category, score, trending, selected, showLabel }: VenueMarkerProps) {
  const meta = CATEGORY_META[category];
  const fill = categoryColor(category);
  const size = pinSize(selected);
  return (
    <View style={{ width: MARKER_WIDTH, height: SELECTED_PIN, alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
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

/** Küme pini (§7.8 ClusterMarker): lacivert, sayı; dokununca yakınlaşır veya aynı noktada seçim listesi açar. */
export function ClusterMarker({ count, accessibilityLabel, selected = false }: { count: number; accessibilityLabel?: string; /** Üyelerinden biri seçiliyken (aynı nokta) küme de seçili görünür. */ selected?: boolean }) {
  const size = SELECTED_PIN + (selected ? 6 : 0);
  return (
    <View
      accessibilityLabel={accessibilityLabel ?? `${count}`}
      accessibilityState={{ selected }}
      style={{
        minWidth: size,
        height: size,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.chip,
        backgroundColor: colors.primaryAction,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: colors.surface,
        boxShadow: selected ? '0 4px 10px rgba(17, 24, 39, 0.28)' : '0 2px 6px rgba(17, 24, 39, 0.18)',
      }}
    >
      <ThemedText variant="bodyStrong" tone="inverse" style={{ fontVariant: ['tabular-nums'] }}>
        {count}
      </ThemedText>
    </View>
  );
}
