import { useMemo, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { CATEGORY_META } from '@viral-places/domain';
import { colors, hairline, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { DemoBadge } from '@/components/demo-badge';
import { ThemedText } from '@/components/themed-text';
import { VenueMarker } from './venue-marker';
import type { VenueMapProps } from './map-types';

/**
 * DEMO harita yüzeyi (ADR-014): Google Maps anahtarı yokken kullanılır. Coğrafya çizmez; taban harita
 * değildir ve öyle görünmez. Pinler gerçek sentetik koordinatların eşit-dikdörtgen izdüşümüyle yerleşir,
 * böylece göreli konum doğrudur. Bu bileşen "harita SDK çalışıyor" kanıtı değildir.
 */
const DEFAULT_SPAN = 0.16;
/** Alt DEMO notu yüksekliği; izdüşüm bu alanı boş bırakır. */
const NOTICE_RESERVE = 64;

export function DemoVenueMap({ items, selectedId, onSelect, initialCamera, onViewportSettled, bottomInset, topInset = 0, focus }: VenueMapProps) {
  const { t } = useT();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  /** İlk viewport: kamera merkezi etrafında sabit şehir kutusu; sorgu bu bbox ile başlar. */
  const cameraBounds = useMemo(
    () => ({
      west: initialCamera.center.lng - DEFAULT_SPAN / 2,
      east: initialCamera.center.lng + DEFAULT_SPAN / 2,
      south: initialCamera.center.lat - DEFAULT_SPAN / 2,
      north: initialCamera.center.lat + DEFAULT_SPAN / 2,
    }),
    [initialCamera.center.lat, initialCamera.center.lng],
  );

  const bounds = useMemo(() => {
    if (items.length === 0) return cameraBounds;
    let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
    for (const i of items) {
      west = Math.min(west, i.location.lng);
      east = Math.max(east, i.location.lng);
      south = Math.min(south, i.location.lat);
      north = Math.max(north, i.location.lat);
    }
    const padLng = Math.max((east - west) * 0.18, 0.01);
    const padLat = Math.max((north - south) * 0.18, 0.01);
    return { west: west - padLng, east: east + padLng, south: south - padLat, north: north + padLat };
  }, [items, cameraBounds]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
    onViewportSettled(cameraBounds, 13);
  };

  const project = (lat: number, lng: number) => {
    if (!size || !bounds) return null;
    const usableH = Math.max(size.h - bottomInset - topInset - NOTICE_RESERVE, 120);
    const padX = 28;
    const x = padX + ((lng - bounds.west) / (bounds.east - bounds.west)) * (size.w - padX * 2);
    const y = topInset + ((bounds.north - lat) / (bounds.north - bounds.south)) * usableH;
    return { x, y };
  };

  const focusPoint = focus ? project(focus.lat, focus.lng) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={onLayout} accessibilityLabel={t('demo.mapNotice')}>
      <Pressable style={{ flex: 1 }} onPress={() => onSelect(null)} accessibilityLabel={t('demo.mapNotice')}>
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <View key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: (i + 1) * 64, height: 1, backgroundColor: hairline }} />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: (i + 1) * 56, width: 1, backgroundColor: hairline }} />
          ))}
        </View>
        {focusPoint ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: focusPoint.x - 14, top: focusPoint.y - 14, width: 28, height: 28, borderRadius: radius.chip, backgroundColor: 'rgba(36, 107, 253, 0.18)', borderWidth: 2, borderColor: colors.food }}
          />
        ) : null}
        {size && bounds
          ? items.map((item) => {
              const p = project(item.location.lat, item.location.lng);
              if (!p) return null;
              const selected = item.id === selectedId;
              const label = t('explore.pinA11y', {
                name: item.name,
                category: t(CATEGORY_META[item.category].labelKey),
                score: item.trend.score !== null ? t('viral.scoreA11y', { score: item.trend.score }) : t('viral.insufficientA11y'),
              });
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(item.id)}
                  hitSlop={6}
                  testID={`pin-${item.id}`}
                  style={{ position: 'absolute', left: p.x - 21, top: p.y - 21, zIndex: selected ? 10 : 1 }}
                >
                  <VenueMarker category={item.category} score={item.trend.score} trending={item.trend.trending} selected={selected} showLabel={selected || items.length <= 8} />
                </Pressable>
              );
            })
          : null}
      </Pressable>
      <Animated.View
        entering={FadeIn.duration(200)}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: spacing.lg,
          bottom: bottomInset + spacing.md,
          maxWidth: '78%',
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.surface,
          borderRadius: radius.cardSmall,
          borderCurve: 'continuous',
          padding: spacing.sm,
          boxShadow: '0 1px 4px rgba(17, 24, 39, 0.12)',
        }}
      >
        <DemoBadge compact />
        <ThemedText variant="caption" tone="secondary" style={{ flex: 1 }} numberOfLines={2}>
          {t('demo.mapNotice')}
        </ThemedText>
      </Animated.View>
    </View>
  );
}
