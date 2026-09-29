import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SourcePostDto } from '@viral-places/contracts';
import { formatCompactCount } from '@viral-places/domain';
import { radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { CreatorAvatar } from './creator-avatar';
import { Icon } from './icon';
import { ThemedText } from './themed-text';

/** Kenar dolgusu açık. Test notu: gömmeyi kısa sürede defalarca yüklemek TikTok'ta "overload-protect" tetikler (boş sayfa); tek seferde test et. */
const FILL_ENABLED = true;

/**
 * Gömme sayfası beyaz zeminli, ortalanmış bir kart çizer; kart akışkan olduğundan viewport daraltmak kenar boşluğunu
 * korur (ürün sahibi, 21.09.2026: "yanları beyaz"). Bunun yerine video elemanı ölçülür ve gövde CSS transform ile
 * (yerleşimi bozmadan; zoom kararıyordu) videoyu kabı dolduracak şekilde ölçeklenip ortalanır; taşan kısım kabın
 * dışında kalır. TikTok'un oynat düğmesi, kontrolleri ve atıfları olduğu gibi kalır.
 */
function injectFill(boxWidth: number, boxHeight: number) {
  return `(function(){
  try {
    var s = document.getElementById('vp-fill');
    if (!s) { s = document.createElement('style'); s.id = 'vp-fill'; s.textContent = 'html,body{background:#000 !important;margin:0 !important;overflow:hidden !important}body{transform-origin:0 0}'; document.head.appendChild(s); }
    // Çerez uyarısı: isteğe bağlı çerezler reddedilir (en gizlilikçi seçenek); banner videoyu kapatıyordu.
    var declineTries = 0;
    var decline = function () {
      var btns = Array.prototype.slice.call(document.querySelectorAll('button'));
      var b = btns.find(function (x) { return /decline|reddet/i.test(x.textContent || ''); });
      if (b) { b.click(); return; }
      if (declineTries++ < 40) setTimeout(decline, 250);
    };
    decline();
    var BW = ${Math.round(boxWidth)}, BH = ${Math.round(boxHeight)};
    var post = function (m) { try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} };
    // Hedef: video elemanı; yoksa dikey (9:16'ya yakın) en büyük kutu (TikTok oynatmadan önce yalnız poster çizebiliyor).
    var vertical = function (r) { var ar = r.width / r.height; return r.width >= 150 && r.height >= 200 && ar >= 0.5 && ar <= 0.65; };
    var target = function () {
      var v = document.querySelector('video');
      if (v && vertical(v.getBoundingClientRect())) return v;
      var best = null, bestArea = 0;
      var all = document.querySelectorAll('div,section,img,video,canvas');
      for (var i = 0; i < all.length; i++) {
        var r = all[i].getBoundingClientRect();
        if (!vertical(r)) continue;
        var area = r.width * r.height;
        if (area > bestArea) { best = all[i]; bestArea = area; }
      }
      return best;
    };
    var tries = 0, firstScale = 0, pinned = null;
    var fit = function () {
      var prev = document.body.style.transform;
      document.body.style.transform = 'none';
      // Hedef ilk bulunan elemana sabitlenir: sonraki ölçümler kök DIV'i (402×756) yakalayıp ölçeği 1'e sıfırlıyordu.
      var el = pinned && pinned.isConnected ? pinned : target();
      if (!el) { document.body.style.transform = prev; if (tries++ < 80) setTimeout(fit, 250); else post({ fit: 'none', w: window.innerWidth, h: window.innerHeight }); return; }
      var r = el.getBoundingClientRect();
      if (!vertical(r)) { document.body.style.transform = prev; return; }
      var sc = Math.max(BW / r.width, BH / r.height);
      if (firstScale && Math.abs(sc - firstScale) / firstScale > 0.15) { document.body.style.transform = prev; return; }
      pinned = el; firstScale = firstScale || sc;
      var x = (BW - r.width * sc) / 2 - (r.left + window.scrollX) * sc;
      var y = (BH - r.height * sc) / 2 - (r.top + window.scrollY) * sc;
      document.body.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + sc + ')';
      post({ fit: el.tagName, w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top), sc: sc.toFixed(3), iw: window.innerWidth, ih: window.innerHeight, video: !!document.querySelector('video') });
    };
    fit();
    // Oynatıcı yüklenince yerleşim değişir: birkaç kez yeniden sığdır.
    [1000, 2500, 5000].forEach(function (ms) { setTimeout(fit, ms); });
    window.addEventListener('resize', fit);
  } catch (e) {}
})(); true;`;
}

export function TikTokEmbedPlayer({ post, visible, onClose, onCreatorPress }: { post: SourcePostDto; visible: boolean; onClose: () => void; onCreatorPress?: (creatorId: string) => void }) {
  const { t, locale } = useT();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const url = post.media.embedUrl;
  const views = formatCompactCount(post.views, locale);
  const likes = formatCompactCount(post.likes ?? null, locale);

  // Video alanı: üstte kapat düğmesi, altta atıf şeridi; aradaki tüm alan video (kenar boşluğu yok).
  const topChrome = insets.top + 56;
  const bottomChrome = insets.bottom + 84;
  const playerWidth = width;
  const playerHeight = Math.max(200, height - topChrome - bottomChrome);

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        {url ? (
          <View style={{ position: 'absolute', top: topChrome, left: 0, width: playerWidth, height: playerHeight, backgroundColor: '#000', overflow: 'hidden' }}>
            <WebView
              source={{ uri: url }}
              // Sayfa ölçeklenene kadar beyaz kart görünmesin.
              style={{ width: playerWidth, height: playerHeight, backgroundColor: '#000', opacity: loading ? 0 : 1 }}
              allowsInlineMediaPlayback
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              // Önbelleksiz: TikTok'un geçici kısıtlama sayfası HTTP önbelleğinden tekrar sunulmasın. incognito KULLANILMAZ: gömme, depolama olmadan boş kalıyor.
              cacheEnabled={false}
              scrollEnabled={false}
              bounces={false}
              injectedJavaScript={FILL_ENABLED ? injectFill(playerWidth, playerHeight) : undefined}
              onLoadEnd={() => setTimeout(() => setLoading(false), 400)}
              onMessage={(e) => { if (__DEV__) console.log('[embed-fit]', e.nativeEvent.data); }}
              originWhitelist={['https://*']}
              onShouldStartLoadWithRequest={(req) => {
                if (req.url.startsWith('https://www.tiktok.com/embed') || req.url.includes('tiktokcdn') || req.url.startsWith('about:')) return true;
                void WebBrowser.openBrowserAsync(req.url);
                return false;
              }}
              testID="tiktok-embed-webview"
            />
          </View>
        ) : null}

        {loading && url ? (
          <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center', gap: spacing.sm }}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}

        {/* Kapat: video alanının üstünde yüzer, güvenli alanın içinde. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          hitSlop={10}
          style={{ position: 'absolute', top: insets.top + spacing.sm, right: spacing.lg, width: 40, height: 40, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' }}
          testID="embed-close"
        >
          <Icon sf="xmark" material="close" size={18} color="#FFFFFF" />
        </Pressable>

        {/* Atıf ve sayılar videonun üstünde; TikTok'a gitme bağlantısı korunur (§14.2). */}
        <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: insets.bottom + spacing.lg, gap: spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={post.creator.displayName}
            disabled={!onCreatorPress}
            onPress={() => {
              onClose();
              onCreatorPress?.(post.creator.id);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
            testID="embed-creator"
          >
            <CreatorAvatar name={post.creator.displayName} url={post.creator.avatarUrl} size={36} />
            <View style={{ flex: 1 }}>
              <ThemedText variant="bodyStrong" numberOfLines={1} style={{ color: '#FFFFFF' }}>
                {post.creator.displayName}
              </ThemedText>
              <ThemedText variant="caption" numberOfLines={1} style={{ color: 'rgba(255,255,255,0.72)', fontVariant: ['tabular-nums'] }}>
                @{post.creator.handle} · {views ? t('media.views', { count: views }) : t('media.viewsNA')}
                {likes ? ` · ${t('media.likes', { count: likes })}` : ''}
              </ThemedText>
            </View>
            {post.media.sourceUrl ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t('media.openOnPlatform', { platform: 'TikTok' })}
                onPress={() => void WebBrowser.openBrowserAsync(post.media.sourceUrl!)}
                hitSlop={8}
                style={{ width: 40, height: 40, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' }}
                testID="embed-open-source"
              >
                <Icon sf="arrow.up.right" material="open-in-new" size={16} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
