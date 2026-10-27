import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, type TextStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { MapPlaceItemDto, SourcePostDto } from '@viral-places/contracts';
import { CATEGORY_META, formatCompactCount } from '@viral-places/domain';
import { categoryColor, durations, mapTheme, trendingColor } from '@/theme';
import { useT } from '@/hooks/use-t';
import { usePlace } from '@/lib/api/hooks';
import { sumCounters } from '@/lib/callout-layout';
import { useIsSaved } from '@/features/library/store';
import { Icon } from '@/components/icon';
import { SourceVideoPreview } from '@/components/source-video-preview';
import { STICKER_FONT, StickerText } from './sticker-text';

const C = mapTheme.callout;
const INK = mapTheme.ink;
const PAPER = mapTheme.paper;
/** Reference proportions, measured from the Places, Map & Pins video (ADR-020). */
const PREVIEW_PAD = 10;
const BODY_PAD = 22;
const BADGE_ICON = 32;
const STRIP_HEIGHT = 104;

type Stage = 'preview' | 'expanded' | 'full';

export interface PlaceCalloutProps {
  item: MapPlaceItemDto;
  cityName: string | null;
  width: number;
  maxHeight: number;
  /** Tail position from the card's left edge; the tail points at the pin. */
  tailX: number;
  onOpen: (id: string) => void;
  onSave: (id: string) => void;
  onDismiss: () => void;
  onHeightChange: (height: number) => void;
}

/** Card tail: a white pointer centred on the pin. A rotated square, half under the card, gives a crisp white tip. */
const TAIL_SIDE = C.tailWidth / Math.SQRT2;
function Tail({ x }: { x: number }) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', bottom: -TAIL_SIDE / 2, left: x - TAIL_SIDE / 2, width: TAIL_SIDE, height: TAIL_SIDE, borderBottomRightRadius: 4, backgroundColor: PAPER, transform: [{ rotate: '45deg' }] }}
    />
  );
}

/** Rating row: an independent Google rating when present (with attribution), else our own honest signal. */
function MetaRow({ item, rating, videos, style }: { item: MapPlaceItemDto; rating: number | null; videos: number | null; style?: object }) {
  const { t } = useT();
  const label = t(`pin.${item.category}`);
  const text: TextStyle = { fontSize: 13.5, fontWeight: '500', color: INK };
  if (rating !== null) {
    return (
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 5 }, style]}>
        <Icon sf="star.fill" material="star" size={12} color={C.star} />
        <Text style={text}>{label} {rating.toFixed(1)}</Text>
        <Text style={{ ...text, color: C.muted }}>· {t('callout.ratingGoogle')}</Text>
      </View>
    );
  }
  if (item.trend.score !== null) {
    return (
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 5 }, style]}>
        <Icon sf="flame.fill" material="local-fire-department" size={12} color={trendingColor} />
        <Text style={text}>{label} · {t('viral.scoreA11y', { score: item.trend.score })}</Text>
      </View>
    );
  }
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 5 }, style]}>
      <Icon sf="play.fill" material="play-arrow" size={12} color={C.star} />
      <Text style={text}>{label}{videos ? ` · ${t('callout.videos', { count: videos })}` : ''}</Text>
    </View>
  );
}

