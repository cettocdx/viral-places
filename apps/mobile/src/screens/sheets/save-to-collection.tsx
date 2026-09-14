import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, hairline, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { useLibraryStore } from '@/features/library/store';
import { hapticCommit, hapticSelection } from '@/lib/haptics';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';

/** Kaydet sheet'i (§7.5): son kullanılan koleksiyon öne; her koleksiyon için aç/kapa; yeni koleksiyon. */
export function SaveToCollectionSheet({ venueId, createOnly }: { venueId: string | null; createOnly: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const library = useLibraryStore((s) => s.library);
  const save = useLibraryStore((s) => s.save);
  const unsave = useLibraryStore((s) => s.unsave);
  const createCollection = useLibraryStore((s) => s.createCollection);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(createOnly || library.collections.length === 0);

  const ordered = [...library.collections].sort((a, b) => (a.id === library.lastUsedCollectionId ? -1 : b.id === library.lastUsedCollectionId ? 1 : 0));

  const onCreate = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const c = createCollection(trimmed);
    if (venueId) {
      hapticCommit();
      save(venueId, c.id);
    }
    setTitle('');
    setCreating(false);
    if (createOnly || venueId) router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled" testID="save-sheet">
      <ThemedText variant="sectionTitle">{createOnly ? t('saved.newCollection') : t('sheet.saveTo')}</ThemedText>
      {!createOnly
        ? ordered.map((c) => {
            const checked = !!venueId && library.saves.some((s) => s.venueId === venueId && s.collectionId === c.id);
            return (
              <Pressable
                key={c.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={c.title}
                onPress={() => {
                  if (!venueId) return;
                  hapticSelection();
                  checked ? unsave(venueId, c.id) : save(venueId, c.id);
                }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderRadius: radius.cardSmall, borderCurve: 'continuous', borderWidth: 1, borderColor: checked ? colors.primaryAction : hairline, opacity: pressed ? 0.85 : 1 })}
                testID={`save-sheet-collection-${c.id}`}
              >
                <Icon sf={checked ? 'checkmark.circle.fill' : 'circle'} material={checked ? 'check-circle' : 'radio-button-unchecked'} size={22} color={checked ? colors.primaryAction : colors.textSecondary} weight="regular" />
                <ThemedText style={{ flex: 1 }} numberOfLines={1}>
                  {c.title}
                </ThemedText>
                {c.id === library.lastUsedCollectionId ? (
                  <Icon sf="clock.arrow.circlepath" material="history" size={16} color={colors.textSecondary} weight="regular" />
                ) : null}
              </Pressable>
            );
          })
        : null}
      {creating ? (
        <View style={{ gap: spacing.sm }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('saved.collectionTitlePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            autoFocus
            maxLength={80}
            accessibilityLabel={t('saved.collectionTitlePlaceholder')}
            onSubmitEditing={onCreate}
            style={{ minHeight: 48, borderWidth: 1, borderColor: hairline, borderRadius: radius.cardSmall, backgroundColor: colors.surface, paddingHorizontal: spacing.md, fontSize: 16, color: colors.textPrimary }}
            testID="save-sheet-title"
          />
          <Button title={t('common.create')} onPress={onCreate} disabled={!title.trim()} testID="save-sheet-create" />
        </View>
      ) : (
        <Button title={t('saved.newCollection')} variant="secondary" size="md" onPress={() => setCreating(true)} icon={<Icon sf="plus" material="add" size={16} color={colors.textPrimary} />} />
      )}
      {!createOnly ? <Button title={t('common.done')} variant="ghost" size="md" onPress={() => router.back()} testID="save-sheet-done" /> : null}
    </ScrollView>
  );
}
