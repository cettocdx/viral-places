import { useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, hairline, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { useCity } from '@/lib/api/hooks';
import { useLibraryStore } from '@/features/library/store';
import { Button } from '@/components/button';
import { localDateInTimezone } from './local-date';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';

/** "Gününe Ekle" (§21.3): mevcut plana ekle veya yeni plan oluştur; rezervasyon değildir. */
export function AddToPlanSheet({ venueId, createOnly }: { venueId: string | null; createOnly: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const city = useCity();
  const plans = useLibraryStore((s) => s.library.plans);
  const createPlan = useLibraryStore((s) => s.createPlan);
  const addToPlan = useLibraryStore((s) => s.addToPlan);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(createOnly || plans.length === 0);
  const timezone = city.data?.timezone ?? 'Europe/Istanbul';
  const cityId = city.data?.id ?? 'unknown-city';
  const today = localDateInTimezone(timezone);

  const finish = (added: boolean) => {
    Alert.alert(t('app.name'), added ? t('plans.added') : t('plans.alreadyIn'));
    router.back();
  };

  const onCreate = () => {
    const plan = createPlan({ title: title.trim() || `${t('common.today')} · ${today}`, cityId, dateLocal: today, timezone });
    if (venueId) finish(addToPlan(plan.id, venueId));
    else router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled" testID="plan-sheet">
      <ThemedText variant="sectionTitle">{createOnly ? t('plans.newPlan') : t('sheet.addToPlan')}</ThemedText>
      <ThemedText variant="caption" tone="secondary">
        {t('plans.noRouteClaim')}
      </ThemedText>
      {!createOnly && plans.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <ThemedText variant="helper" tone="secondary">
            {t('plans.addExisting')}
          </ThemedText>
          {plans.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`${p.title}, ${p.dateLocal}`}
              onPress={() => venueId && finish(addToPlan(p.id, venueId))}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderRadius: radius.cardSmall, borderCurve: 'continuous', borderWidth: 1, borderColor: hairline, opacity: pressed ? 0.85 : 1 })}
              testID={`plan-sheet-plan-${p.id}`}
            >
              <Icon sf="calendar" material="event" size={20} color={colors.primaryAction} weight="regular" />
              <View style={{ flex: 1 }}>
                <ThemedText numberOfLines={1}>{p.title}</ThemedText>
                <ThemedText variant="caption" tone="secondary">
                  {p.dateLocal} · {t('plans.stops', { count: p.items.length })}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {creating ? (
        <View style={{ gap: spacing.sm }}>
          <ThemedText variant="helper" tone="secondary">
            {t('plans.date')}: {today} · {t('plans.timezone')}: {timezone}
          </ThemedText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('plans.titlePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            maxLength={80}
            accessibilityLabel={t('plans.titlePlaceholder')}
            onSubmitEditing={onCreate}
            style={{ minHeight: 48, borderWidth: 1, borderColor: hairline, borderRadius: radius.cardSmall, backgroundColor: colors.surface, paddingHorizontal: spacing.md, fontSize: 16, color: colors.textPrimary }}
            testID="plan-sheet-title"
          />
          <Button title={venueId ? t('plans.createAndAdd') : t('common.create')} onPress={onCreate} testID="plan-sheet-create" />
        </View>
      ) : (
        <Button title={t('plans.newPlan')} variant="secondary" size="md" onPress={() => setCreating(true)} icon={<Icon sf="plus" material="add" size={16} color={colors.textPrimary} />} />
      )}
      <Button title={t('common.cancel')} variant="ghost" size="md" onPress={() => router.back()} />
    </ScrollView>
  );
}
