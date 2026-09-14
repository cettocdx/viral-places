import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORY_META, PlanRevisionConflict, planSpansMultipleCountries } from '@viral-places/domain';
import { demoCountryForVenue } from '@viral-places/test-fixtures';
import { categoryTextColor, categoryTint, colors, hairline, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { usePlacesByIds } from '@/lib/api/hooks';
import { useLibraryStore } from '@/features/library/store';
import { DemoBadge } from '@/components/demo-badge';
import { Icon } from '@/components/icon';
import { EmptyState } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { directionsUrl } from '@/screens/place-detail';

/** Gün planı (§7.5, §21.3): sıra düzenleme revision kontrollü; rota optimizasyonu iddiası yok. */
export function PlanDetailScreen({ id }: { id: string }) {
  const { t } = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const plan = useLibraryStore((s) => s.library.plans.find((p) => p.id === id));
  const reorderPlan = useLibraryStore((s) => s.reorderPlan);
  const removeFromPlan = useLibraryStore((s) => s.removeFromPlan);
  const places = usePlacesByIds(plan?.items.map((i) => i.venueId) ?? []);

  const move = (index: number, dir: -1 | 1) => {
    if (!plan) return;
    const ids = plan.items.map((i) => i.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target]!, next[index]!];
    try {
      reorderPlan(plan.id, next, plan.revision);
    } catch (e) {
      Alert.alert(t('app.name'), e instanceof PlanRevisionConflict ? t('plans.revisionConflict') : t('common.error'));
    }
  };

  const multiCountry = plan ? planSpansMultipleCountries(plan, demoCountryForVenue) : false;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: true, title: plan?.title ?? '', headerTransparent: true, headerBlurEffect: 'none', headerLargeTitleEnabled: true, headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false, headerLargeTitleShadowVisible: false, headerLargeStyle: { backgroundColor: 'transparent' } }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xxxl }} testID="plan-scroll">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <DemoBadge compact />
          {plan ? (
            <ThemedText variant="helper" tone="secondary" style={{ flex: 1 }}>
              {t('plans.date')}: {plan.dateLocal} · {t('plans.timezone')}: {plan.timezone} · rev {plan.revision}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText variant="caption" tone="secondary">
          {t('plans.noRouteClaim')}
        </ThemedText>
        {multiCountry ? (
          <View style={{ backgroundColor: 'rgba(242,181,68,0.18)', borderRadius: radius.cardSmall, padding: spacing.md }}>
            <ThemedText variant="helper" style={{ color: colors.familyText }}>
              {t('plans.multiCountry')}
            </ThemedText>
          </View>
        ) : null}
        {!plan || plan.items.length === 0 ? (
          <EmptyState title={t('plans.empty')} hint={t('plans.emptyHint')} />
        ) : (
          plan.items.map((item, index) => {
            const p = places.data?.find((x) => x.id === item.venueId);
            const meta = p ? CATEGORY_META[p.category] : null;
            return (
              <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.cardSmall, borderCurve: 'continuous', padding: spacing.md, borderWidth: 1, borderColor: hairline }} testID={`plan-item-${index}`}>
                <View style={{ width: 28, height: 28, borderRadius: radius.chip, backgroundColor: colors.primaryAction, alignItems: 'center', justifyContent: 'center' }}>
                  <ThemedText variant="caption" tone="inverse" style={{ fontVariant: ['tabular-nums'] }}>
                    {index + 1}
                  </ThemedText>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={p?.name ?? item.venueId} onPress={() => router.push({ pathname: '/places/[id]', params: { id: item.venueId } })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  {p && meta ? (
                    <View style={{ width: 32, height: 32, borderRadius: radius.chip, backgroundColor: categoryTint(p.category), alignItems: 'center', justifyContent: 'center' }}>
                      <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={15} color={categoryTextColor(p.category)} />
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="headline" numberOfLines={2}>
                      {p?.name ?? t('place.notFound')}
                    </ThemedText>
                    <ThemedText variant="helper" tone="secondary" numberOfLines={1}>
                      {p?.neighborhood ?? ''}
                    </ThemedText>
                  </View>
                </Pressable>
                <View style={{ gap: spacing.xs }}>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('plans.moveUp')} disabled={index === 0} onPress={() => move(index, -1)} hitSlop={6} style={{ opacity: index === 0 ? 0.3 : 1 }} testID={`plan-up-${index}`}>
                    <Icon sf="chevron.up" material="keyboard-arrow-up" size={20} color={colors.textPrimary} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('plans.moveDown')} disabled={index === plan.items.length - 1} onPress={() => move(index, 1)} hitSlop={6} style={{ opacity: index === plan.items.length - 1 ? 0.3 : 1 }} testID={`plan-down-${index}`}>
                    <Icon sf="chevron.down" material="keyboard-arrow-down" size={20} color={colors.textPrimary} />
                  </Pressable>
                </View>
                {p ? (
                  <Pressable accessibilityRole="link" accessibilityLabel={t('place.directions')} onPress={() => Linking.openURL(directionsUrl(p.location.lat, p.location.lng))} hitSlop={6}>
                    <Icon sf="location.north.fill" material="navigation" size={18} color={colors.primaryAction} />
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" accessibilityLabel={t('plans.remove')} onPress={() => removeFromPlan(plan.id, item.id)} hitSlop={6}>
                  <Icon sf="xmark.circle" material="remove-circle-outline" size={20} color={colors.textSecondary} weight="regular" />
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
