import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { SourcePostDto } from '@viral-places/contracts';
import { mapTheme } from '@/theme';
import { useT } from '@/hooks/use-t';
import { Icon } from '@/components/icon';
import { CreatorAvatar } from '@/components/creator-avatar';

/**
 * Stored source file in the native player (ADR-023): cached on device (`useCaching`), looping, no player chrome,
 * filling its frame. Starts muted; the creator stays credited on screen. With `playing={false}` it buffers only.
 */
export function FileVideo({ post, url, width, height, radius, onClose, controlsTop = 10, creditBottom = 10, startMuted = true, onMutedChange, playing = true, ambient = false }: {
  post: SourcePostDto;
  url: string;
  width: number;
  height: number;
  radius: number;
  onClose?: () => void;
  controlsTop?: number;
  creditBottom?: number;
  startMuted?: boolean;
  onMutedChange?: (muted: boolean) => void;
  controlsSide?: 'top' | 'none';
  playing?: boolean;
  /** Card preview (ADR-023): silent loop with no controls; taps pass through to the card. Credit stays. */
  ambient?: boolean;
}) {
  const { t } = useT();
  const [muted, setMuted] = useState(startMuted);
  const [paused, setPaused] = useState(false);
  const player = useVideoPlayer({ uri: url, useCaching: true }, (p) => {
    p.loop = true;
    p.muted = startMuted;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const [firstFrame, setFirstFrame] = useState(false);
  // The native player is released when the page unmounts (reels recycle pages); late calls must not crash.
  const safe = (fn: () => void) => { try { fn(); } catch { /* released player */ } };

  // Play only while this is the visible video; a preloaded neighbour just buffers.
  useEffect(() => {
    safe(() => { if (playing && !paused) player.play(); else player.pause(); });
  }, [player, playing, paused]);
  const pauseRef = useRef(() => {});
  pauseRef.current = () => { safe(() => player.pause()); setPaused(true); };
  useFocusEffect(useCallback(() => () => pauseRef.current(), []));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') pauseRef.current(); });
    return () => sub.remove();
  }, []);

  const toggleSound = () => { safe(() => { player.muted = !muted; }); setMuted(!muted); onMutedChange?.(!muted); };
  const togglePlay = () => setPaused((p) => !p);
  const failed = status === 'error';
  const poster = post.media.mode !== 'unavailable' ? post.media.thumbnailUrl : null;
  const round = { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center' as const, justifyContent: 'center' as const };

  return (
    <View style={{ width, height, borderRadius: radius, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: '#000' }} testID="file-video">
      <VideoView
        player={player}
        style={{ position: 'absolute', inset: 0 }}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
        onFirstFrameRender={() => setFirstFrame(true)}
        accessible={false}
      />
      {/* Cover until the first frame: no black flash between swipes. */}
      {!firstFrame && poster ? <Image source={{ uri: poster }} contentFit="cover" style={{ position: 'absolute', inset: 0 }} accessibilityIgnoresInvertColors /> : null}
      {!firstFrame && !failed && playing && !ambient ? <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={mapTheme.paper} /></View> : null}
      {failed ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('media.playbackFailed')} onPress={() => safe(() => player.replace({ uri: url, useCaching: true }))} style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <View style={{ ...round, width: 52, height: 52, borderRadius: 26 }}><Icon sf="arrow.clockwise" material="refresh" size={22} color={mapTheme.paper} /></View>
        </Pressable>
      ) : null}
      {/* Tap anywhere on the picture to pause or resume. */}
      {!failed && !ambient ? <Pressable accessibilityRole="button" accessibilityLabel={t(paused ? 'callout.play' : 'callout.pause')} onPress={togglePlay} style={{ position: 'absolute', inset: 0 }} /> : null}
      {paused && !failed ? (
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ ...round, width: 64, height: 64, borderRadius: 32 }}><Icon sf="play.fill" material="play-arrow" size={26} color={mapTheme.paper} /></View>
        </View>
      ) : null}
      {!ambient ? <View pointerEvents="box-none" style={{ position: 'absolute', top: controlsTop, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
        {onClose ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('media.stop')} onPress={onClose} hitSlop={6} style={round} testID="callout-video-close">
            <Icon sf="xmark" material="close" size={15} color={mapTheme.paper} />
          </Pressable>
        ) : <View />}
        <Pressable accessibilityRole="button" accessibilityLabel={t(muted ? 'callout.unmute' : 'callout.mute')} onPress={toggleSound} hitSlop={6} style={round} testID="callout-video-sound">
          <Icon sf={muted ? 'speaker.slash.fill' : 'speaker.wave.2.fill'} material={muted ? 'volume-off' : 'volume-up'} size={15} color={mapTheme.paper} />
        </Pressable>
      </View> : null}
      {/* Creator credit stays on the picture (ADR-023). */}
      {onClose && !ambient ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 10, bottom: creditBottom, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 3, paddingRight: 10, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <CreatorAvatar name={post.creator.displayName} url={post.creator.avatarUrl} size={24} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: mapTheme.paper }} numberOfLines={1}>@{post.creator.handle}</Text>
        </View>
      ) : null}
    </View>
  );
}
