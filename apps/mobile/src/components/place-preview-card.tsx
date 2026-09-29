import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOutDown, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { scheduleOnRN } from 'react-native-worklets';
import type { MapPlaceItemDto } from '@viral-places/contracts';
import { CATEGORY_META, formatDistanceLabel, haversineMeters } from '@viral-places/domain';
import { categoryTextColor, categoryTint, colors, durations, pressFeedback, radius, shadows, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { hapticCommit } from '@/lib/haptics';
import { Icon } from './icon';
import { ThemedText } from './themed-text';
import { ViralBadge } from './viral-badge';
import { SaveButton } from './save-button';
import { FreshnessLabel } from './freshness-label';
import { MediaPlaceholder } from './source-video-card';
import { project, rubberband } from '@/lib/gesture';
import { SheetGrabber } from './map/map-sheet';
import { VenueLogo } from './venue-logo';

export interface PlacePreviewCardProps {
  item: MapPlaceItemDto;
  asOf: string;
  userLocation: { lat: number; lng: number } | null;
  onOpen: (id: string) => void;
  onSave: (id: string) => void;
  onDismiss: () => void;
  onLayoutHeight?: (h: number) => void;
}

/** Sheet ayarı (apple-design): sürükleme sonrası damping 0.8, response ~0.3s, jest hızı devredilir. */
const SHEET_SPRING = { duration: durations.slow, dampingRatio: 0.8 } as const;

/**
 * Seçili mekan alt kartı (§7.2): tek kaydet aksiyonu; gövde detaya açılır.
 * Kart parmakla 1:1 sürüklenir, bırakınca hız devralınır; aşağı fırlatma kapatır (interruptible, UI thread).
 */
export function PlacePreviewCard({ item, asOf, userLocation, onOpen, onSave, onDismiss, onLayoutHeight }: PlacePreviewCardProps) {
  const { t, locale } = useT();
  const reducedMotion = useReducedMotion();
  const meta = CATEGORY_META[item.category];
  const distance = userLocation ? formatDistanceLabel(haversineMeters(userLocation, item.location), locale) : null;
  const translateY = useSharedValue(0);
  const height = useSharedValue(160);

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onChange((e) => {
      const next = translateY.get() + e.changeY;
      translateY.set(next < 0 ? rubberband(next, height.get()) : next);
    })
    .onEnd((e) => {
      const h = height.get();
      const projected = translateY.get() + project(e.velocityY);
      const dismiss = projected > h * 0.4 || e.velocityY > 900;
      if (dismiss) {
        translateY.set(withSpring(h + 40, { ...SHEET_SPRING, velocity: e.velocityY }));
        scheduleOnRN(hapticCommit);
        scheduleOnRN(onDismiss);
      } else {
        translateY.set(withSpring(0, { ...SHEET_SPRING, velocity: e.velocityY }));
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));

  return (
    <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(durations.base)} exiting={reducedMotion ? undefined : FadeOutDown.duration(durations.fast)}>
    <GestureDetector gesture={pan}>
      <Animated.View
        onLayout={(e) => {
          height.set(e.nativeEvent.layout.height);
          onLayoutHeight?.(e.nativeEvent.layout.height);
        }}
        style={[
          {
            backgroundColor: colors.surface,
            borderRadius: radius.cardLarge,
            borderCurve: 'continuous',
            padding: spacing.lg,
            gap: spacing.md,
            boxShadow: shadows.overlay,
          },
          animatedStyle,
        ]}
        testID="place-preview-card"
      >
        <SheetGrabber accessibilityLabel={t('common.close')} onPress={onDismiss} />
        <Pressable accessibilityRole="button" accessibilityLabel={item.name} onPress={() => onOpen(item.id)} style={({ pressed }) => ({ flexDirection: 'row', gap: spacing.md, ...pressFeedback(pressed) })} testID="place-preview-open">
          <View>
            {item.media.thumbnailUrl && item.media.mode !== 'unavailable' ? (
              <Image source={{ uri: item.media.thumbnailUrl }} contentFit="cover" transition={durations.fast} style={{ width: 96, height: 96, borderRadius: radius.cardSmall, backgroundColor: categoryTint(item.category, 0.16) }} accessibilityIgnoresInvertColors />
            ) : (
              <MediaPlaceholder category={item.category} mode={item.media.mode} size={96} />
            )}
            <VenueLogo url={item.logoUrl} size={30} style={{ position: 'absolute', right: -6, bottom: -6 }} />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <ThemedText variant="sectionTitle" numberOfLines={2}>
              {item.name}
            </ThemedText>
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
        <SaveButton venueId={item.id} onPress={() => onSave(item.id)} />
      </Animated.View>
    </GestureDetector>
    </Animated.View>
  );
}
