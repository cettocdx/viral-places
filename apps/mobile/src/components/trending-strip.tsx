import { Pressable, ScrollView, View } from 'react-native';
import type { MapPlaceItemDto } from '@viral-places/contracts';
import { CATEGORY_META } from '@viral-places/domain';
import { categoryTextColor, categoryTint, colors, hairline, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { Icon } from './icon';
import { Image } from 'expo-image';
import { MediaPlaceholder } from './source-video-card';
import { ThemedText } from './themed-text';
import { ViralBadge } from './viral-badge';

/**
 * "Bu haritada yükselenler" (Plotline "Trending on this map" kalıbı): görünür bbox'taki mekanlar,
 * yükselen → skor sırasıyla; skor yoksa "Veri birikiyor" rozeti, boşluk sahte puanla dolmaz.
 */
export function TrendingStrip({ items, onSelect, onOpen }: { items: MapPlaceItemDto[]; onSelect: (id: string) => void; onOpen: (id: string) => void }) {
  const { t } = useT();
  const sorted = [...items].sort((a, b) => Number(b.trend.trending) - Number(a.trend.trending) || (b.trend.score ?? -1) - (a.trend.score ?? -1));
  if (sorted.length === 0) {
    return (
      <View style={{ padding: spacing.lg }}>
        <ThemedText tone="secondary">{t('explore.emptyFilter')}</ThemedText>
      </View>
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg }}>
        <Icon sf="flame.fill" material="local-fire-department" size={14} color={colors.trending} />
        <ThemedText variant="caption" tone="secondary" style={{ letterSpacing: 0.6 }}>
          {t('explore.trendingOnMap').toLocaleUpperCase('tr')}
        </ThemedText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        {sorted.map((item) => {
          const meta = CATEGORY_META[item.category];
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() => onSelect(item.id)}
              onLongPress={() => onOpen(item.id)}
              style={({ pressed }) => ({ width: 220, flexDirection: 'row', gap: spacing.md, alignItems: 'center', padding: spacing.sm, backgroundColor: pressed ? 'rgba(17,24,39,0.04)' : colors.surface, borderRadius: radius.cardSmall, borderCurve: 'continuous', borderWidth: 1, borderColor: hairline })}
              testID={`trending-${item.id}`}
            >
              {item.media.thumbnailUrl && item.media.mode !== 'unavailable' ? (
                <Image source={{ uri: item.media.thumbnailUrl }} contentFit="cover" transition={150} style={{ width: 64, height: 64, borderRadius: radius.cardSmall }} accessibilityIgnoresInvertColors />
              ) : (
                <MediaPlaceholder category={item.category} mode={item.media.mode} size={64} />
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <ThemedText variant="bodyStrong" numberOfLines={2}>
                  {item.name}
                </ThemedText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={12} color={categoryTextColor(item.category)} />
                  <ThemedText variant="caption" style={{ color: categoryTextColor(item.category) }} numberOfLines={1}>
                    {t(meta.labelKey)}
                    {item.neighborhood ? ` · ${item.neighborhood}` : ''}
                  </ThemedText>
                </View>
                <ViralBadge score={item.trend.score} status={item.trend.status} trending={item.trend.trending} size="sm" />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ height: 1, backgroundColor: categoryTint('coffee', 0) }} />
    </View>
  );
}
