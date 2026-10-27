import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { MapPlaceItemDto } from '@viral-places/contracts';
import { CATEGORY_META, formatDistanceLabel, haversineMeters } from '@viral-places/domain';
import { categoryTextColor, categoryTint, colors, dimensions, hairline, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { usePlace } from '@/lib/api/hooks';
import { sourcePlayback } from '@/lib/source-playback';
import { Icon } from './icon';
import { ThemedText } from './themed-text';
import { ViralBadge } from './viral-badge';
import { Button } from './button';
import { SaveButton } from './save-button';
import { ErrorState, SkeletonBlock } from './state-views';
import { SourceVideoPreview } from './source-video-preview';

export interface PlacePreviewCardProps {
  item: MapPlaceItemDto;
  asOf: string;
  userLocation: { lat: number; lng: number } | null;
  onOpen: (id: string) => void;
  onSave: (id: string) => void;
  onDismiss: () => void;
}

/** The map selection itself loads and shows the venue's videos; no detail-page detour. */
export function PlacePreviewCard({ item, userLocation, onOpen, onSave, onDismiss }: PlacePreviewCardProps) {
  const { t, locale } = useT();
  const router = useRouter();
  const detail = usePlace(item.id);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const sources = detail.data?.sources ?? [];
  const preferredSource = useMemo(() => sources.find((source) => {
    const playback = sourcePlayback(source);
    return playback.kind === 'embed' || playback.kind === 'video';
  }) ?? sources[0], [sources]);
  const source = sources.find((s) => s.id === selectedSourceId) ?? preferredSource;
  const meta = CATEGORY_META[item.category];
  const distance = userLocation ? formatDistanceLabel(haversineMeters(userLocation, item.location), locale) : null;

  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.md, gap: spacing.md }} testID="place-preview-card">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel={item.name} onPress={() => onOpen(item.id)} style={{ flex: 1, gap: spacing.xs }} testID="place-preview-open">
          <ThemedText variant="sectionTitle" numberOfLines={2}>{item.name}</ThemedText>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
            <ThemedText variant="caption" style={{ color: categoryTextColor(item.category) }}>{t(meta.labelKey)}</ThemedText>
            {item.neighborhood ? <ThemedText variant="caption" tone="secondary">{item.neighborhood}</ThemedText> : null}
            {distance ? <ThemedText variant="caption" tone="secondary">{distance} ({t('place.distanceBirdEye')})</ThemedText> : null}
            {item.trend.score !== null ? <ViralBadge score={item.trend.score} status={item.trend.status} trending={item.trend.trending} size="sm" /> : null}
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onDismiss} style={{ minWidth: dimensions.iosTouchTargetMin, minHeight: dimensions.iosTouchTargetMin, alignItems: 'flex-end', justifyContent: 'center' }} testID="place-preview-close">
          <Icon sf="xmark.circle.fill" material="cancel" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      {detail.isLoading ? (
        <View accessibilityLabel={t('media.loading')}><SkeletonBlock height={180} /></View>
      ) : detail.isError ? (
        <ErrorState message={t('place.sourcesLoadError')} retryTitle={t('common.retry')} onRetry={() => detail.refetch()} />
      ) : source ? (
        <SourceVideoPreview key={source.id} post={source} onCreatorPress={(id) => router.push({ pathname: '/creators/[id]', params: { id } })} />
      ) : (
        <View style={{ paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.sm }}>
          <Icon sf="video.slash" material="videocam-off" size={24} color={colors.textSecondary} />
          <ThemedText variant="helper" tone="secondary">{t('place.sourcesEmpty')}</ThemedText>
        </View>
      )}

      {sources.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm }}>
          {sources.map((s, index) => (
            <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={t('media.chooseSource', { count: index + 1, creator: s.creator.handle })} accessibilityState={{ selected: s.id === source?.id }} onPress={() => setSelectedSourceId(s.id)} style={{ minHeight: dimensions.iosTouchTargetMin, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: radius.chip, borderWidth: 1, borderColor: s.id === source?.id ? categoryTextColor(item.category) : hairline, backgroundColor: s.id === source?.id ? categoryTint(item.category) : colors.surface }} testID={`place-preview-source-${s.id}`}>
              <ThemedText variant="caption">@{s.creator.handle}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button title={t('explore.placeDetails')} variant="secondary" size="md" onPress={() => onOpen(item.id)} style={{ flex: 1 }} testID="place-preview-details" />
        <View style={{ flex: 1 }}><SaveButton venueId={item.id} size="md" onPress={() => onSave(item.id)} /></View>
      </View>
    </View>
  );
}
