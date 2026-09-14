import { Pressable, ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { CATEGORY_META } from '@viral-places/domain';
import { categoryTextColor, categoryTint, colors, hairline, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { usePlacesByIds } from '@/lib/api/hooks';
import { useLibraryStore } from '@/features/library/store';
import { Icon } from '@/components/icon';
import { EmptyState, LoadingState } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { ViralBadge } from '@/components/viral-badge';

export function CollectionDetailScreen({ id }: { id: string }) {
  const { t } = useT();
  const router = useRouter();
  const collection = useLibraryStore((s) => s.library.collections.find((c) => c.id === id));
  const saves = useLibraryStore((s) => s.library.saves.filter((x) => x.collectionId === id));
  const unsave = useLibraryStore((s) => s.unsave);
  const places = usePlacesByIds(saves.map((s) => s.venueId));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: true, title: collection?.title ?? '', headerTransparent: true, headerBlurEffect: 'none', headerLargeTitleEnabled: true, headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false, headerLargeTitleShadowVisible: false, headerLargeStyle: { backgroundColor: 'transparent' } }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
        {saves.length === 0 ? (
          <EmptyState title={t('saved.empty')} hint={t('saved.emptyHint')} />
        ) : places.isLoading ? (
          <LoadingState />
        ) : (
          saves.map((s) => {
            const p = places.data?.find((x) => x.id === s.venueId);
            if (!p) {
              return (
                <View key={s.id} style={{ backgroundColor: colors.surface, borderRadius: radius.cardSmall, padding: spacing.md, borderWidth: 1, borderColor: hairline }}>
                  <ThemedText tone="secondary">{t('place.notFound')}</ThemedText>
                </View>
              );
            }
            const meta = CATEGORY_META[p.category];
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={p.name}
                onPress={() => router.push({ pathname: '/places/[id]', params: { id: p.id } })}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.cardSmall, borderCurve: 'continuous', padding: spacing.md, borderWidth: 1, borderColor: hairline, opacity: pressed ? 0.9 : 1 })}
                testID={`collection-place-${p.id}`}
              >
                <View style={{ width: 40, height: 40, borderRadius: radius.chip, backgroundColor: categoryTint(p.category), alignItems: 'center', justifyContent: 'center' }}>
                  <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={18} color={categoryTextColor(p.category)} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText variant="headline" numberOfLines={2}>
                    {p.name}
                  </ThemedText>
                  <ThemedText variant="helper" tone="secondary">
                    {t(meta.labelKey)}
                    {p.neighborhood ? ` · ${p.neighborhood}` : ''}
                  </ThemedText>
                </View>
                <ViralBadge score={p.trend.score} status={p.trend.status} trending={p.trend.trending} size="sm" />
                <Pressable accessibilityRole="button" accessibilityLabel={t('saved.removeFromCollection')} onPress={() => unsave(p.id, id)} hitSlop={8}>
                  <Icon sf="xmark.circle" material="remove-circle-outline" size={20} color={colors.textSecondary} weight="regular" />
                </Pressable>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
