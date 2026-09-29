import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { CATEGORY_META, formatCompactCount, type Category } from '@viral-places/domain';
import { categoryTextColor, categoryTint, colors, hairline, pressedTint, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { PLATFORM_LABEL } from '@/i18n';
import { useCreator } from '@/lib/api/hooks';
import { useIsFollowing, useLibraryStore } from '@/features/library/store';
import { hapticCommit } from '@/lib/haptics';
import { Button, IconButton } from '@/components/button';
import { CategoryChip, FilterChip } from '@/components/category-chip';
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
  /** Harita mekanların tümünü çerçeveler: tek mekanda ortalar, birden fazlasında yayılıma göre yakınlaşma seçer. */
  const mapCamera = useMemo(() => {
    if (places.length === 0) return { center: { lat: 41.03, lng: 28.98 }, zoom: 11 };
    const lats = places.map((p) => p.location.lat);
    const lngs = places.map((p) => p.location.lng);
    const center = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
    const span = Math.max(Math.max(...lats) - Math.min(...lats), (Math.max(...lngs) - Math.min(...lngs)) * 0.75);
    const zoom = span < 0.005 ? 15 : span < 0.02 ? 13.5 : span < 0.06 ? 12 : span < 0.15 ? 11 : 10;
    return { center, zoom };
  }, [places]);

  const topBar = (
    <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <IconButton accessibilityLabel={t('place.back')} onPress={() => router.back()} testID="creator-back">
        <Icon sf="chevron.left" material="arrow-back" size={20} color={colors.textPrimary} />
      </IconButton>
      <ThemedText variant="headline" numberOfLines={1} style={{ flex: 1, textAlign: 'center', paddingHorizontal: spacing.md }}>
        {creator.data?.displayName ?? ''}
      </ThemedText>
      <IconButton accessibilityLabel={t('place.share')} onPress={() => creator.data && Share.share({ message: `${creator.data.displayName} · Elsewhere` })}>
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
            {c.bio ? <ThemedText tone="secondary">{c.bio.text}</ThemedText> : null}
            {followers && c.platformFollowers ? (
              <ThemedText variant="caption" tone="secondary">
                {t('creator.followersObserved', { count: followers, platform, date: new Date(c.platformFollowers.observedAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-GB') })}
              </ThemedText>
            ) : null}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <ThemedText variant="sectionTitle" style={{ flex: 1 }} numberOfLines={2}>
              {t('creator.world', { name: c.displayName })}
            </ThemedText>
            <Pressable accessibilityRole="link" accessibilityLabel={t('creator.allMap')} onPress={() => router.navigate('/(tabs)')} hitSlop={8}>
              <ThemedText variant="helperStrong" style={{ color: colors.primaryAction }}>
                {t('creator.allMap')} ›
              </ThemedText>
            </Pressable>
          </View>
          <View style={{ height: 260, borderRadius: radius.cardLarge, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 1, borderColor: hairline }}>
            <VenueMap
              items={places}
              selectedId={selectedPlace}
              onSelect={setSelectedPlace}
              initialCamera={mapCamera}
              onViewportSettled={() => {}}
              bottomInset={0}
              userLocation={null}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            <FilterChip
              label={t('creator.allCategories')}
              selected={category === null}
              onPress={() => setCategory(null)}
              fill={category === null ? colors.primaryAction : colors.surface}
              borderColor={category === null ? colors.primaryAction : hairline}
              textColor={category === null ? colors.background : colors.textPrimary}
            />
            {c.categories.map((cat) => (
              <CategoryChip key={cat} category={cat} selected={category === cat} onPress={(x) => setCategory(category === x ? null : x)} />
            ))}
          </ScrollView>
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
                  style={({ pressed }) => ({ width: '47%', borderRadius: radius.cardSmall, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 1, borderColor: hairline, backgroundColor: pressed ? pressedTint() : colors.surface })}
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
          <ThemedText variant="headline">{t('creator.style')}</ThemedText>
          {c.styleNotes.length === 0 ? <ThemedText tone="secondary">{t('creator.styleEmpty')}</ThemedText> : c.styleNotes.map((n, i) => <ThemedText key={i}>{n.text}</ThemedText>)}
        </View>
      </ScrollView>
    </View>
  );
}
