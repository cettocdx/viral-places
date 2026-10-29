import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View, type TextStyle } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { MapPlaceItemDto, SourcePostDto } from '@viral-places/contracts';
import { CATEGORY_META, formatCompactCount } from '@viral-places/domain';
import { categoryColor, durations, mapTheme, trendingColor } from '@/theme';
import { useT } from '@/hooks/use-t';
import { usePlace } from '@/lib/api/hooks';
import { sumCounters } from '@/lib/callout-layout';
import { Icon } from '@/components/icon';
import { STICKER_FONT, StickerText } from './sticker-text';
import { CalloutVideo } from './callout-video';
import { FileVideo } from './file-video';
import { sourcePlayback } from '@/lib/source-playback';
import { appConfig } from '@/lib/config';
import { CreatorAvatar } from '@/components/creator-avatar';
import { directionsUrl } from '@/lib/directions';
import { OpenNow } from '@/components/practical-info';

const C = mapTheme.callout;
const INK = mapTheme.ink;
const PAPER = mapTheme.paper;
/** Reference proportions, measured from the Places, Map & Pins video (ADR-020). */
const PREVIEW_PAD = 10;
const BODY_PAD = 22;
const BADGE_ICON = 32;
const STRIP_HEIGHT = 132;

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
  const [stage, setStage] = useState<Stage>('preview');
  const [playing, setPlaying] = useState<SourcePostDto | null>(null);
  const meta = CATEGORY_META[item.category];
  const sources = useMemo(() => detail.data?.sources ?? [], [detail.data]);
  const photo = item.media.mode !== 'unavailable' ? item.media.thumbnailUrl : null;
  // Önizlemede fotoğraf yerine kaynağın dosyası sessiz döngüde oynar (ürün sahibi, 27.10.2026; ADR-023). Yalnız dosya: resmi oynatıcı kartın dokunuşunu yutardı.
  const previewVideo = useMemo(() => {
    if (!appConfig.playStoredVideoFiles) return null;
    for (const s of sources) {
      const p = sourcePlayback(s, { preferFile: true });
      if (p.kind === 'video') return { post: s, url: p.url };
    }
    return null;
  }, [sources]);
  const [photoFailed, setPhotoFailed] = useState(false);
  const rating = detail.data?.externalRating?.rating ?? null;
  const summaryItems = (detail.data?.summary.items ?? []).filter((s) => s.claimType !== 'uncertainty');
  const creators = [...new Map(sources.map((s) => [s.creator.id, s.creator])).values()];
  const addressHint = detail.data?.practical.addressHint ?? null;
  const local = addressHint && addressHint !== item.neighborhood ? addressHint : item.neighborhood;
  // Semt adı şehirle aynıysa ("Paris, Paris") bir kez yazılır.
  const address = [local && local.toLocaleLowerCase() !== cityName?.toLocaleLowerCase() ? local : null, cityName].filter(Boolean).join(', ');
  // Yalnız izlenme ve creator adı (ürün sahibi, 27.10.2026): beğeni/yorum sayısı gösterilmez.
  const views = formatCompactCount(sumCounters(sources.map((s) => s.views)), locale);
  const strip = sources.filter((s) => s.media.mode !== 'unavailable' && s.media.thumbnailUrl);

  // Pop out of the pin, like the reference.
  const pop = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    // Reference: a smooth grow-out with no visible overshoot (owner: "aşırı sekiyor").
    pop.value = reducedMotion ? 1 : withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [pop, reducedMotion]);
  // Reference (Places, Map & Pins, 0:08): the card grows out of the pin from about a third of its size, with a soft overshoot.
  const popStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 3), transform: [{ scale: 0.55 + 0.45 * pop.value }] }));
  // Reference (0:09): photo preview → details is a card flip around the vertical axis.
  const flip = useSharedValue(0);
  const flipStyle = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${flip.value}deg` }] }));
  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flipTimer.current) clearTimeout(flipTimer.current); }, []);
  const expand = () => {
    if (reducedMotion) { setStage('expanded'); return; }
    flip.value = withTiming(90, { duration: 150, easing: Easing.in(Easing.quad) });
    flipTimer.current = setTimeout(() => {
      setStage('expanded');
      flip.value = -90;
      flip.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    }, 150);
  };
  const reveal = reducedMotion ? undefined : FadeInDown.delay(170).duration(380);
  const pillIn = (i: number) => (reducedMotion ? undefined : ZoomIn.duration(220).delay(140 + i * 80));
  const layout = reducedMotion ? undefined : LinearTransition.duration(240).easing(Easing.out(Easing.cubic));
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
      {detail.data ? <View style={{ marginTop: 6 }}><OpenNow place={detail.data} color={INK} mutedColor={C.muted} /></View> : null}
    </>
  );

  return (
    <Animated.View
      style={[{ width, transformOrigin: `${tailX}px 100%` }, popStyle]}
      onLayout={(e) => onHeightChange(e.nativeEvent.layout.height)}
      onAccessibilityEscape={onDismiss}
      testID="place-callout"
    >
      <Animated.View layout={layout} style={[flipStyle, { maxHeight, borderRadius: C.radius, borderCurve: 'continuous', backgroundColor: PAPER, boxShadow: '0 18px 44px rgba(0, 0, 0, 0.38)' }]}>
        {playing ? (
          <Animated.View key={`video-${playing.id}`} entering={enter} exiting={exit} style={{ padding: PREVIEW_PAD }}>
            <CalloutVideo post={playing} width={width - PREVIEW_PAD * 2} height={Math.min(Math.round((width - PREVIEW_PAD * 2) * 16 / 9), maxHeight - PREVIEW_PAD * 2)} radius={C.photoRadius} onClose={() => setPlaying(null)} />
          </Animated.View>
        ) : stage === 'preview' ? (
          <Animated.View key="preview" entering={enter} style={{ padding: PREVIEW_PAD, paddingBottom: 14 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('callout.expandA11y', { name: item.name })} onPress={expand} testID="callout-expand">
              <View style={{ width: width - PREVIEW_PAD * 2, aspectRatio: 1.03, borderRadius: C.photoRadius, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: categoryColor(item.category), alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={44} color={PAPER} />
                {photo && !photoFailed ? (
                  <Image source={{ uri: photo }} contentFit="cover" transition={durations.fast} onError={() => setPhotoFailed(true)} style={{ position: 'absolute', inset: 0 }} accessibilityIgnoresInvertColors />
                ) : null}
                {previewVideo ? (
                  <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
                    <FileVideo post={previewVideo.post} url={previewVideo.url} width={width - PREVIEW_PAD * 2} height={Math.round((width - PREVIEW_PAD * 2) / 1.03)} radius={0} ambient />
                  </View>
                ) : null}
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '58%', experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.28) 45%, rgba(0,0,0,0.72) 100%)' }} />
                <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
                  <Text style={{ fontSize: 26, lineHeight: 30, fontWeight: '600', letterSpacing: -0.5, color: PAPER }} numberOfLines={2}>{item.name}</Text>
                  {/* Creator credit (ADR-023) lives in the subtitle: no extra badge on the picture (ADR-024). */}
                  <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.86)', marginTop: 2 }} numberOfLines={1}>{previewVideo ? `@${previewVideo.post.creator.handle}` : item.neighborhood}</Text>
                </View>
              </View>
            </Pressable>
            <View style={{ paddingHorizontal: 14, paddingTop: 12, gap: 4 }}>
              {address ? <Text style={{ fontSize: 13, color: C.muted }} numberOfLines={1}>{address}</Text> : null}
              <MetaRow item={item} rating={rating} videos={sources.length || null} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="details" style={{ flexShrink: 1 }}>
            <ScrollView scrollEnabled={stage === 'full'} bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: BODY_PAD, paddingBottom: 18 }}>
              {header}
              {/* Kaynaklı özet (creator videolarından): kalın etiket + metin, ikon yok (ürün sahibi, 19.09.2026). Katlıyken ilk iki madde. */}
              {summaryItems.length > 0 ? (
                <Animated.View entering={reveal} style={{ marginTop: 14, gap: 10 }}>
                  {(stage === 'full' ? summaryItems : summaryItems.slice(0, 2)).map((it, i) => (
                    <Text key={`${it.claimType}-${i}`} style={{ fontSize: 15.5, lineHeight: 22, color: C.body }} numberOfLines={stage === 'full' ? undefined : 3}>
                      <Text style={{ fontWeight: '700', color: INK }}>{t(`claim.${it.claimType}`)} · </Text>
                      {it.text}
                    </Text>
                  ))}
                  {stage !== 'full' && summaryItems.length > 2 ? (
                    <Pressable accessibilityRole="button" onPress={() => setStage('full')} hitSlop={10} style={{ alignSelf: 'flex-start' }} testID="callout-more">
                      <Text style={{ fontSize: 14.5, fontWeight: '600', color: C.link }}>{t('callout.showMore')}</Text>
                    </Pressable>
                  ) : null}
                </Animated.View>
              ) : null}
              {strip.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16, marginHorizontal: -BODY_PAD }} contentContainerStyle={{ gap: 8, paddingHorizontal: BODY_PAD - 4 }}>
                  {strip.map((s, i) => (
                    <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={t('callout.playA11y', { creator: s.creator.handle })} onPress={() => setPlaying(s)} testID={`callout-video-${s.id}`}>
                      <Image source={{ uri: s.media.thumbnailUrl! }} contentFit="cover" transition={durations.fast} style={{ width: i === 0 ? 200 : 104, height: STRIP_HEIGHT, borderRadius: 16, backgroundColor: categoryColor(item.category) }} accessibilityIgnoresInvertColors />
                      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 52, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%)' }} />
                      <View pointerEvents="none" style={{ position: 'absolute', left: 8, right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Icon sf="play.fill" material="play-arrow" size={10} color={PAPER} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: PAPER, fontVariant: ['tabular-nums'] }} numberOfLines={1}>{formatCompactCount(s.views, locale) ?? ''}</Text>
                        {i === 0 ? <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.86)', flexShrink: 1 }} numberOfLines={1}>@{s.creator.handle}</Text> : null}
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              {creators.length > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 }}>
                  <View style={{ flexDirection: 'row' }}>
                    {creators.slice(0, 4).map((c, i) => (
                      <View key={c.id} style={{ marginLeft: i === 0 ? 0 : -8, borderRadius: 14, borderWidth: 2, borderColor: PAPER }}>
                        <CreatorAvatar name={c.displayName} url={c.avatarUrl} size={24} />
                      </View>
                    ))}
                  </View>
                  <Text style={{ fontSize: 13.5, fontWeight: '500', color: C.muted, flexShrink: 1 }} numberOfLines={1}>
                    {t('callout.recommendedBy', { count: creators.length })}{views ? ` · ${t('callout.views', { count: views })}` : ''}
                  </Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <Pressable accessibilityRole="button" onPress={() => void Linking.openURL(directionsUrl(item.location.lat, item.location.lng))} style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: 22, backgroundColor: INK, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: pressed ? 0.8 : 1 })} testID="callout-directions">
                  <Icon sf="arrow.triangle.turn.up.right.diamond.fill" material="directions" size={15} color={PAPER} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: PAPER }}>{t('callout.directions')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={openVenue} style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: 22, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })} testID="callout-open-place">
                  <Text style={{ fontSize: 15, fontWeight: '600', color: INK }}>{t('callout.openPlace')}</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={22} color="#D3D6DB" />
                  <Text style={{ fontFamily: STICKER_FONT, fontSize: 26, fontWeight: '800', color: '#D3D6DB' }}>{t(`pin.${item.category}`)}</Text>
                </View>
              </View>
            </ScrollView>
            {stage === 'full' ? (
              <Animated.View entering={enter} style={{ position: 'absolute', top: 18, right: 16 }}>
                <Pressable accessibilityRole="button" accessibilityLabel={t('callout.showLess')} onPress={() => setStage('expanded')} hitSlop={12} testID="callout-collapse">
                  <Icon sf="chevron.down" material="expand-more" size={18} color={C.muted} weight="medium" />
                </Pressable>
              </Animated.View>
            ) : null}
          </Animated.View>
        )}
        {stage === 'preview' && !playing ? (
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
      {/* Reference: in the full card the pointer goes; it returns when the card folds back. */}
      {stage !== 'full' ? <Animated.View entering={enter} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}><Tail x={tailX} /></Animated.View> : null}
      {stage === 'full' && !playing && views ? (
        <Animated.View entering={pillIn(0)} pointerEvents="box-none" style={{ position: 'absolute', right: -10, bottom: -12, alignItems: 'flex-end', gap: 8 }}>
          {views ? <StatPill sf="play.fill" material="play-arrow" color={C.star} value={views} label={t('callout.views', { count: views })} /> : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
