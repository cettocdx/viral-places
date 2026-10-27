import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';
import type { SourcePostDto } from '@viral-places/contracts';
import { mapTheme } from '@/theme';
import { useT } from '@/hooks/use-t';
import { appConfig } from '@/lib/config';
import { sourcePlayback, sourcePlayerHtml } from '@/lib/source-playback';
import { Icon } from '@/components/icon';

const PLAYER_ORIGIN = 'https://www.tiktok.com';

/**
 * The chosen source video filling the map card, no player chrome (ADR-020). Starts muted (autoplay rule) and loops;
 * one speaker button toggles sound, one button returns to the card.
 */
export function CalloutVideo({ post, width, height, radius, onClose }: { post: SourcePostDto; width: number; height: number; radius: number; onClose: () => void }) {
  const { t } = useT();
  const web = useRef<WebView>(null);
  const allowLocalHttp = __DEV__ && appConfig.dataMode === 'demo';
  const playback = useMemo(() => sourcePlayback(post, { allowLocalHttp, bare: true }), [post, allowLocalHttp]);
  const canPlay = playback.kind === 'video' || playback.kind === 'embed';
  const poster = post.media.mode !== 'unavailable' ? post.media.thumbnailUrl : null;
  const html = useMemo(() => (canPlay ? sourcePlayerHtml(playback, poster, { bare: true }) : null), [playback, canPlay, poster]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [paused, setPaused] = useState(false);

  // Leaving the screen or the app pauses the video; the user resumes it.
  const pauseRef = useRef<() => void>(() => {});
  useFocusEffect(useCallback(() => () => pauseRef.current(), []));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') pauseRef.current(); });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (ready || failed) return;
    const timer = setTimeout(() => setFailed(true), 20_000);
    return () => clearTimeout(timer);
  }, [ready, failed, attempt]);

  const command = (type: 'mute' | 'unMute' | 'play' | 'pause') => {
    const js = playback.kind === 'video'
      ? `(function(){var v=document.getElementById('v');if(!v)return;${type === 'mute' ? 'v.muted=true' : type === 'unMute' ? 'v.muted=false' : type === 'play' ? 'v.play()' : 'v.pause()'}})();true;`
      : `(function(){var p=document.getElementById('p');p&&p.contentWindow&&p.contentWindow.postMessage({type:${JSON.stringify(type)},'x-tiktok-player':true},${JSON.stringify(PLAYER_ORIGIN)});})();true;`;
    web.current?.injectJavaScript(js);
  };
  pauseRef.current = () => { command('pause'); setPaused(true); };
  const toggleSound = () => { command(muted ? 'unMute' : 'mute'); setMuted(!muted); };
  const togglePlay = () => { command(paused ? 'play' : 'pause'); setPaused(!paused); };
  const retry = () => { setFailed(false); setReady(false); setAttempt((n) => n + 1); };

  const round = { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ width, height, borderRadius: radius, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: '#000' }} testID="callout-video">
      {poster ? <Image source={{ uri: poster }} contentFit="cover" style={{ position: 'absolute', inset: 0 }} accessibilityIgnoresInvertColors /> : null}
      {html && !failed ? (
        <WebView
          ref={web}
          key={`${post.id}:${attempt}`}
          source={{ html, baseUrl: 'https://viral-places-api.vercel.app' }}
          style={{ flex: 1, backgroundColor: 'transparent', opacity: ready ? 1 : 0 }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          scrollEnabled={false}
          bounces={false}
          originWhitelist={['https://*', 'about:*', ...(allowLocalHttp ? ['http://127.0.0.1:*', 'http://localhost:*'] : [])]}
          onMessage={(event) => {
            try {
              const message = JSON.parse(event.nativeEvent.data);
              if (message.type === 'ready' || message.type === 'playing') setReady(true);
              if (message.type === 'error') setFailed(true);
            } catch { /* Only the host page's small event protocol is accepted. */ }
          }}
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
          onShouldStartLoadWithRequest={(request) => {
            if (request.url.startsWith('about:') || request.url === 'https://viral-places-api.vercel.app/') return true;
            if (playback.kind === 'video') return request.url === playback.url;
            if (playback.kind === 'embed') {
              try {
                const expected = new URL(playback.url);
                const target = new URL(request.url);
                return target.origin === expected.origin && target.pathname === expected.pathname;
              } catch { return false; }
            }
            return false;
          }}
        />
      ) : null}
      {!ready && !failed && canPlay ? <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={mapTheme.paper} /></View> : null}
      {failed || !canPlay ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('media.playbackFailed')} disabled={!canPlay} onPress={retry} style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <View style={{ ...round, width: 52, height: 52, borderRadius: 26 }}>
            <Icon sf={canPlay ? 'arrow.clockwise' : 'video.slash'} material={canPlay ? 'refresh' : 'videocam-off'} size={22} color={mapTheme.paper} />
          </View>
        </Pressable>
      ) : null}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('media.stop')} onPress={onClose} hitSlop={6} style={round} testID="callout-video-close">
          <Icon sf="xmark" material="close" size={15} color={mapTheme.paper} />
        </Pressable>
        {ready ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t(paused ? 'callout.play' : 'callout.pause')} onPress={togglePlay} hitSlop={6} style={round} testID="callout-video-play">
              <Icon sf={paused ? 'play.fill' : 'pause.fill'} material={paused ? 'play-arrow' : 'pause'} size={15} color={mapTheme.paper} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t(muted ? 'callout.unmute' : 'callout.mute')} onPress={toggleSound} hitSlop={6} style={round} testID="callout-video-sound">
              <Icon sf={muted ? 'speaker.slash.fill' : 'speaker.wave.2.fill'} material={muted ? 'volume-off' : 'volume-up'} size={15} color={mapTheme.paper} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}
