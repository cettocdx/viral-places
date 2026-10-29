import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, Share, Text, View, useWindowDimensions, type ViewToken } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MapPlaceItemDto } from '@viral-places/contracts';
import { CATEGORY_META, formatCompactCount } from '@viral-places/domain';
import { categoryColor, mapTheme } from '@/theme';
import { useT } from '@/hooks/use-t';
import { usePlace } from '@/lib/api/hooks';
import { sourcePlayback } from '@/lib/source-playback';
import { appConfig } from '@/lib/config';
import { useIsSaved } from '@/features/library/store';
import { useVisit, useVisitsStore } from '@/features/visits/store';
import { hapticCommit, hapticSelection } from '@/lib/haptics';
import { directionsUrl } from '@/lib/directions';
import { track } from '@/lib/telemetry';
import { cancelWantReminder, scheduleWantReminder } from '@/lib/reminders';
import { Icon } from '@/components/icon';
import { GlassSurface } from '@/components/glass-surface';
import { CalloutVideo } from '@/components/map/callout-video';
import { StickerText } from '@/components/map/sticker-text';

/** Bottom chrome the overlays must clear: Apple's floating tab bar is visible on every screen (29.10.2026). */
const TAB_BAR_CLEARANCE = 66;

/** Boş akış iskeleti: tam ekran soluk kart, başlık ve düğme çubukları; nefes alan opaklık. */
function FeedSkeleton() {
  const pulse = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 0.7, duration: 700, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const bar = (w: number | string, h: number) => <View style={{ width: w as number, height: h, borderRadius: h / 2, backgroundColor: 'rgba(255,255,255,0.14)' }} />;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', inset: 0, opacity: pulse, backgroundColor: '#0E1418' }} testID="feed-skeleton">
      <View style={{ position: 'absolute', left: 18, right: 90, bottom: 60, gap: 12 }}>
        {bar(70, 22)}
        {bar('80%', 30)}
        {bar('55%', 14)}
        {bar(150, 42)}
      </View>
      <View style={{ position: 'absolute', right: 12, bottom: 60, gap: 22, alignItems: 'center' }}>
        {[0, 1, 2, 3].map((i) => <View key={i} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.14)' }} />)}
      </View>
      <View style={{ position: 'absolute', top: '42%', left: 0, right: 0, alignItems: 'center' }}>
        <StickerText size={28} outline={4}>elsewhere</StickerText>
      </View>
    </Animated.View>
  );
}

/** Right-edge action (Instagram/TikTok idiom): round glass button with a short label under it. */
function RailButton({ sf, material, label, active, activeColor, onPress, testID }: { sf: string; material: string; label: string; active?: boolean; activeColor?: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} onPress={onPress} hitSlop={6} style={({ pressed }) => ({ alignItems: 'center', gap: 4, transform: [{ scale: pressed ? 0.9 : 1 }] })} testID={testID}>
      {/* iOS 26 Liquid Glass (desteklenmezse yarı saydam koyu); seçiliyken renkli dolgu. */}
      {active ? (
        <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: activeColor ?? mapTheme.accent }}>
          <Icon sf={sf} material={material as never} size={21} color={mapTheme.ink} />
        </View>
      ) : (
        <GlassSurface appearance="map" interactive style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <Icon sf={sf} material={material as never} size={21} color={mapTheme.paper} />
        </GlassSurface>
      )}
      <Text style={{ fontSize: 11.5, fontWeight: '700', color: mapTheme.paper, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

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
  const visit = useVisit(item.id);
  const setVisit = useVisitsStore((st) => st.setVisit);
  const toggleVisit = (status: 'want' | 'been') => {
    hapticSelection();
    const on = visit !== status;
    track(`feed.${status}`, { on });
    setVisit(item.id, on ? status : null);
    if (on && status === 'want') void scheduleWantReminder(item, { title: t('reminder.title', { name: item.name }), body: t('reminder.body') });
    else void cancelWantReminder(item.id);
  };
  const share = () => {
    hapticCommit();
    track('feed.share');
    void Share.share({ message: `${item.name}${item.neighborhood ? ` · ${item.neighborhood}` : ''}\n${directionsUrl(item.location.lat, item.location.lng)}` }).catch(() => {});
  };
  // Detail (and its sources) only for the visible page and its neighbours.
  const detail = usePlace(active || preload ? item.id : undefined);
  const meta = CATEGORY_META[item.category];
  const source = useMemo(() => (detail.data?.sources ?? []).find((s) => {
    const k = sourcePlayback(s, { bare: true, preferFile: appConfig.playStoredVideoFiles }).kind;
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
      {/* Visible page plays; its neighbours mount the stored file paused so it is buffered (and cached) before the swipe. */}
      {(active || preload) && source ? (
        <View style={{ position: 'absolute', inset: 0 }}>
          <CalloutVideo key={source.id} post={source} width={width} height={height} radius={0} startMuted={muted} onMutedChange={onMutedChange} controlsTop={insets.top + 64} playing={active} />
        </View>
      ) : null}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%', experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.85) 100%)' }} />
      {/* Venue, bottom left: the page's subject is the place, not the clip. */}
      {/* Right rail: keep, plan, mark, share — the loop that brings people back (owner, 29.10.2026). */}
      <View style={{ position: 'absolute', right: 12, bottom: bottom + 18, gap: 16, alignItems: 'center' }}>
        <RailButton sf={saved ? 'bookmark.fill' : 'bookmark'} material={saved ? 'bookmark' : 'bookmark-border'} label={t(saved ? 'reels.saved' : 'reels.save')} active={saved} onPress={() => onSave(item.id)} testID={`reel-save-${item.id}`} />
        <RailButton sf={visit === 'want' ? 'flag.fill' : 'flag'} material="flag" label={t('reels.want')} active={visit === 'want'} activeColor="#FFD166" onPress={() => toggleVisit('want')} testID={`reel-want-${item.id}`} />
        <RailButton sf={visit === 'been' ? 'checkmark.circle.fill' : 'checkmark.circle'} material="check-circle" label={t('reels.been')} active={visit === 'been'} activeColor="#7BE495" onPress={() => toggleVisit('been')} testID={`reel-been-${item.id}`} />
        <RailButton sf="paperplane" material="send" label={t('reels.share')} onPress={share} testID={`reel-share-${item.id}`} />
      </View>
      <View style={{ position: 'absolute', left: 18, right: 84, bottom: bottom + 8, gap: 8 }} pointerEvents="box-none">
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
      </View>
      </View>
    </View>
  );
});

