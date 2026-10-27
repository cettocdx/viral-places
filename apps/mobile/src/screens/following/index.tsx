import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { colors, hairline, pressedTint, radius, spacing, surfaceMuted } from '@/theme';
import { useT } from '@/hooks/use-t';
import { apiClient } from '@/lib/api/client';
import { queryKeys, useCity, useSuggestedCreators } from '@/lib/api/hooks';
import { useLibraryStore } from '@/features/library/store';
import { CreatorAvatar } from '@/components/creator-avatar';
import { DemoBanner } from '@/components/demo-badge';
import { Icon } from '@/components/icon';
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { ViralBadge } from '@/components/viral-badge';

/** Takip edilenler (§7.6): creator listesi ve yeni paylaştığı yerler; sonsuz video akışı değil. Başlık native large title. */
export function FollowingScreen() {
  const { t, locale } = useT();
  const router = useRouter();
  const follows = useLibraryStore((s) => s.library.follows);
  const unfollow = useLibraryStore((s) => s.unfollow);
  const follow = useLibraryStore((s) => s.follow);
  const city = useCity();
  const suggested = useSuggestedCreators(follows.length === 0 ? city.data?.id : undefined);
  const creators = useQueries({
    queries: follows.map((f) => ({ queryKey: queryKeys.creator(f.creatorId), queryFn: () => apiClient.getCreator(f.creatorId) })),
  });

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl }} testID="following-scroll">
      <DemoBanner />
      {follows.length === 0 ? (
        <View style={{ gap: spacing.lg }}>
          <EmptyState title={t('following.empty')} hint={t('following.emptyHint')} testID="following-empty" />
          {/* Gerçek öneriler (ADR-025): bu şehrin mekanlarını paylaşan creator'lar, paylaştıkları mekan sayısına göre. */}
          {suggested.data && suggested.data.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              <Text style={{ fontSize: 20, fontWeight: '700', letterSpacing: -0.3, color: colors.textPrimary }}>{t('following.suggested', { city: city.data?.name ?? '' })}</Text>
              {suggested.data.map((s) => (
                <Pressable key={s.creator.id} accessibilityRole="button" accessibilityLabel={s.creator.displayName} onPress={() => router.push({ pathname: '/creators/[id]', params: { id: s.creator.id } })} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })} testID={`suggest-${s.creator.id}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 12, borderRadius: 22, borderCurve: 'continuous', backgroundColor: colors.surface, borderWidth: 1, borderColor: hairline }}>
                    <CreatorAvatar name={s.creator.displayName} url={s.creator.avatarUrl} size={52} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>@{s.creator.handle}</Text>
                      <Text style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>{s.places.map((p) => p.name).join(' · ')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                      {s.places.slice(0, 3).map((p, i) => p.thumb ? <Image key={p.id} source={{ uri: p.thumb }} contentFit="cover" style={{ width: 30, height: 40, borderRadius: 8, marginLeft: i ? -10 : 0, borderWidth: 1.5, borderColor: colors.surface }} accessibilityIgnoresInvertColors /> : null)}
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('creator.follow')} onPress={() => follow(s.creator.id)} hitSlop={6} style={({ pressed }) => ({ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: '#FFFFFF', justifyContent: 'center', transform: [{ scale: pressed ? 0.95 : 1 }] })} testID={`suggest-follow-${s.creator.id}`}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#1B2834' }}>{t('creator.follow')}</Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : suggested.isLoading ? (
            <View style={{ gap: spacing.md }}><SkeletonBlock height={76} /><SkeletonBlock height={76} /></View>
          ) : null}
        </View>
      ) : (
        creators.map((q, idx) => {
          const c = q.data;
          const follow = follows[idx]!;
          // Hata sessizce boş kutuya düşmez (HIG "Feedback"): yeniden deneme sunulur.
          if (q.isError) return <ErrorState key={follow.creatorId} message={t('common.error')} retryTitle={t('common.retry')} onRetry={() => q.refetch()} />;
          if (!c) return <SkeletonBlock key={follow.creatorId} height={72} />;
          const newest = [...c.places].sort((a, b) => (b.freshness.lastObservedAt ?? '').localeCompare(a.freshness.lastObservedAt ?? '')).slice(0, 3);
          return (
            <View key={c.id} style={{ backgroundColor: colors.surface, borderRadius: radius.cardLarge, borderCurve: 'continuous', padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: hairline }} testID={`following-${c.id}`}>
              <Link href={{ pathname: '/creators/[id]', params: { id: c.id } }} asChild>
                <Link.Trigger>
                  <Pressable accessibilityRole="button" accessibilityLabel={c.displayName}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <CreatorAvatar name={c.displayName} url={c.avatarUrl} size={44} />
                    <View style={{ flex: 1 }}>
                      <ThemedText variant="headline">{c.displayName}</ThemedText>
                      <ThemedText variant="helper" tone="secondary">
                        @{c.handle} · {c.places.length} {t('creator.places').toLocaleLowerCase(locale === 'tr' ? 'tr' : 'en')}
                      </ThemedText>
                    </View>
                    <Icon sf="chevron.right" material="chevron-right" size={18} color={colors.textSecondary} />
                    </View>
                  </Pressable>
                </Link.Trigger>
                <Link.Preview />
                <Link.Menu>
                  <Link.MenuAction icon="person.crop.circle.badge.minus" destructive onPress={() => unfollow(c.id)}>
                    {t('creator.following')}
                  </Link.MenuAction>
                </Link.Menu>
              </Link>
              <ThemedText variant="helper" tone="secondary">
                {t('following.newPlaces')}
              </ThemedText>
              {newest.map((p) => (
                <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.name} onPress={() => router.push({ pathname: '/places/[id]', params: { id: p.id } })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, backgroundColor: pressed ? pressedTint() : colors.surface })}>
                  <ThemedText style={{ flex: 1 }} numberOfLines={1}>
                    {p.name}
                  </ThemedText>
                  <ViralBadge score={p.trend.score} status={p.trend.status} trending={p.trend.trending} size="sm" />
                </Pressable>
              ))}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