/** Floating counters at the card's corner (reference: 👍 24 / ★ 4.9). Only counters a source exposes. */
function StatPill({ sf, material, color, value, label }: { sf: string; material: string; color: string; value: string; label: string }) {
  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 14, height: 40, borderRadius: 20, backgroundColor: PAPER, boxShadow: '0 6px 18px rgba(17, 24, 39, 0.18)' }}>
      <Icon sf={sf} material={material as never} size={17} color={color} />
      <Text style={{ fontSize: 19, fontWeight: '600', color: INK, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

/**
 * The map selection: a card floating above its pin, after the Places, Map & Pins reference (ADR-020).
 * Photo preview → tap → details with the sourced summary and the venue's videos → "show more" → full text and counters.
 */
export function PlaceCallout({ item, cityName, width, maxHeight, tailX, onOpen, onSave, onDismiss, onHeightChange }: PlaceCalloutProps) {
  const { t, locale } = useT();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const detail = usePlace(item.id);
  const saved = useIsSaved(item.id);
  const [stage, setStage] = useState<Stage>('preview');
  const [playing, setPlaying] = useState<SourcePostDto | null>(null);
  const meta = CATEGORY_META[item.category];
  const sources = useMemo(() => detail.data?.sources ?? [], [detail.data]);
  const photo = item.media.mode !== 'unavailable' ? item.media.thumbnailUrl : null;
  const [photoFailed, setPhotoFailed] = useState(false);
  const rating = detail.data?.externalRating?.rating ?? null;
  const description = (detail.data?.summary.items ?? []).map((s) => s.text).join(' ');
  const addressHint = detail.data?.practical.addressHint ?? null;
  const address = [addressHint && addressHint !== item.neighborhood ? addressHint : item.neighborhood, cityName].filter(Boolean).join(', ');
  const likes = formatCompactCount(sumCounters(sources.map((s) => s.likes ?? null)), locale);
  const views = formatCompactCount(sumCounters(sources.map((s) => s.views)), locale);
  const strip = sources.filter((s) => s.media.mode !== 'unavailable' && s.media.thumbnailUrl);

  // Pop out of the pin, like the reference.
  const pop = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    pop.value = reducedMotion ? 1 : withSpring(1, { damping: 16, stiffness: 260, mass: 0.7 });
  }, [pop, reducedMotion]);
  const popStyle = useAnimatedStyle(() => ({ opacity: withTiming(pop.value > 0.05 ? 1 : 0, { duration: 90 }), transform: [{ scale: 0.82 + 0.18 * pop.value }] }));
  const layout = reducedMotion ? undefined : LinearTransition.springify().damping(20).stiffness(230);
  const enter = reducedMotion ? undefined : FadeIn.duration(durations.base);
  const exit = reducedMotion ? undefined : FadeOut.duration(durations.fast);

  const openVenue = () => onOpen(item.id);
  const header = (
    <>
      <Pressable accessibilityRole="link" accessibilityLabel={t('callout.openA11y', { name: item.name })} onPress={openVenue} testID="callout-open">
        <Text style={{ fontSize: 28, lineHeight: 33, fontWeight: '600', letterSpacing: -0.6, color: INK }} numberOfLines={2}>{item.name}</Text>
      </Pressable>
      {address ? <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }} numberOfLines={1}>{address}</Text> : null}
      <MetaRow item={item} rating={rating} videos={sources.length || null} style={{ marginTop: 6 }} />
    </>
  );

  return (
    <Animated.View
      style={[{ width, transformOrigin: `${tailX}px 100%` }, popStyle]}
      onLayout={(e) => onHeightChange(e.nativeEvent.layout.height)}
      onAccessibilityEscape={onDismiss}
      testID="place-callout"
    >
      <Animated.View layout={layout} style={{ maxHeight, borderRadius: C.radius, borderCurve: 'continuous', backgroundColor: PAPER, boxShadow: '0 18px 44px rgba(0, 0, 0, 0.38)' }}>
        {stage === 'preview' ? (
          <Animated.View key="preview" entering={enter} exiting={exit} style={{ padding: PREVIEW_PAD, paddingBottom: 14 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('callout.expandA11y', { name: item.name })} onPress={() => setStage('expanded')} testID="callout-expand">
              <View style={{ width: width - PREVIEW_PAD * 2, aspectRatio: 1.03, borderRadius: C.photoRadius, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: categoryColor(item.category), alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={44} color={PAPER} />
                {photo && !photoFailed ? (
                  <Image source={{ uri: photo }} contentFit="cover" transition={durations.fast} onError={() => setPhotoFailed(true)} style={{ position: 'absolute', inset: 0 }} accessibilityIgnoresInvertColors />
                ) : null}
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '58%', experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.28) 45%, rgba(0,0,0,0.72) 100%)' }} />
                <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
                  <Text style={{ fontSize: 26, lineHeight: 30, fontWeight: '600', letterSpacing: -0.5, color: PAPER }} numberOfLines={2}>{item.name}</Text>
                  {item.neighborhood ? <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.86)', marginTop: 2 }} numberOfLines={1}>{item.neighborhood}</Text> : null}
                </View>
              </View>
            </Pressable>
            <View style={{ paddingHorizontal: 14, paddingTop: 12, gap: 4 }}>
              {address ? <Text style={{ fontSize: 13, color: C.muted }} numberOfLines={1}>{address}</Text> : null}
              <MetaRow item={item} rating={rating} videos={sources.length || null} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="details" entering={enter} exiting={exit} style={{ flexShrink: 1 }}>
            <ScrollView scrollEnabled={stage === 'full'} bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: BODY_PAD, paddingBottom: 18 }}>
              {header}
              {description ? (
                <Text style={{ fontSize: 15.5, lineHeight: 23, color: C.body, marginTop: 14 }} numberOfLines={stage === 'full' ? undefined : 3}>{description}</Text>
              ) : (
                <Text style={{ fontSize: 14, lineHeight: 20, color: C.muted, marginTop: 14 }}>{t('place.summaryEmpty')}</Text>
              )}
              <Pressable accessibilityRole="button" onPress={() => setStage(stage === 'full' ? 'expanded' : 'full')} hitSlop={10} style={{ alignSelf: 'flex-start', marginTop: 8 }} testID="callout-more">
                <Text style={{ fontSize: 14.5, fontWeight: '600', color: C.link }}>{t(stage === 'full' ? 'callout.showLess' : 'callout.showMore')}</Text>
              </Pressable>
              {playing ? (
                <Animated.View entering={enter} style={{ marginTop: 14, marginHorizontal: -8, gap: 8 }}>
                  <SourceVideoPreview key={playing.id} post={playing} onCreatorPress={(id) => router.push({ pathname: '/creators/[id]', params: { id } })} />
                  <Pressable accessibilityRole="button" onPress={() => setPlaying(null)} hitSlop={10} style={{ alignSelf: 'flex-start', marginLeft: 8 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '600', color: C.link }}>{t('callout.backToPhotos')}</Text>
                  </Pressable>
                </Animated.View>
              ) : strip.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, marginHorizontal: -BODY_PAD }} contentContainerStyle={{ gap: 8, paddingHorizontal: BODY_PAD - 4 }}>
                  {strip.map((s, i) => (
                    <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={t('callout.playA11y', { creator: s.creator.handle })} onPress={() => setPlaying(s)} testID={`callout-video-${s.id}`}>
                      <Image source={{ uri: s.media.thumbnailUrl! }} contentFit="cover" transition={durations.fast} style={{ width: i === 0 ? 196 : 108, height: STRIP_HEIGHT, borderRadius: 16, backgroundColor: categoryColor(item.category) }} accessibilityIgnoresInvertColors />
                      <View pointerEvents="none" style={{ position: 'absolute', left: 8, bottom: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon sf="play.fill" material="play-arrow" size={11} color={PAPER} />
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={18} color="#C3C7CD" />
                  <Text style={{ fontFamily: STICKER_FONT, fontSize: 21, fontWeight: '800', color: '#C3C7CD' }}>{t(`pin.${item.category}`)}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={saved ? t('place.saved') : t('place.save')} accessibilityState={{ selected: saved }} onPress={() => onSave(item.id)} hitSlop={8} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: saved ? INK : 'rgba(27, 40, 52, 0.06)' }} testID={`callout-save-${item.id}`}>
                  <Icon sf={saved ? 'bookmark.fill' : 'bookmark'} material={saved ? 'bookmark' : 'bookmark-border'} size={17} color={saved ? PAPER : INK} />
                </Pressable>
              </View>
            </ScrollView>
          </Animated.View>
        )}
        {stage === 'preview' ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: -BADGE_ICON / 2 - 4, left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: BADGE_ICON + 6, height: BADGE_ICON + 6, borderRadius: 19, backgroundColor: PAPER, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                <View style={{ width: BADGE_ICON, height: BADGE_ICON, borderRadius: BADGE_ICON / 2, backgroundColor: categoryColor(item.category), alignItems: 'center', justifyContent: 'center' }}>
                  <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={15} color={PAPER} />
                </View>
              </View>
              <View style={{ marginLeft: -6 }}>
                <StickerText size={24} outline={4}>{t(`pin.${item.category}`)}</StickerText>
              </View>
            </View>
          </View>
        ) : null}
      </Animated.View>
      {/* Outside the shadowed card: inside it the card's shadow tinted the tail grey. */}
      <Tail x={tailX} />
      {stage === 'full' && (likes || views) ? (
        <Animated.View entering={enter} pointerEvents="box-none" style={{ position: 'absolute', right: -10, bottom: -12, alignItems: 'flex-end', gap: 8 }}>
          {likes ? <StatPill sf="hand.thumbsup.fill" material="thumb-up" color="#7C6CF5" value={likes} label={t('callout.likesA11y', { count: likes })} /> : null}
          {views ? <StatPill sf="play.fill" material="play-arrow" color={C.star} value={views} label={t('callout.views', { count: views })} /> : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
