import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { MapPlaceItemDto } from '@viral-places/contracts';
import { CATEGORY_META } from '@viral-places/domain';
import { categoryColor, durations, mapTheme, spacing, trendingColor } from '@/theme';
import { useT } from '@/hooks/use-t';
import { Icon } from '@/components/icon';
import { GlassSurface } from '@/components/glass-surface';

const CARD_WIDTH = 148;
const CARD_HEIGHT = 184;
const FRAME = 5;

/** One venue as a small version of the map card's photo preview (ADR-020). */
function CarouselCard({ item, onSelect, onOpen }: { item: MapPlaceItemDto; onSelect: (id: string) => void; onOpen: (id: string) => void }) {
  const { t } = useT();
  const meta = CATEGORY_META[item.category];
  const photo = item.media.mode !== 'unavailable' ? item.media.thumbnailUrl : null;
  const [failed, setFailed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${t(meta.labelKey)}${item.neighborhood ? `, ${item.neighborhood}` : ''}`}
      onPress={() => onSelect(item.id)}
      onLongPress={() => onOpen(item.id)}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}
      testID={`trending-${item.id}`}
    >
      <View style={{ width: CARD_WIDTH, height: CARD_HEIGHT, padding: FRAME, borderRadius: 24, borderCurve: 'continuous', backgroundColor: mapTheme.paper, boxShadow: '0 10px 28px rgba(0, 0, 0, 0.35)' }}>
        <View style={{ flex: 1, borderRadius: 19, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: categoryColor(item.category), alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={30} color={mapTheme.paper} />
          {photo && !failed ? <Image source={{ uri: photo }} contentFit="cover" transition={durations.fast} onError={() => setFailed(true)} style={{ position: 'absolute', inset: 0 }} accessibilityIgnoresInvertColors /> : null}
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%', experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.78) 100%)' }} />
          {item.trend.trending ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: mapTheme.paper, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="flame.fill" material="local-fire-department" size={13} color={trendingColor} />
            </View>
          ) : null}
          <View pointerEvents="none" style={{ position: 'absolute', left: 10, right: 10, bottom: 9 }}>
            <Text style={{ fontSize: 15, lineHeight: 18, fontWeight: '600', letterSpacing: -0.2, color: mapTheme.paper }} numberOfLines={2}>{item.name}</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 }} numberOfLines={1}>{t(`pin.${item.category}`)}{item.neighborhood ? ` · ${item.neighborhood}` : ''}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Visible-area venues as floating photo cards over the map, replacing the white bottom sheet (ADR-020).
 * Rising first, then score; no invented score fills the gap.
 */
export function MapCarousel({ items, loading, onSelect, onOpen, onShowList, onHeightChange }: {
  items: MapPlaceItemDto[];
  loading: boolean;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onShowList: () => void;
  onHeightChange: (height: number) => void;
}) {
  const { t } = useT();
  const sorted = [...items].sort((a, b) => Number(b.trend.trending) - Number(a.trend.trending) || (b.trend.score ?? -1) - (a.trend.score ?? -1));
  const title = t(sorted.some((i) => i.trend.trending) ? 'explore.trendingOnMap' : 'explore.onMap');
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
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: 2, paddingBottom: 14, gap: spacing.md }}
        style={{ overflow: 'visible' }}
      >
        {loading && sorted.length === 0
          ? [0, 1, 2].map((i) => <View key={i} style={{ width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 24, backgroundColor: mapTheme.chrome, borderWidth: 1, borderColor: mapTheme.chromeBorder }} />)
          : sorted.map((item) => <CarouselCard key={item.id} item={item} onSelect={onSelect} onOpen={onOpen} />)}
      </ScrollView>
    </View>
  );
}
