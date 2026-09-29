import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import type { MapPlaceItemDto } from '@viral-places/contracts';
import { CATEGORY_META, formatDistanceLabel, haversineMeters } from '@viral-places/domain';
import { categoryTextColor, categoryTint, colors, durations, pressFeedback, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { Icon } from './icon';
import { ThemedText } from './themed-text';
import { ViralBadge } from './viral-badge';
import { SaveButton } from './save-button';
import { FreshnessLabel } from './freshness-label';
import { MediaPlaceholder } from './source-video-card';
import { VenueLogo } from './venue-logo';

export interface PlacePreviewCardProps {
  item: MapPlaceItemDto;
  asOf: string;
  userLocation: { lat: number; lng: number } | null;
  onOpen: (id: string) => void;
  onSave: (id: string) => void;
  onDismiss: () => void;
}

/**
 * Seçili mekan önizlemesi (§7.2): alt sheet'in içeriği — yüzey, tutamaç ve sürükleme MapSheet'te (tek sheet).
 * Tek kaydet aksiyonu; gövde detaya açılır; sağ üstte kapat.
 */
export function PlacePreviewCard({ item, asOf, userLocation, onOpen, onSave, onDismiss }: PlacePreviewCardProps) {
  const { t, locale } = useT();
  const meta = CATEGORY_META[item.category];
  const distance = userLocation ? formatDistanceLabel(haversineMeters(userLocation, item.location), locale) : null;
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }} testID="place-preview-card">
      <Pressable accessibilityRole="button" accessibilityLabel={item.name} onPress={() => onOpen(item.id)} style={({ pressed }) => ({ flexDirection: 'row', gap: spacing.md, ...pressFeedback(pressed) })} testID="place-preview-open">
        <View>
          {item.media.thumbnailUrl && item.media.mode !== 'unavailable' ? (
            <Image source={{ uri: item.media.thumbnailUrl }} contentFit="cover" transition={durations.fast} style={{ width: 88, height: 88, borderRadius: radius.cardSmall, backgroundColor: categoryTint(item.category, 0.16) }} accessibilityIgnoresInvertColors />
          ) : (
            <MediaPlaceholder category={item.category} mode={item.media.mode} size={88} />
          )}
          <VenueLogo url={item.logoUrl} size={28} style={{ position: 'absolute', right: -6, bottom: -6 }} />
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <ThemedText variant="sectionTitle" numberOfLines={2} style={{ flex: 1 }}>
              {item.name}
            </ThemedText>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onDismiss} hitSlop={10} testID="place-preview-close">
              <Icon sf="xmark.circle.fill" material="cancel" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
            {item.trend.score !== null ? <ViralBadge score={item.trend.score} status={item.trend.status} trending={item.trend.trending} size="sm" /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: categoryTint(item.category), borderRadius: radius.chip, paddingHorizontal: spacing.sm, paddingVertical: 3 }}>
              <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={13} color={categoryTextColor(item.category)} />
              <ThemedText variant="caption" style={{ color: categoryTextColor(item.category) }}>
                {t(meta.labelKey)}
              </ThemedText>
            </View>
            {item.neighborhood ? (
              <ThemedText variant="helper" tone="secondary">
                {item.neighborhood}
              </ThemedText>
            ) : null}
            {distance ? (
              <ThemedText variant="helper" tone="secondary">
                · {distance} ({t('place.distanceBirdEye')})
              </ThemedText>
            ) : null}
          </View>
          <FreshnessLabel observedAt={item.freshness.lastObservedAt} asOf={asOf} />
        </View>
      </Pressable>
      <SaveButton venueId={item.id} size="md" onPress={() => onSave(item.id)} />
    </View>
  );
}
