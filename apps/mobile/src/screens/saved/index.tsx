import { useState } from 'react';
import { Alert, ScrollView, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { hapticSelection } from '@/lib/haptics';
import { useLibraryStore } from '@/features/library/store';
import { CoverCard, NewCoverCard } from '@/components/cover-card';
import { DemoBanner } from '@/components/demo-badge';

/**
 * Kaydedilenler (§7.5): Koleksiyonlar | Planlar — Apple UISegmentedControl (@expo/ui community).
 * Başlık native büyük başlıklı navigasyon çubuğundan gelir; içerik altına kayar.
 */
export function SavedScreen() {
  const { t } = useT();
  const router = useRouter();
  const [seg, setSeg] = useState(0);
  const library = useLibraryStore((s) => s.library);
  const deleteCollection = useLibraryStore((s) => s.deleteCollection);
  const undoDelete = useLibraryStore((s) => s.undoDelete);
  const deletePlan = useLibraryStore((s) => s.deletePlan);

  const onDeleteCollection = (id: string, title: string) => {
    Alert.alert(t('saved.delete'), title, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('saved.delete'),
        style: 'destructive',
        onPress: () => {
          deleteCollection(id);
          Alert.alert(t('saved.deleted'), '', [{ text: t('saved.undo'), onPress: undoDelete }, { text: t('common.done') }]);
        },
      },
    ]);
  };

  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.floor((screenWidth - spacing.lg * 2 - spacing.md) / 2);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl }} testID="saved-scroll">
      <DemoBanner />
      <SegmentedControl
        values={[t('saved.collections'), t('saved.plans')]}
        selectedIndex={seg}
        onChange={(e) => {
          hapticSelection();
          setSeg(e.nativeEvent.selectedSegmentIndex);
        }}
        testID="saved-segment"
      />

      {seg === 0 ? (
        // Gece baskısı (ADR-021): koleksiyonlar kapak fotoğraflı iki sütunlu kartlar; "yeni" kartı aynı ızgarada.
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {library.collections.map((c) => {
            const saves = library.saves.filter((s) => s.collectionId === c.id);
            return (
              <CoverCard
                key={c.id}
                venueId={saves[0]?.venueId ?? null}
                title={c.title}
                subtitle={t('saved.placesCount', { count: saves.length })}
                icon={{ sf: 'bookmark.fill', material: 'bookmark' }}
                width={cardWidth}
                onPress={() => router.push({ pathname: '/collections/[id]', params: { id: c.id } })}
                onLongPress={() => onDeleteCollection(c.id, c.title)}
                accessibilityLabel={`${c.title}, ${t('saved.placesCount', { count: saves.length })}`}
                testID={`collection-${c.id}`}
              />
            );
          })}
          <NewCoverCard title={t('saved.newCollection')} width={cardWidth} onPress={() => router.push({ pathname: '/save-to-collection', params: { createOnly: '1' } })} testID="saved-new-collection" />
        </View>
      ) : (
        // Planlar da kapak kartları: kapak ilk durağın kaynak görseli (ADR-021).
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {library.plans.map((p) => (
            <CoverCard
              key={p.id}
              venueId={p.items[0]?.venueId ?? null}
              title={p.title}
              subtitle={t('plans.stops', { count: p.items.length })}
              icon={{ sf: 'calendar', material: 'event' }}
              width={cardWidth}
              onPress={() => router.push({ pathname: '/plans/[id]', params: { id: p.id } })}
              onLongPress={() => Alert.alert(t('saved.delete'), p.title, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('saved.delete'), style: 'destructive', onPress: () => deletePlan(p.id) }])}
              accessibilityLabel={`${p.title}, ${t('plans.stops', { count: p.items.length })}`}
              testID={`plan-${p.id}`}
            />
          ))}
          <NewCoverCard title={t('plans.newPlan')} width={cardWidth} onPress={() => router.push({ pathname: '/add-to-plan', params: { createOnly: '1' } })} testID="plans-new" />
        </View>
      )}
    </ScrollView>
  );
}
