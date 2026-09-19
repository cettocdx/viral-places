import { useState } from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SourcePostDto } from '@viral-places/contracts';
import { formatCompactCount } from '@viral-places/domain';
import { colors, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { CreatorAvatar } from './creator-avatar';
import { Icon } from './icon';
import { ThemedText } from './themed-text';

/**
 * Resmi TikTok gömme oynatıcısı (§14.2 official_embed): platformun kendi oynatıcısı, atıf ve bağlantıları korunur.
 * Video uygulama içinde (WebView) oynar; yeniden barındırma/kırpma yok. Yalnız gömme adresi ve TikTok CDN'i
 * çerçeve içinde kalır; başka gezinmeler sistem tarayıcısına gider.
 */
export function TikTokEmbedPlayer({ post, visible, onClose, onCreatorPress }: { post: SourcePostDto; visible: boolean; onClose: () => void; onCreatorPress?: (creatorId: string) => void }) {
  const { t, locale } = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const url = post.media.embedUrl;
  const playerHeight = Math.min(Math.round((width - spacing.lg * 2) * 1.78), 640);
  const views = formatCompactCount(post.views, locale);
  const likes = formatCompactCount(post.likes ?? null, locale);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: spacing.md, paddingBottom: insets.bottom }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={post.creator.displayName}
            disabled={!onCreatorPress}
            onPress={() => {
              onClose();
              onCreatorPress?.(post.creator.id);
            }}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
            testID="embed-creator"
          >
            <CreatorAvatar name={post.creator.displayName} url={post.creator.avatarUrl} size={36} />
            <View style={{ flex: 1 }}>
              <ThemedText variant="sectionTitle" numberOfLines={1}>{post.creator.displayName}</ThemedText>
              <ThemedText variant="caption" tone="secondary" numberOfLines={1}>@{post.creator.handle} · TikTok</ThemedText>
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={8} style={{ width: 40, height: 40, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }} testID="embed-close">
            <Icon sf="xmark" material="close" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={{ marginTop: spacing.md, marginHorizontal: spacing.lg, height: playerHeight, borderRadius: radius.cardLarge, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: '#000' }}>
          {url ? (
            <WebView
              source={{ uri: url }}
              style={{ flex: 1, backgroundColor: '#000' }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              onLoadEnd={() => setLoading(false)}
              originWhitelist={['https://*']}
              onShouldStartLoadWithRequest={(req) => {
                if (req.url.startsWith('https://www.tiktok.com/embed') || req.url.includes('tiktokcdn') || req.url.startsWith('about:')) return true;
                void WebBrowser.openBrowserAsync(req.url);
                return false;
              }}
              testID="tiktok-embed-webview"
            />
          ) : null}
          {loading && url ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <ThemedText tone="inverse">{t('media.loading')}</ThemedText>
            </View>
          ) : null}
        </View>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm }}>
          <ThemedText variant="caption" tone="secondary" style={{ fontVariant: ['tabular-nums'] }}>
            {views ? t('media.views', { count: views }) : t('media.viewsNA')}
            {likes ? ` · ${t('media.likes', { count: likes })}` : ''}
          </ThemedText>
          <ThemedText variant="caption" tone="secondary">{t('media.embedNotice')}</ThemedText>
          {post.media.sourceUrl ? (
            <Pressable accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(post.media.sourceUrl!)} testID="embed-open-source">
              <ThemedText variant="caption" style={{ textDecorationLine: 'underline' }}>{t('media.openOnPlatform', { platform: 'TikTok' })}</ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
