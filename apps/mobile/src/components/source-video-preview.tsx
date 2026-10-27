import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import type { SourcePostDto } from '@viral-places/contracts';
import { colors, dimensions, hexToRgba, mapTheme, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { appConfig } from '@/lib/config';
import { sourcePlayback, sourcePlayerHtml } from '@/lib/source-playback';
import { validateSocialUrl } from '@/lib/validate-social-url';
import { PLATFORM_LABEL } from '@/i18n';
import { Icon } from './icon';
import { ThemedText } from './themed-text';
import { CreatorAvatar } from './creator-avatar';

/** Only mounted for the selected venue. Playback stays inside its map card. */
export function SourceVideoPreview({ post, onCreatorPress }: { post: SourcePostDto; onCreatorPress: (id: string) => void }) {
  const { t } = useT();
  const allowLocalHttp = __DEV__ && appConfig.dataMode === 'demo';
  const playback = useMemo(() => sourcePlayback(post, { allowLocalHttp }), [post, allowLocalHttp]);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const canPlay = playback.kind === 'video' || playback.kind === 'embed';
  const thumbnail = post.media.mode !== 'unavailable' && playback.kind !== 'unavailable' ? post.media.thumbnailUrl : null;
  const sourceUrl = post.media.sourceUrl && validateSocialUrl(post.media.sourceUrl) === 'valid' ? post.media.sourceUrl : null;
  const html = useMemo(() => canPlay ? sourcePlayerHtml(playback, thumbnail) : null, [playback, canPlay, thumbnail]);

  useFocusEffect(useCallback(() => () => setPlaying(false), []));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state !== 'active') setPlaying(false); });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!playing || !loading || failed) return;
    const timer = setTimeout(() => { setFailed(true); setLoading(false); }, 22_000);
    return () => clearTimeout(timer);
  }, [playing, loading, failed, attempt]);

  const play = () => { setFailed(false); setLoading(true); setAttempt((n) => n + 1); setPlaying(true); };
  const openSource = () => { if (sourceUrl) void WebBrowser.openBrowserAsync(sourceUrl); };

  return (
    <View style={{ gap: spacing.sm }} testID="place-preview-video">
      <View style={{ aspectRatio: 16 / 9, borderRadius: radius.cardSmall, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: mapTheme.water }}>
        {playing && canPlay && html && !failed ? (
          <>
            <WebView
              key={`${post.id}:${attempt}`}
              source={{ html, baseUrl: 'https://viral-places-api.vercel.app' }}
              style={{ flex: 1, backgroundColor: mapTheme.water }}
              allowsInlineMediaPlayback
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              scrollEnabled={false}
              bounces={false}
              originWhitelist={['https://*', 'about:*', ...(allowLocalHttp ? ['http://127.0.0.1:*', 'http://localhost:*'] : [])]}
              onMessage={(event) => {
                try {
                  const message = JSON.parse(event.nativeEvent.data);
                  if (message.type === 'ready' || message.type === 'playing') setLoading(false);
                  if (message.type === 'error') { setFailed(true); setLoading(false); }
                } catch { /* Only the small host-page event protocol is accepted. */ }
              }}
              onLoadEnd={() => { if (playback.kind === 'embed' && playback.platform === 'instagram') setLoading(false); }}
              onError={() => { setFailed(true); setLoading(false); }}
              onHttpError={() => { setFailed(true); setLoading(false); }}
              onShouldStartLoadWithRequest={(request) => {
                if (request.url.startsWith('about:') || request.url === 'https://viral-places-api.vercel.app/') return true;
                if (playback.kind === 'video') return request.url === playback.url;
                if (playback.kind === 'embed') {
                  try {
                    const expected = new URL(playback.url);
                    const target = new URL(request.url);
                    if (target.origin === expected.origin && target.pathname === expected.pathname) return true;
                  } catch { return false; }
                }
                if (request.navigationType === 'click' && validateSocialUrl(request.url) === 'valid') void WebBrowser.openBrowserAsync(request.url);
                return false;
              }}
              testID="place-inline-video-webview"
            />
            {loading ? <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={mapTheme.paper} /></View> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={t('media.stop')} onPress={() => setPlaying(false)} style={{ position: 'absolute', top: spacing.sm, right: spacing.sm, width: dimensions.iosTouchTargetMin, height: dimensions.iosTouchTargetMin, borderRadius: radius.chip, backgroundColor: hexToRgba(mapTheme.ink, 0.8), alignItems: 'center', justifyContent: 'center' }} testID="place-preview-video-stop">
              <Icon sf="xmark" material="close" size={18} color={mapTheme.paper} />
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={failed ? t('common.retry') : canPlay ? t('media.watch') : playback.kind === 'link' ? t('media.openOnPlatform', { platform: PLATFORM_LABEL[post.platform] }) : t('media.unavailable')}
            disabled={!canPlay && playback.kind !== 'link'}
            onPress={canPlay ? play : openSource}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}
            testID="place-preview-video-play"
          >
            {thumbnail && !thumbnailFailed ? <Image source={{ uri: thumbnail }} contentFit="cover" style={{ position: 'absolute', inset: 0 }} onError={() => setThumbnailFailed(true)} accessibilityIgnoresInvertColors /> : null}
            <View style={{ width: 52, height: 52, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center', backgroundColor: hexToRgba(mapTheme.ink, 0.8) }}>
              <Icon sf={failed ? 'arrow.clockwise' : canPlay ? 'play.fill' : playback.kind === 'link' ? 'arrow.up.right' : 'video.slash'} material={failed ? 'refresh' : canPlay ? 'play-arrow' : playback.kind === 'link' ? 'open-in-new' : 'videocam-off'} size={24} color={mapTheme.paper} />
            </View>
            <ThemedText variant="caption" style={{ color: mapTheme.paper, backgroundColor: hexToRgba(mapTheme.ink, 0.8), paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.chip }}>
              {failed ? t('media.playbackFailed') : canPlay ? t('media.watch') : playback.kind === 'link' ? t('media.openOnPlatform', { platform: PLATFORM_LABEL[post.platform] }) : t('media.unavailable')}
            </ThemedText>
          </Pressable>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel={post.creator.displayName} onPress={() => onCreatorPress(post.creator.id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: dimensions.iosTouchTargetMin }}>
          <CreatorAvatar name={post.creator.displayName} url={post.creator.avatarUrl} size={28} />
          <View style={{ flex: 1 }}>
            <ThemedText variant="caption" numberOfLines={1}>@{post.creator.handle}</ThemedText>
            <ThemedText variant="caption2" tone="secondary">{PLATFORM_LABEL[post.platform]}</ThemedText>
          </View>
        </Pressable>
        {sourceUrl && playback.kind !== 'unavailable' ? <Pressable accessibilityRole="link" accessibilityLabel={t('media.openOnPlatform', { platform: PLATFORM_LABEL[post.platform] })} onPress={openSource} style={{ width: dimensions.iosTouchTargetMin, height: dimensions.iosTouchTargetMin, alignItems: 'center', justifyContent: 'center' }}><Icon sf="arrow.up.right.square" material="open-in-new" size={18} color={colors.textSecondary} /></Pressable> : null}
      </View>
    </View>
  );
}
