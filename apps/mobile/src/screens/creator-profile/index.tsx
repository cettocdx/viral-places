import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { CATEGORY_META, formatCompactCount, type Category } from '@viral-places/domain';
import { categoryTextColor, categoryTint, colors, hairline, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { PLATFORM_LABEL } from '@/i18n';
import { useCreator } from '@/lib/api/hooks';
import { useIsFollowing, useLibraryStore } from '@/features/library/store';
import { hapticCommit } from '@/lib/haptics';
import { Button, IconButton } from '@/components/button';
import { CategoryChip } from '@/components/category-chip';
import { CreatorAvatar } from '@/components/creator-avatar';
import { DemoBadge } from '@/components/demo-badge';
import { Icon } from '@/components/icon';
import { SourceVideoCard } from '@/components/source-video-card';
import { ErrorState, SkeletonBlock } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { ViralBadge } from '@/components/viral-badge';
import { VenueMap } from '@/components/map/venue-map';

/** Creator profili (§7.4): kimlik → mini harita → chip'ler → videolar → "paylaştığı yerler" → tarz. */
export function CreatorProfileScreen({ id }: { id: string }) {
  const { t, locale } = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const creator = useCreator(id);
  const following = useIsFollowing(id);
  const follow = useLibraryStore((s) => s.follow);
  const unfollow = useLibraryStore((s) => s.unfollow);
  const [category, setCategory] = useState<Category | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);

  const places = useMemo(() => (creator.data?.places ?? []).filter((p) => !category || p.category === category), [creator.data, category]);

  const topBar = (
    <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <IconButton accessibilityLabel={t('place.back')} onPress={() => router.back()} testID="creator-back">
        <Icon sf="chevron.left" material="arrow-back" size={20} color={colors.textPrimary} />
      </IconButton>
      <ThemedText variant="headline" numberOfLines={1} style={{ flex: 1, textAlign: 'center', paddingHorizontal: spacing.md }}>
        {creator.data?.displayName ?? ''}
      </ThemedText>
      <IconButton accessibilityLabel={t('place.share')} onPress={() => creator.data && Share.share({ message: `${creator.data.displayName} — DEMO` })}>
        <Icon sf="square.and.arrow.up" material="ios-share" size={20} color={colors.textPrimary} />
      </IconButton>
    </View>
  );

  if (creator.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {topBar}
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <SkeletonBlock height={96} width="60%" rounded={48} />
          <SkeletonBlock height={200} />
        </View>
      </View>
    );
  }
  if (creator.isError || !creator.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {topBar}
        <ErrorState message={t('creator.notFound')} retryTitle={t('common.retry')} onRetry={() => creator.refetch()} />
      </View>
    );
  }
  const c = creator.data;
  const platform = PLATFORM_LABEL[c.platform];
  const followers = c.platformFollowers ? formatCompactCount(c.platformFollowers.count, locale) : null;

  const openProfile = async () => {
    if (new URL(c.profileUrl).hostname.endsWith('.invalid')) {
      Alert.alert(t('app.name'), t('media.demoLink'));
      return;
    }
    await WebBrowser.openBrowserAsync(c.profileUrl);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {topBar}
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }} testID="creator-scroll">
        <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
          <CreatorAvatar name={c.displayName} url={c.avatarUrl} size={88} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <ThemedText variant="screenTitle" style={{ flexShrink: 1 }} numberOfLines={2}>
                {c.displayName}
              </ThemedText>
              <DemoBadge compact />
            </View>
            <ThemedText variant="helper" tone="secondary">
              @{c.handle} · {platform}
            </ThemedText>
            <ThemedText tone="secondary">{c.bio ? c.bio.text : t('creator.bioNA')}</ThemedText>
            <ThemedText variant="caption" tone="secondary">
              {followers && c.platformFollowers
                ? t('creator.followersObserved', { count: followers, platform, date: new Date(c.platformFollowers.observedAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-GB') })
                : t('creator.followersNA')}
            </ThemedText>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            title={following ? t('creator.following') : t('creator.follow')}
            variant={following ? 'secondary' : 'primary'}
            onPress={() => {
              hapticCommit();
              following ? unfollow(id) : follow(id);
            }}
            accessibilityLabel={t('creator.followA11y', { name: c.displayName })}
            style={{ flex: 1 }}
            icon={<Icon sf={following ? 'checkmark' : 'plus'} material={following ? 'check' : 'add'} size={16} color={following ? colors.textPrimary : colors.surface} />}
            testID="creator-follow"
          />
          <IconButton accessibilityLabel={t('creator.openProfile', { platform })} onPress={openProfile} style={{ width: 52, height: 52, borderRadius: radius.cardSmall }}>
            <Icon sf="arrow.up.right.square" material="open-in-new" size={20} color={colors.textPrimary} />
          </IconButton>
        </View>
        <ThemedText variant="caption" tone="secondary">
          {t('creator.inAppFollowNote')} {t('creator.compiledNotice')}
        </ThemedText>

        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <ThemedText variant="sectionTitle" style={{ flex: 1 }} numberOfLines={2}>
              {t('creator.world', { name: c.displayName })}
            </ThemedText>
            <Pressable accessibilityRole="link" onPress={() => router.navigate('/(tabs)')} hitSlop={8}>
              <ThemedText variant="helper" style={{ color: colors.primaryAction, fontWeight: '600' }}>
                {t('creator.allMap')} ›
              </ThemedText>
            </Pressable>
          </View>
          <View style={{ height: 260, borderRadius: radius.cardLarge, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 1, borderColor: hairline }}>
            <VenueMap
              items={places}
              selectedId={selectedPlace}
              onSelect={setSelectedPlace}
              initialCamera={{ center: places[0]?.location ?? { lat: 41.03, lng: 28.98 }, zoom: 12 }}
              onViewportSettled={() => {}}
              bottomInset={0}
              userLocation={null}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: category === null }} onPress={() => setCategory(null)} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.chip, backgroundColor: category === null ? colors.primaryAction : colors.surface, borderWidth: 1, borderColor: hairline, justifyContent: 'center' }}>
              <ThemedText variant="bodyStrong" style={{ color: category === null ? colors.surface : colors.textPrimary }}>
                {t('creator.allCategories')}
              </ThemedText>
            </Pressable>
            {c.categories.map((cat) => (
              <CategoryChip key={cat} category={cat} selected={category === cat} onPress={(x) => setCategory(category === x ? null : x)} />
            ))}
          </ScrollView>
        </View>

        <View style={{ gap: spacing.md }}>
          <ThemedText variant="sectionTitle">{t('creator.popularPosts')}</ThemedText>
          {c.posts.length === 0 ? (
            <ThemedText tone="secondary">{t('place.sourcesEmpty')}</ThemedText>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
              {c.posts.map((p) => (
                <SourceVideoCard key={p.id} post={p} category={c.categories[0] ?? 'food'} width={120} />
              ))}
            </ScrollView>
          )}
        </View>

        <View style={{ gap: spacing.md }}>
          <ThemedText variant="sectionTitle">{t('creator.places')}</ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {places.map((p) => {
              const meta = CATEGORY_META[p.category];
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={p.name}
                  onPress={() => router.push({ pathname: '/places/[id]', params: { id: p.id } })}
                  style={({ pressed }) => ({ width: '47%', backgroundColor: colors.surface, borderRadius: radius.cardSmall, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 1, borderColor: hairline, opacity: pressed ? 0.9 : 1 })}
                  testID={`creator-place-${p.id}`}
                >
                  <View style={{ height: 96, backgroundColor: categoryTint(p.category, 0.16), alignItems: 'center', justifyContent: 'center' }}>
                    <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={28} color={categoryTextColor(p.category)} weight="regular" />
                  </View>
                  <View style={{ padding: spacing.md, gap: spacing.xs }}>
                    <ThemedText variant="bodyStrong" numberOfLines={2}>
                      {p.name}
                    </ThemedText>
                    <ThemedText variant="helper" tone="secondary" numberOfLines={1}>
                      {p.neighborhood ?? ''}
                    </ThemedText>
                    <ViralBadge score={p.trend.score} status={p.trend.status} trending={p.trend.trending} size="sm" />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: radius.cardLarge, borderCurve: 'continuous', padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: hairline }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon sf="sparkles" material="auto-awesome" size={18} color={colors.culture} />
            <ThemedText variant="headline">{t('creator.style')}</ThemedText>
          </View>
          {c.styleNotes.length === 0 ? <ThemedText tone="secondary">{t('creator.styleEmpty')}</ThemedText> : c.styleNotes.map((n, i) => <ThemedText key={i}>{n.text}</ThemedText>)}
        </View>
      </ScrollView>
    </View>
  );
}
