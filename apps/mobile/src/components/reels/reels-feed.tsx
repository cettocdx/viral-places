import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View, useWindowDimensions, type ViewToken } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MapPlaceItemDto } from '@viral-places/contracts';
import { CATEGORY_META, formatCompactCount } from '@viral-places/domain';
import { categoryColor, mapTheme } from '@/theme';
import { useT } from '@/hooks/use-t';
import { usePlace } from '@/lib/api/hooks';
import { sourcePlayback } from '@/lib/source-playback';
import { useIsSaved } from '@/features/library/store';
import { Icon } from '@/components/icon';
import { GlassSurface } from '@/components/glass-surface';
import { CalloutVideo } from '@/components/map/callout-video';
import { StickerText } from '@/components/map/sticker-text';

/** Bottom chrome the overlays must clear: the floating native tab bar. */
const TAB_BAR_CLEARANCE = 64;

/** One full-screen venue: its cover, and once it is the visible page, its source video (ADR-022). */
const ReelPage = memo(function ReelPage({ item, active, preload, width, height, muted, onMutedChange, onOpen, onSave }: {
  item: MapPlaceItemDto;
  active: boolean;
  preload: boolean;
  width: number;
  height: number;
  muted: boolean;
  onMutedChange: (m: boolean) => void;
  onOpen: (id: string) => void;
  onSave: (id: string) => void;
}) {
  const { t, locale } = useT();
  const insets = useSafeAreaInsets();
  const saved = useIsSaved(item.id);
  // Detail (and its sources) only for the visible page and its neighbours.
  const detail = usePlace(active || preload ? item.id : undefined);
  const meta = CATEGORY_META[item.category];
  const source = useMemo(() => (detail.data?.sources ?? []).find((s) => {
    const k = sourcePlayback(s, { bare: true }).kind;
    return k === 'embed' || k === 'video';
  }) ?? null, [detail.data]);
  const views = formatCompactCount(source?.views ?? null, locale);
  const poster = source?.media.thumbnailUrl ?? (item.media.mode !== 'unavailable' ? item.media.thumbnailUrl : null);
  const bottom = insets.bottom + TAB_BAR_CLEARANCE;

  return (
    <View style={{ width, height, backgroundColor: '#000' }} testID={`reel-${item.id}`}>
      {poster ? <Image source={{ uri: poster }} contentFit="cover" transition={150} style={{ position: 'absolute', inset: 0 }} accessibilityIgnoresInvertColors /> : (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: categoryColor(item.category), alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={64} color={mapTheme.paper} />
        </View>
      )}
      {active && source ? (
        <View style={{ position: 'absolute', inset: 0 }}>
          <CalloutVideo key={source.id} post={source} width={width} height={height} radius={0} startMuted={muted} onMutedChange={onMutedChange} controlsTop={insets.top + 64} />
        </View>
      ) : null}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%', experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.85) 100%)' }} />
      {/* Venue, bottom left: the page's subject is the place, not the clip. */}
      {/* Sağ kenar TikTok oynatıcısının kendi sayaçlarına ait; bizim kontrollerimiz sol altta (ADR-022). */}
      <View style={{ position: 'absolute', left: 18, right: 84, bottom: bottom + 8, gap: 8 }}>
      <Pressable accessibilityRole="link" accessibilityLabel={t('callout.openA11y', { name: item.name })} onPress={() => onOpen(item.id)} style={{ gap: 8 }} testID={`reel-open-${item.id}`}>
        <View style={{ alignSelf: 'flex-start', transform: [{ rotate: '-4deg' }] }}>
          <StickerText size={18} outline={3.5}>{t(`pin.${item.category}`)}</StickerText>
        </View>
        <Text style={{ fontSize: 30, lineHeight: 34, fontWeight: '700', letterSpacing: -0.6, color: mapTheme.paper }} numberOfLines={2}>{item.name}</Text>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }} numberOfLines={1}>
          {[item.neighborhood, source ? `@${source.creator.handle}` : null, views ? t('callout.views', { count: views }) : null].filter(Boolean).join(' · ')}
        </Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('callout.openA11y', { name: item.name })} onPress={() => onOpen(item.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 18, borderRadius: 21, backgroundColor: mapTheme.paper, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: mapTheme.ink }}>{t('explore.placeDetails')}</Text>
          <Icon sf="arrow.up.right" material="north-east" size={13} color={mapTheme.ink} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={saved ? t('place.saved') : t('place.save')} accessibilityState={{ selected: saved }} onPress={() => onSave(item.id)} hitSlop={4} style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, backgroundColor: saved ? mapTheme.accent : 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : 1 }] })} testID={`reel-save-${item.id}`}>
          <Icon sf={saved ? 'bookmark.fill' : 'bookmark'} material={saved ? 'bookmark' : 'bookmark-border'} size={18} color={saved ? mapTheme.ink : mapTheme.paper} />
        </Pressable>
      </View>
      </View>
    </View>
  );
});

/**
 * "Bu haritada keşfet" as a reels feed (ADR-022): one venue per full-screen page, vertical paging,
 * only the visible page plays (muted until the viewer turns sound on, which then carries over).
 */
export function ReelsFeed({ items, title, onClose, onOpen, onSave, initialIndex = 0, onIndexChange }: {
  items: MapPlaceItemDto[];
  title: string;
  onClose: () => void;
  onOpen: (id: string) => void;
  onSave: (id: string) => void;
  /** Where the viewer left off: returning from a venue page continues at the same video. */
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
}) {
  const { t } = useT();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const startIndex = Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0));
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const indexRef = useRef(onIndexChange);
  indexRef.current = onIndexChange;
  const [muted, setMuted] = useState(true);
  const viewability = useRef({ itemVisiblePercentThreshold: 70 }).current;
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index != null) { setActiveIndex(first.index); indexRef.current?.(first.index); }
  }).current;
  const renderItem = useCallback(({ item, index }: { item: MapPlaceItemDto; index: number }) => (
    <ReelPage item={item} active={index === activeIndex} preload={Math.abs(index - activeIndex) === 1} width={width} height={height} muted={muted} onMutedChange={setMuted} onOpen={onOpen} onSave={onSave} />
  ), [activeIndex, width, height, muted, onOpen, onSave]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} testID="reels-feed">
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        pagingEnabled
        decelerationRate="fast"
        snapToInterval={height}
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={viewability}
        initialScrollIndex={startIndex}
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        removeClippedSubviews
        contentInsetAdjustmentBehavior="never"
        extraData={activeIndex}
      />
      {/* Way back to the map: always visible, top left (the top right is the player's sound control). */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('explore.mapView')} onPress={onClose} hitSlop={6} testID="reels-close">
          <GlassSurface appearance="map" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, overflow: 'hidden' }}>
            <Icon sf="chevron.left" material="arrow-back" size={14} color={mapTheme.paper} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: mapTheme.paper }}>{t('reels.map')}</Text>
          </GlassSurface>
        </Pressable>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: mapTheme.paper, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 }} numberOfLines={1}>{title}</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)', fontVariant: ['tabular-nums'] }}>{items.length ? `${activeIndex + 1}/${items.length}` : ''}</Text>
      </View>
    </View>
  );
}
