import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isFeaturedCityName } from '@viral-places/api-client';
import { CATEGORIES, CATEGORY_META, type Category } from '@viral-places/domain';
import { categoryColor, colors, mapTheme, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { useCities } from '@/lib/api/hooks';
import { usePreferences } from '@/features/preferences/store';
import { useVisitsStore } from '@/features/visits/store';
import { hapticSelection } from '@/lib/haptics';
import { track } from '@/lib/telemetry';
import { Icon } from '@/components/icon';
import { StickerText } from '@/components/map/sticker-text';

/** Akışta öne alınabilecek zevkler: yeme-içme ağırlıklı içerik (aile/alışveriş henüz yok). */
const TASTE_CHOICES: Category[] = (['food', 'coffee', 'nightlife', 'culture', 'sightseeing'] as const).filter((c) => (CATEGORIES as readonly string[]).includes(c));

/**
 * İlk açılış (ürün sahibi, 29.10.2026): iki kısa adım — şehir, zevkler — sonra doğrudan "Senin için" akışı.
 * Hesap ya da izin istemez; seçimler cihazda kalır ve Profil'den değiştirilebilir.
 */
export function OnboardingScreen() {
  const { t } = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cities = useCities();
  const lastCityId = usePreferences((s) => s.lastCityId);
  const setLastCityId = usePreferences((s) => s.setLastCityId);
  const setTastes = useVisitsStore((s) => s.setTastes);
  const finish = useVisitsStore((s) => s.finishOnboarding);
  const [step, setStep] = useState<0 | 1>(0);
  const [cityId, setCityId] = useState<string | null>(lastCityId);
  // Profil'den yeniden açılınca mevcut seçimler işaretli gelir.
  const savedTastes = useVisitsStore((s) => s.tastes);
  const [tastes, setLocalTastes] = useState<Category[]>(savedTastes);
  const featured = (cities.data ?? []).filter((c) => isFeaturedCityName(c.name) && (c.placeCount ?? 0) > 0);

  const done = () => {
    if (cityId) setLastCityId(cityId);
    setTastes(tastes);
    finish();
    track('onboarding.done', { tastes: tastes.join(','), city: cityId });
    router.replace('/');
  };
  const canNext = step === 0 ? !!cityId : true;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + spacing.xl }} testID="onboarding">
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[0, 1].map((i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? mapTheme.paper : 'rgba(255,255,255,0.18)' }} />)}
        </View>
        <View style={{ alignSelf: 'flex-start', marginTop: spacing.lg, transform: [{ rotate: '-3deg' }] }}>
          <StickerText size={20} outline={3.5}>elsewhere</StickerText>
        </View>
        <Text style={{ fontSize: 34, lineHeight: 38, fontWeight: '700', letterSpacing: -0.8, color: mapTheme.paper }}>{t(step === 0 ? 'onboarding.cityTitle' : 'onboarding.tasteTitle')}</Text>
        <Text style={{ fontSize: 16, lineHeight: 22, color: 'rgba(255,255,255,0.7)' }}>{t(step === 0 ? 'onboarding.cityHint' : 'onboarding.tasteHint')}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexDirection: step === 1 ? 'row' : 'column', flexWrap: 'wrap', paddingBottom: 140 }}>
        {step === 0
          ? featured.map((c) => {
              const selected = c.id === cityId;
              return (
                <Pressable key={c.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => { hapticSelection(); setCityId(c.id); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: spacing.lg, borderRadius: radius.cardSmall, borderCurve: 'continuous', borderWidth: 1.5, borderColor: selected ? mapTheme.paper : 'rgba(255,255,255,0.12)', backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : colors.surface })} testID={`onboarding-city-${c.id}`}>
                  <Text style={{ fontSize: 18, fontWeight: '600', color: mapTheme.paper }}>{c.name}</Text>
                  <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>{t('saved.placesCount', { count: c.placeCount ?? 0 })}</Text>
                </Pressable>
              );
            })
          : TASTE_CHOICES.map((c) => {
              const selected = tastes.includes(c);
              const meta = CATEGORY_META[c];
              return (
                <Pressable key={c} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => { hapticSelection(); setLocalTastes((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c])); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, paddingHorizontal: 18, borderRadius: 26, borderWidth: 1.5, borderColor: selected ? categoryColor(c) : 'rgba(255,255,255,0.14)', backgroundColor: selected ? categoryColor(c) : pressed ? 'rgba(255,255,255,0.08)' : colors.surface })} testID={`onboarding-taste-${c}`}>
                  <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={18} color={mapTheme.paper} />
                  <Text style={{ fontSize: 17, fontWeight: '600', color: mapTheme.paper }}>{t(`pin.${c}`)}</Text>
                </Pressable>
              );
            })}
      </ScrollView>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: insets.bottom + 120, experimental_backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0) 0%, ${colors.background} 55%)` }} />
      <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: insets.bottom + spacing.lg, flexDirection: 'row', gap: spacing.sm }}>
        {step === 1 ? (
          <Pressable accessibilityRole="button" onPress={done} style={{ height: 54, paddingHorizontal: 22, borderRadius: 27, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} testID="onboarding-skip">
            <Text style={{ fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.8)' }}>{t('onboarding.skip')}</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" disabled={!canNext} onPress={() => (step === 0 ? setStep(1) : done())} style={({ pressed }) => ({ flex: 1, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: mapTheme.paper, opacity: canNext ? (pressed ? 0.85 : 1) : 0.4 })} testID="onboarding-next">
          <Text style={{ fontSize: 17, fontWeight: '700', color: mapTheme.ink }}>{t(step === 0 ? 'onboarding.next' : 'onboarding.start')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
