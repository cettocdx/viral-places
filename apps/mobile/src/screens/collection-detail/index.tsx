import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useMemo } from 'react';
import { Stack, useRouter } from 'expo-router';
import { colors, hairline, mapTheme, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { usePlacesByIds } from '@/lib/api/hooks';
import { useLibraryStore } from '@/features/library/store';
import { Icon } from '@/components/icon';
import { PlacePhotoCard } from '@/components/place-photo-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';

/** Koleksiyon: kayıtlı mekanlar iki sütunlu fotoğraf kartları (gece baskısı, ADR-021); çıkarma kartın köşesinde. */
export function CollectionDetailScreen({ id }: { id: string }) {
  const { t } = useT();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const collection = useLibraryStore((s) => s.library.collections.find((c) => c.id === id));
  // Seçici sabit diziyi döndürür; filtre render'da: her çağrıda yeni dizi dönen seçici sonsuz yeniden render yapıyordu.
  const allSaves = useLibraryStore((s) => s.library.saves);
  const saves = useMemo(() => allSaves.filter((x) => x.collectionId === id), [allSaves, id]);
  const unsave = useLibraryStore((s) => s.unsave);
  const places = usePlacesByIds(saves.map((s) => s.venueId));
  const cardWidth = Math.floor((screenWidth - spacing.lg * 2 - spacing.md) / 2);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: true, title: collection?.title ?? '', headerTransparent: true, headerBlurEffect: 'none', headerLargeTitleEnabled: true, headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false, headerLargeTitleShadowVisible: false, headerLargeStyle: { backgroundColor: 'transparent' }, headerTitleStyle: { color: colors.textPrimary }, headerLargeTitleStyle: { color: colors.textPrimary }, headerTintColor: colors.textPrimary }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl * 2 }}>
        {saves.length > 0 ? (
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: mapTheme.paper }}>
              <Icon sf="bookmark.fill" material="bookmark" size={12} color={mapTheme.ink} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: mapTheme.ink }}>{t('saved.placesCount', { count: saves.length })}</Text>
            </View>
          </View>
        ) : null}
        {saves.length === 0 ? (
          <EmptyState title={t('saved.empty')} hint={t('saved.emptyHint')} />
        ) : places.isLoading ? (
          <LoadingState />
        ) : places.isError ? (
          <ErrorState message={t('common.error')} retryTitle={t('common.retry')} onRetry={() => places.refetch()} />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {saves.map((s) => {
              const p = places.data?.find((x) => x.id === s.venueId);
              if (!p) {
                return (
                  <View key={s.id} style={{ width: cardWidth, height: Math.round(cardWidth * 1.28), borderRadius: 24, borderWidth: 1, borderColor: hairline, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: spacing.md, gap: spacing.sm }}>
                    <ThemedText tone="secondary" style={{ textAlign: 'center' }}>{t('place.notFound')}</ThemedText>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('saved.removeFromCollection')} onPress={() => unsave(s.venueId, id)} hitSlop={8} style={{ paddingHorizontal: 12, height: 30, borderRadius: radius.chip, backgroundColor: mapTheme.paper, justifyContent: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: mapTheme.ink }}>{t('saved.removeFromCollection')}</Text>
                    </Pressable>
                  </View>
                );
              }
              return (
                <PlacePhotoCard
                  key={s.id}
                  item={p}
                  width={cardWidth}
                  height={Math.round(cardWidth * 1.28)}
                  onPress={() => router.push({ pathname: '/places/[id]', params: { id: p.id } })}
                  testID={`collection-place-${p.id}`}
                  accessory={
                    <Pressable accessibilityRole="button" accessibilityLabel={t('saved.removeFromCollection')} onPress={() => unsave(p.id, id)} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon sf="xmark" material="close" size={12} color={mapTheme.paper} />
                    </Pressable>
                  }
                />
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
