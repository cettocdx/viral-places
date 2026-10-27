import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORY_META, PlanRevisionConflict, planSpansMultipleCountries } from '@viral-places/domain';
import { demoCountryForVenue } from '@viral-places/test-fixtures';
import { categoryColor, categoryTint, colors, hairline, mapTheme, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { usePlacesByIds } from '@/lib/api/hooks';
import { useLibraryStore } from '@/features/library/store';
import { DemoBadge } from '@/components/demo-badge';
import { Icon } from '@/components/icon';
import { EmptyState } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { directionsUrl } from '@/screens/place-detail';
import { STICKER_FONT } from '@/components/map/sticker-text';

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

  const glassBtn = { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: hairline, alignItems: 'center' as const, justifyContent: 'center' as const };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: true, title: plan?.title ?? '', headerTransparent: true, headerBlurEffect: 'none', headerLargeTitleEnabled: true, headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false, headerLargeTitleShadowVisible: false, headerLargeStyle: { backgroundColor: 'transparent' }, headerTitleStyle: { color: colors.textPrimary }, headerLargeTitleStyle: { color: colors.textPrimary }, headerTintColor: colors.textPrimary }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xxxl * 2 }} testID="plan-scroll">
        <DemoBadge compact />
        {plan ? (
          // Gece baskısı (ADR-021): tarih ve durak sayısı sticker etiketleri.
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {[{ sf: 'calendar', material: 'event', text: plan.dateLocal }, { sf: 'mappin.and.ellipse', material: 'place', text: t('plans.stops', { count: plan.items.length }) }, { sf: 'clock', material: 'schedule', text: plan.timezone }].map((x) => (
              <View key={x.sf} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: mapTheme.paper }}>
                <Icon sf={x.sf} material={x.material as never} size={12} color={mapTheme.ink} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: mapTheme.ink }}>{x.text}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {multiCountry ? (
          <View style={{ backgroundColor: categoryTint('family', 0.18), borderRadius: radius.cardSmall, padding: spacing.md }}>
            <ThemedText variant="helper" style={{ color: colors.familyText }}>
              {t('plans.multiCountry')}
            </ThemedText>
          </View>
        ) : null}
        {!plan || plan.items.length === 0 ? (
          <EmptyState title={t('plans.empty')} hint={t('plans.emptyHint')} />
        ) : (
          <View style={{ marginTop: spacing.sm }}>
            {plan.items.map((item, index) => {
              const p = places.data?.find((x) => x.id === item.venueId);
              const last = index === plan.items.length - 1;
              return (
                <View key={item.id} style={{ flexDirection: 'row', gap: spacing.md }} testID={`plan-item-${index}`}>
                  {/* Rota çizgisi: numaralı sticker durak, aralarda kesik çizgi. */}
                  <View style={{ width: 36, alignItems: 'center' }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, padding: 3, backgroundColor: mapTheme.paper, transform: [{ rotate: index % 2 ? '6deg' : '-6deg' }] }}>
                      <View style={{ flex: 1, borderRadius: 15, backgroundColor: p ? categoryColor(p.category) : mapTheme.ink, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: STICKER_FONT, fontSize: 15, fontWeight: '800', color: mapTheme.paper, fontVariant: ['tabular-nums'] }}>{index + 1}</Text>
                      </View>
                    </View>
                    {!last ? <View style={{ flex: 1, width: 0, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.25)', marginVertical: 6 }} /> : null}
                  </View>
                  <View style={{ flex: 1, paddingBottom: last ? 0 : spacing.lg }}>
                    <Pressable accessibilityRole="button" accessibilityLabel={p?.name ?? item.venueId} onPress={() => router.push({ pathname: '/places/[id]', params: { id: item.venueId } })} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                      <View style={{ flexDirection: 'row', gap: spacing.md, padding: 5, paddingRight: spacing.md, borderRadius: 22, borderCurve: 'continuous', backgroundColor: mapTheme.paper, alignItems: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.3)' }}>
                        <View style={{ width: 76, height: 76, borderRadius: 17, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: p ? categoryColor(p.category) : mapTheme.land, alignItems: 'center', justifyContent: 'center' }}>
                          {p ? <Icon sf={CATEGORY_META[p.category].sfSymbol} material={CATEGORY_META[p.category].materialIcon as never} size={22} color={mapTheme.paper} /> : null}
                          {p?.media.thumbnailUrl && p.media.mode !== 'unavailable' ? <Image source={{ uri: p.media.thumbnailUrl }} contentFit="cover" transition={200} style={{ position: 'absolute', inset: 0 }} accessibilityIgnoresInvertColors /> : null}
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={{ fontSize: 17, lineHeight: 21, fontWeight: '700', letterSpacing: -0.3, color: mapTheme.ink }} numberOfLines={2}>
                            {/* Yükleme sırasında "bulunamadı" flaşlamaz (HIG "Loading"): ad gelene kadar boş kalır. */}
                            {p?.name ?? (places.isLoading ? '' : t('place.notFound'))}
                          </Text>
                          <Text style={{ fontSize: 13, color: mapTheme.callout.muted }} numberOfLines={1}>{p ? `${t(`pin.${p.category}`)}${p.neighborhood ? ` · ${p.neighborhood}` : ''}` : ''}</Text>
                        </View>
                      </View>
                    </Pressable>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                      <Pressable accessibilityRole="button" accessibilityLabel={t('plans.moveUp')} disabled={index === 0} onPress={() => move(index, -1)} hitSlop={4} style={{ ...glassBtn, opacity: index === 0 ? 0.35 : 1 }} testID={`plan-up-${index}`}>
                        <Icon sf="arrow.up" material="arrow-upward" size={14} color={colors.textPrimary} />
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel={t('plans.moveDown')} disabled={last} onPress={() => move(index, 1)} hitSlop={4} style={{ ...glassBtn, opacity: last ? 0.35 : 1 }} testID={`plan-down-${index}`}>
                        <Icon sf="arrow.down" material="arrow-downward" size={14} color={colors.textPrimary} />
                      </Pressable>
                      {p ? (
                        <Pressable accessibilityRole="link" accessibilityLabel={t('place.directions')} onPress={() => Linking.openURL(directionsUrl(p.location.lat, p.location.lng))} hitSlop={4} style={glassBtn}>
                          <Icon sf="location.north.fill" material="navigation" size={14} color={mapTheme.accent} />
                        </Pressable>
                      ) : null}
                      <View style={{ flex: 1 }} />
                      <Pressable accessibilityRole="button" accessibilityLabel={t('plans.remove')} onPress={() => removeFromPlan(plan.id, item.id)} hitSlop={4} style={glassBtn}>
                        <Icon sf="xmark" material="close" size={13} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <ThemedText variant="caption" tone="secondary" style={{ marginTop: spacing.md }}>
          {t('plans.noRouteClaim')}
        </ThemedText>
      </ScrollView>
    </View>
  );
}
