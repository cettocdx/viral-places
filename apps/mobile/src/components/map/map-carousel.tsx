import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { MapPlaceItemDto } from '@viral-places/contracts';
import { mapTheme, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { Icon } from '@/components/icon';
import { GlassSurface } from '@/components/glass-surface';
import { PlacePhotoCard } from '@/components/place-photo-card';

const CARD_WIDTH = 148;
const CARD_HEIGHT = 184;

/**
 * Visible-area venues as floating photo cards over the map, replacing the white bottom sheet (ADR-020).
 * Rising first, then score; no invented score fills the gap.
 */
export function MapCarousel({ items, loading, onSelect, onOpen, onShowList, onHeightChange, onFocusChange }: {
  items: MapPlaceItemDto[];
  loading: boolean;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onShowList: () => void;
  onHeightChange: (height: number) => void;
  /** The card resting at the leading edge; its pin is highlighted on the map. */
  onFocusChange?: (id: string | null) => void;
}) {
  const { t } = useT();
  const sorted = [...items].sort((a, b) => Number(b.trend.trending) - Number(a.trend.trending) || (b.trend.score ?? -1) - (a.trend.score ?? -1));
  const title = t(sorted.some((i) => i.trend.trending) ? 'explore.trendingOnMap' : 'explore.onMap');
  const focusRef = useRef<string | null>(null);
  const firstId = sorted[0]?.id ?? null;
  // İlk kart baştan odakta: haritada karşılığı hemen vurgulanır.
  useEffect(() => {
    if (focusRef.current === null || !sorted.some((i) => i.id === focusRef.current)) { focusRef.current = firstId; onFocusChange?.(firstId); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstId]);
  if (!loading && sorted.length === 0) return null;
  return (
    <View pointerEvents="box-none" onLayout={(e) => onHeightChange(e.nativeEvent.layout.height)} style={{ gap: spacing.sm }} testID="map-carousel">
      <View pointerEvents="box-none" style={{ flexDirection: 'row', paddingHorizontal: spacing.lg }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${t('saved.placesCount', { count: sorted.length })}, ${t('explore.showList')}`} onPress={onShowList} testID="explore-show-list">
          <GlassSurface appearance="map" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingLeft: 14, paddingRight: 12, borderRadius: 18, overflow: 'hidden' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: mapTheme.text }}>{title}</Text>
            {!loading ? (
              <View style={{ minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: mapTheme.paper, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: mapTheme.ink, fontVariant: ['tabular-nums'] }}>{sorted.length}</Text>
              </View>
            ) : null}
            <Icon sf="chevron.right" material="chevron-right" size={12} color={mapTheme.textMuted} />
          </GlassSurface>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + spacing.md}
        scrollEventThrottle={48}
        onScroll={(e) => {
          const index = Math.max(0, Math.min(sorted.length - 1, Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + spacing.md))));
          const id = sorted[index]?.id ?? null;
          if (id !== focusRef.current) { focusRef.current = id; onFocusChange?.(id); }
        }}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: 2, paddingBottom: 14, gap: spacing.md }}
        style={{ overflow: 'visible' }}
      >
        {loading && sorted.length === 0
          ? [0, 1, 2].map((i) => <View key={i} style={{ width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 24, backgroundColor: mapTheme.chrome, borderWidth: 1, borderColor: mapTheme.chromeBorder }} />)
          : sorted.map((item) => <PlacePhotoCard key={item.id} item={item} width={CARD_WIDTH} height={CARD_HEIGHT} onPress={() => onSelect(item.id)} onLongPress={() => onOpen(item.id)} testID={`trending-${item.id}`} />)}
      </ScrollView>
    </View>
  );
}
