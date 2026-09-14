import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import type { MapPlaceItemDto } from '@viral-places/contracts';
import { CATEGORY_META } from '@viral-places/domain';
import { categoryTextColor, colors, hairline, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { Icon } from '@/components/icon';
import { MediaPlaceholder } from '@/components/source-video-card';
import { ThemedText } from '@/components/themed-text';
import { ViralBadge } from '@/components/viral-badge';

export interface ClusterSelectionCardProps {
  items: MapPlaceItemDto[];
  /** Satıra dokunma: pin seçilir ve önizleme kartı açılır. */
  onPick: (id: string) => void;
  onDismiss: () => void;
  onLayoutHeight?: (h: number) => void;
}

/** Bir satırın yüksekliği; 4 satırdan sonrası kaydırılır, kart haritayı yutmaz. */
const ROW_HEIGHT = 64;

/**
 * Aynı koordinattaki farklı mekanlar için seçim listesi (§7.2). Önizleme kartıyla aynı yüzey/yarıçap;
 * skor yoksa "Veri birikiyor" rozeti — boşluk sahte puanla dolmaz.
 */
export function ClusterSelectionCard({ items, onPick, onDismiss, onLayoutHeight }: ClusterSelectionCardProps) {
  const { t } = useT();
  const reducedMotion = useReducedMotion();
  const sorted = [...items].sort((a, b) => Number(b.trend.trending) - Number(a.trend.trending) || (b.trend.score ?? -1) - (a.trend.score ?? -1) || a.name.localeCompare(b.name, 'tr'));
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(220)}
      exiting={reducedMotion ? undefined : FadeOutDown.duration(160)}
      onLayout={(e) => onLayoutHeight?.(e.nativeEvent.layout.height)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.cardLarge,
        borderCurve: 'continuous',
        paddingVertical: spacing.md,
        boxShadow: '0 10px 28px rgba(17, 24, 39, 0.16)',
      }}
      testID="cluster-selection-card"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="headline">{t('explore.clusterHere', { count: sorted.length })}</ThemedText>
          <ThemedText variant="helper" tone="secondary">
            {t('explore.clusterHint')}
          </ThemedText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onDismiss} hitSlop={8} testID="cluster-selection-close">
          <Icon sf="xmark.circle.fill" material="cancel" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>
      <ScrollView style={{ maxHeight: ROW_HEIGHT * 4 }} bounces={sorted.length > 4} showsVerticalScrollIndicator={sorted.length > 4}>
        {sorted.map((item, index) => {
          const meta = CATEGORY_META[item.category];
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${t(meta.labelKey)}`}
              onPress={() => onPick(item.id)}
              style={({ pressed }) => ({
                minHeight: ROW_HEIGHT,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                backgroundColor: pressed ? 'rgba(17,24,39,0.04)' : 'transparent',
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: hairline,
              })}
              testID={`cluster-pick-${item.id}`}
            >
              <MediaPlaceholder category={item.category} mode={item.media.mode} size={44} />
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText variant="bodyStrong" numberOfLines={1}>
                  {item.name}
                </ThemedText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={12} color={categoryTextColor(item.category)} />
                  <ThemedText variant="caption" style={{ color: categoryTextColor(item.category) }} numberOfLines={1}>
                    {t(meta.labelKey)}
                    {item.neighborhood ? ` · ${item.neighborhood}` : ''}
                  </ThemedText>
                </View>
              </View>
              <ViralBadge score={item.trend.score} status={item.trend.status} trending={item.trend.trending} size="sm" />
              <Icon sf="chevron.right" material="chevron-right" size={14} color={colors.textSecondary} />
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}
