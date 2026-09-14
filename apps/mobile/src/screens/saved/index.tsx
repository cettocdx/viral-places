import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { colors, hairline, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { hapticSelection } from '@/lib/haptics';
import { useLibraryStore } from '@/features/library/store';
import { Button } from '@/components/button';
import { DemoBanner } from '@/components/demo-badge';
import { Icon } from '@/components/icon';
import { EmptyState } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';

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

  const rowStyle = { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.cardSmall, borderCurve: 'continuous', padding: spacing.lg, borderWidth: 1, borderColor: hairline } as const;

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
      <ThemedText variant="caption" tone="secondary">
        {t('saved.guestNotice')} · {t('saved.syncLocal')}
      </ThemedText>

      {seg === 0 ? (
        <View style={{ gap: spacing.md }}>
          {library.collections.length === 0 ? (
            <EmptyState title={t('saved.empty')} hint={t('saved.emptyHint')} testID="saved-empty" />
          ) : (
            library.collections.map((c) => {
              const count = library.saves.filter((s) => s.collectionId === c.id).length;
              return (
                <Link key={c.id} href={{ pathname: '/collections/[id]', params: { id: c.id } }} asChild>
                  <Link.Trigger>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${c.title}, ${t('saved.placesCount', { count })}`} testID={`collection-${c.id}`}>
                      <View style={rowStyle}>
                      <View style={{ width: 44, height: 44, borderRadius: radius.cardSmall, borderCurve: 'continuous', backgroundColor: 'rgba(29,38,53,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon sf="bookmark.fill" material="bookmark" size={20} color={colors.primaryAction} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText variant="headline" numberOfLines={1}>
                          {c.title}
                        </ThemedText>
                        <ThemedText variant="helper" tone="secondary">
                          {t('saved.placesCount', { count })} · {t('saved.syncLocal')}
                        </ThemedText>
                      </View>
                      <Icon sf="chevron.right" material="chevron-right" size={18} color={colors.textSecondary} />
                      </View>
                    </Pressable>
                  </Link.Trigger>
                  <Link.Preview />
                  <Link.Menu>
                    <Link.MenuAction icon="trash" destructive onPress={() => onDeleteCollection(c.id, c.title)}>
                      {t('saved.delete')}
                    </Link.MenuAction>
                  </Link.Menu>
                </Link>
              );
            })
          )}
          <Button title={t('saved.newCollection')} variant="secondary" size="md" onPress={() => router.push({ pathname: '/save-to-collection', params: { createOnly: '1' } })} testID="saved-new-collection" />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {library.plans.length === 0 ? (
            <EmptyState title={t('plans.empty')} hint={t('plans.emptyHint')} testID="plans-empty" />
          ) : (
            library.plans.map((p) => (
              <Link key={p.id} href={{ pathname: '/plans/[id]', params: { id: p.id } }} asChild>
                <Link.Trigger>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${p.title}, ${t('plans.stops', { count: p.items.length })}`} testID={`plan-${p.id}`}>
                    <View style={rowStyle}>
                    <View style={{ width: 44, height: 44, borderRadius: radius.cardSmall, borderCurve: 'continuous', backgroundColor: 'rgba(29,38,53,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon sf="calendar" material="event" size={20} color={colors.primaryAction} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText variant="headline" numberOfLines={1}>
                        {p.title}
                      </ThemedText>
                      <ThemedText variant="helper" tone="secondary">
                        {p.dateLocal} · {p.timezone} · {t('plans.stops', { count: p.items.length })}
                      </ThemedText>
                    </View>
                    <Icon sf="chevron.right" material="chevron-right" size={18} color={colors.textSecondary} />
                    </View>
                  </Pressable>
                </Link.Trigger>
                <Link.Preview />
                <Link.Menu>
                  <Link.MenuAction
                    icon="trash"
                    destructive
                    onPress={() => Alert.alert(t('saved.delete'), p.title, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('saved.delete'), style: 'destructive', onPress: () => deletePlan(p.id) }])}
                  >
                    {t('saved.delete')}
                  </Link.MenuAction>
                </Link.Menu>
              </Link>
            ))
          )}
          <Button title={t('plans.newPlan')} variant="secondary" size="md" onPress={() => router.push({ pathname: '/add-to-plan', params: { createOnly: '1' } })} testID="plans-new" />
        </View>
      )}
    </ScrollView>
  );
}
