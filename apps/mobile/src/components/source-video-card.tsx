import { Alert, Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { SourcePostDto } from '@viral-places/contracts';
import { CATEGORY_META, formatCompactCount, type Category, type RenderMode } from '@viral-places/domain';
import { categoryColor, categoryTint, colors, radius, spacing, surfaceMuted } from '@/theme';
import { useT } from '@/hooks/use-t';
import { PLATFORM_LABEL } from '@/i18n';
import { CreatorAvatar } from './creator-avatar';
import { Icon } from './icon';
import { ThemedText } from './themed-text';

/**
 * Hak-duyarlı medya yer tutucusu (RightsAwareMedia, §7.8/§14.2). Görsel yalnız izinli thumbnail varsa;
 * aksi halde kategori tintli sakin bir alan. Sahte video/foto ile boşluk doldurulmaz.
 */
export function MediaPlaceholder({ category, mode, size, aspect = 1 }: { category: Category; mode: RenderMode; size: number; aspect?: number }) {
  const meta = CATEGORY_META[category];
  const muted = mode === 'unavailable';
  return (
    <View
      style={{
        width: size,
        height: size * aspect,
        borderRadius: radius.cardSmall,
        borderCurve: 'continuous',
        backgroundColor: muted ? surfaceMuted : categoryTint(category, 0.16),
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Icon sf={muted ? 'eye.slash' : meta.sfSymbol} material={muted ? 'visibility-off' : (meta.materialIcon as never)} size={Math.max(20, size * 0.26)} color={muted ? colors.textSecondary : categoryColor(category)} weight="regular" />
    </View>
  );
}

async function openSource(url: string, onDemo: () => void) {
  const host = new URL(url).hostname;
  if (host.endsWith('.invalid')) {
    onDemo();
    return;
  }
  await WebBrowser.openBrowserAsync(url);
}

/** Video şeridi kartı (§7.3): creator, platform, tarih, reklam etiketi, izinli gösterim modu. */
export function SourceVideoCard({ post, category, onCreatorPress, width = 132 }: { post: SourcePostDto; category: Category; onCreatorPress?: (creatorId: string) => void; width?: number }) {
  const { t, locale } = useT();
  const platform = PLATFORM_LABEL[post.platform];
  const views = formatCompactCount(post.views, locale);
  const mode = post.media.mode;
  const openable = (mode === 'link_only' || mode === 'official_embed') && !!post.media.sourceUrl;
  const date = new Date(post.publishedAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short' });
  const label = mode === 'unavailable' ? t('media.unavailable') : t('media.linkOnly', { platform });

  return (
    <View style={{ width, gap: spacing.sm }} testID={`source-${post.id}`}>
      <Pressable
        accessibilityRole={openable ? 'link' : 'text'}
        accessibilityLabel={label}
        disabled={!openable}
        onPress={() => post.media.sourceUrl && openSource(post.media.sourceUrl, () => Alert.alert(t('app.name'), t('media.demoLink')))}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <View>
          <MediaPlaceholder category={category} mode={mode} size={width} aspect={1.35} />
          <View style={{ position: 'absolute', left: spacing.sm, bottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(17,24,39,0.72)', borderRadius: radius.chip, paddingHorizontal: spacing.sm, paddingVertical: 3 }}>
            <Icon sf={openable ? 'arrow.up.right.square' : 'eye.slash'} material={openable ? 'open-in-new' : 'visibility-off'} size={11} color={colors.surface} />
            <ThemedText variant="caption" tone="inverse" style={{ fontVariant: ['tabular-nums'] }}>
              {views ?? t('media.viewsNA')}
            </ThemedText>
          </View>
          {post.sponsored === 'declared' ? (
            <View style={{ position: 'absolute', left: spacing.sm, top: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.chip, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
              <ThemedText variant="caption" tone="secondary">
                {t('media.sponsored')}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={post.creator.displayName}
        onPress={() => onCreatorPress?.(post.creator.id)}
        disabled={!onCreatorPress}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
        testID={`source-creator-${post.creator.id}`}
      >
        <CreatorAvatar name={post.creator.displayName} url={post.creator.avatarUrl} size={24} />
        <View style={{ flex: 1 }}>
          <ThemedText variant="caption" numberOfLines={1}>
            @{post.creator.handle}
          </ThemedText>
          <ThemedText variant="caption" tone="secondary" numberOfLines={1} accessibilityLabel={t('a11y.platformIcon', { platform })}>
            {platform} · {date}
          </ThemedText>
        </View>
      </Pressable>
      {mode === 'unavailable' ? (
        <ThemedText variant="caption" tone="secondary" numberOfLines={2}>
          {t('media.unavailableReason')}
        </ThemedText>
      ) : null}
    </View>
  );
}