/**
 * "Bu haritada keşfet" as a reels feed (ADR-022): one venue per full-screen page, vertical paging,
 * only the visible page plays (muted until the viewer turns sound on, which then carries over).
 */
export function ReelsFeed({ items, title, onClose, onOpen, onSave, initialIndex = 0, onIndexChange, onCityPress }: {
  items: MapPlaceItemDto[];
  title: string;
  onClose: () => void;
  onOpen: (id: string) => void;
  onSave: (id: string) => void;
  /** Where the viewer left off: returning from a venue page continues at the same video. */
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  /** Title doubles as the city switch. */
  onCityPress?: () => void;
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
    if (first?.index != null) { setActiveIndex(first.index); indexRef.current?.(first.index); track('feed.view', { index: first.index }); }
  }).current;
  const renderItem = useCallback(({ item, index }: { item: MapPlaceItemDto; index: number }) => (
    <ReelPage item={item} active={index === activeIndex} preload={Math.abs(index - activeIndex) === 1} width={width} height={height} muted={muted} onMutedChange={setMuted} onOpen={onOpen} onSave={onSave} />
  ), [activeIndex, width, height, muted, onOpen, onSave]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} testID="reels-feed">
      {/* Yüklenirken simsiyah ekran yerine marka + yanıp sönen iskelet (29.10.2026, "yüklenme hızı"). */}
      {items.length === 0 ? <FeedSkeleton /> : null}
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
      {/* Top scrim: the bar stays readable over bright footage. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 90, experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)' }} />
      {/* Way back to the map: always visible, top left (the top right is the player's sound control). */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('explore.mapView')} onPress={onClose} hitSlop={6} testID="reels-close">
          <GlassSurface appearance="map" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, overflow: 'hidden' }}>
            <Icon sf="chevron.left" material="arrow-back" size={14} color={mapTheme.paper} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: mapTheme.paper }}>{t('reels.map')}</Text>
          </GlassSurface>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={!onCityPress} onPress={onCityPress} hitSlop={6} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }} testID="reels-city">
          <Text style={{ flexShrink: 1, fontSize: 15, fontWeight: '700', color: mapTheme.paper, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 }} numberOfLines={1}>{title}</Text>
          {onCityPress ? <Icon sf="chevron.down" material="expand-more" size={12} color={mapTheme.paper} /> : null}
        </Pressable>
        <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)', fontVariant: ['tabular-nums'] }}>{items.length ? `${activeIndex + 1}/${items.length}` : ''}</Text>
      </View>
    </View>
  );
}
