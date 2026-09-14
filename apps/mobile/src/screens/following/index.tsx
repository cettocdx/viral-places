import { Pressable, ScrollView, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { colors, hairline, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { apiClient } from '@/lib/api/client';
import { queryKeys } from '@/lib/api/hooks';
import { useLibraryStore } from '@/features/library/store';
import { CreatorAvatar } from '@/components/creator-avatar';
import { DemoBanner } from '@/components/demo-badge';
import { Icon } from '@/components/icon';
import { EmptyState } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { ViralBadge } from '@/components/viral-badge';

/** Takip edilenler (§7.6): creator listesi ve yeni paylaştığı yerler; sonsuz video akışı değil. Başlık native large title. */
export function FollowingScreen() {
  const { t } = useT();
  const router = useRouter();
  const follows = useLibraryStore((s) => s.library.follows);
  const unfollow = useLibraryStore((s) => s.unfollow);
  const creators = useQueries({
    queries: follows.map((f) => ({ queryKey: queryKeys.creator(f.creatorId), queryFn: () => apiClient.getCreator(f.creatorId) })),
  });

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl }} testID="following-scroll">
      <DemoBanner />
      <ThemedText variant="caption" tone="secondary">
        {t('following.notificationsSeparate')}
      </ThemedText>
      {follows.length === 0 ? (
        <EmptyState title={t('following.empty')} hint={t('following.emptyHint')} actionTitle={t('tab.explore')} onAction={() => router.navigate('/(tabs)')} testID="following-empty" />
      ) : (
        creators.map((q, idx) => {
          const c = q.data;
          const follow = follows[idx]!;
          if (!c) return <View key={follow.creatorId} style={{ height: 72, borderRadius: radius.cardSmall, backgroundColor: 'rgba(17,24,39,0.04)' }} />;
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
                        @{c.handle} · {c.places.length} {t('creator.places').toLocaleLowerCase('tr')}
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
                <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.name} onPress={() => router.push({ pathname: '/places/[id]', params: { id: p.id } })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, opacity: pressed ? 0.7 : 1 })}>
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
