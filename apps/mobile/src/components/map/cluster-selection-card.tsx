import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import type { MapPlaceItemDto } from '@viral-places/contracts';
import { CATEGORY_META } from '@viral-places/domain';
import { categoryTextColor, colors, hairline, pressFeedback, spacing } from '@/theme';
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
}

/** Bir satırın yüksekliği; 4 satırdan sonrası kaydırılır, kart haritayı yutmaz. */
const ROW_HEIGHT_BASE = 64;

/**
 * Aynı koordinattaki farklı mekanlar için seçim listesi (§7.2): alt sheet'in içeriği (yüzey ve sürükleme MapSheet'te);
 * skor yoksa "Veri birikiyor" rozeti — boşluk sahte puanla dolmaz.
 */
export function ClusterSelectionCard({ items, onPick, onDismiss }: ClusterSelectionCardProps) {
  const { t } = useT();
  // Satır yüksekliği yazı ölçeğiyle büyür; sabit 64 pt'de büyük yazıda ad ile kategori üst üste biniyordu.
  const { fontScale } = useWindowDimensions();
  const rowHeight = Math.round(ROW_HEIGHT_BASE * Math.min(fontScale, 1.8));
  const sorted = [...items].sort((a, b) => Number(b.trend.trending) - Number(a.trend.trending) || (b.trend.score ?? -1) - (a.trend.score ?? -1) || a.name.localeCompare(b.name, 'tr'));
  return (
    <View style={{ paddingBottom: spacing.sm }} testID="cluster-selection-card">
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
      <ScrollView style={{ maxHeight: rowHeight * 4 }} bounces={sorted.length > 4} showsVerticalScrollIndicator={sorted.length > 4}>
        {sorted.map((item, index) => {
          const meta = CATEGORY_META[item.category];
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${t(meta.labelKey)}`}
              onPress={() => onPick(item.id)}
              style={({ pressed }) => ({
                minHeight: rowHeight,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                ...pressFeedback(pressed, 'row'),
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
              {item.trend.score !== null ? <ViralBadge score={item.trend.score} status={item.trend.status} trending={item.trend.trending} size="sm" /> : null}
              <Icon sf="chevron.right" material="chevron-right" size={14} color={colors.textSecondary} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
