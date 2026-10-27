import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { categoryColor, colors, hairline, mapTheme, pressFeedback, radius, spacing } from '@/theme';
import { useLibraryStore } from '@/features/library/store';
import { STICKER_FONT } from '@/components/map/sticker-text';
import { useT } from '@/hooks/use-t';
import { hapticSelection } from '@/lib/haptics';
import { versionLabel } from '@/lib/ota';
import { usePreferences } from '@/features/preferences/store';
import { DemoBanner } from '@/components/demo-badge';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';

/**
 * HIG "inset grouped" satır modeli: gruplu beyaz kart, hairline ayırıcı, satır basınca arka plan vurgusu (scale değil).
 * Not: @expo/ui SwiftUI Form/List denendi; bu build'de HostView "FieldInvalidTypeException" ile render etmedi (build-log'a bakınız).
 */
function Row({ label, value, onPress, sf, material, tint, testID, last }: { label: string; value?: string; onPress?: () => void; sf: string; material: string; tint: string; testID?: string; last?: boolean }) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 48, ...pressFeedback(pressed, 'row'), borderBottomWidth: last ? 0 : 1, borderBottomColor: hairline })}
      testID={testID}
    >
      {/* Gece baskısı (ADR-021): iOS Ayarlar gibi renkli ikon kareleri. */}
      <View style={{ width: 30, height: 30, borderRadius: 8, borderCurve: 'continuous', backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={sf} material={material as never} size={15} color="#FFFFFF" />
      </View>
      <ThemedText style={{ flex: 1 }} numberOfLines={2}>
        {label}
      </ThemedText>
      {value ? (
        <ThemedText variant="helper" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
          {value}
        </ThemedText>
      ) : null}
      {onPress ? <Icon sf="chevron.right" material="chevron-right" size={16} color={colors.textSecondary} /> : null}
    </Pressable>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: colors.surface, borderRadius: radius.cardLarge, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 1, borderColor: hairline }}>{children}</View>;
}

/** Profil ve destek (§7.7). Başlık native large title. Giriş M2. */
export function ProfileScreen() {
  const { t, locale } = useT();
  const router = useRouter();
  const prefs = usePreferences();
  const library = useLibraryStore((s) => s.library);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl * 2 }} testID="profile-scroll">
      <DemoBanner />
      {/* Misafir kartı: sticker avatar ve cihazdaki kayıtların sayaçları (gerçek sayılar, uydurma yok). */}
      <View style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm }}>
        <View style={{ width: 92, height: 92, borderRadius: 46, padding: 5, backgroundColor: mapTheme.paper, transform: [{ rotate: '-6deg' }], boxShadow: '0 12px 28px rgba(0,0,0,0.35)' }}>
          <View style={{ flex: 1, borderRadius: 41, experimental_backgroundImage: `linear-gradient(135deg, ${categoryColor('nightlife')} 0%, ${categoryColor('food')} 100%)`, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf="person.fill" material="person" size={38} color="#FFFFFF" />
          </View>
        </View>
        <Text style={{ fontSize: 26, fontWeight: '700', letterSpacing: -0.5, color: colors.textPrimary, marginTop: spacing.xs }}>{t('profile.guest')}</Text>
        <ThemedText variant="helper" tone="secondary" style={{ textAlign: 'center' }}>{t('profile.guestBody')}</ThemedText>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {[
          { n: library.saves.length, label: t('tab.saved'), color: categoryColor('food') },
          { n: library.collections.length, label: t('saved.collections'), color: categoryColor('coffee') },
          { n: library.plans.length, label: t('saved.plans'), color: categoryColor('sightseeing') },
          { n: library.follows.length, label: t('tab.following'), color: categoryColor('nightlife') },
        ].map((x) => (
          <View key={x.label} accessible accessibilityLabel={`${x.label}: ${x.n}`} style={{ flex: 1, paddingVertical: spacing.md, borderRadius: 20, borderCurve: 'continuous', backgroundColor: mapTheme.paper, alignItems: 'center', gap: 2 }}>
            <Text style={{ fontFamily: STICKER_FONT, fontSize: 24, fontWeight: '800', color: x.color, fontVariant: ['tabular-nums'] }}>{x.n}</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: mapTheme.callout.muted }} numberOfLines={1} adjustsFontSizeToFit>{x.label}</Text>
          </View>
        ))}
      </View>
      <Group>
        <Row label={t('profile.language')} value={locale === 'tr' ? 'Türkçe' : 'English'} onPress={() => { hapticSelection(); prefs.setLocale(locale === 'tr' ? 'en' : 'tr'); }} sf="globe" material="language" tint={categoryColor('food')} testID="profile-language" />
        <Row label={t('profile.distanceUnit')} value={prefs.distanceUnit} onPress={() => { hapticSelection(); prefs.setDistanceUnit(prefs.distanceUnit === 'km' ? 'mi' : 'km'); }} sf="ruler" material="straighten" tint={categoryColor('sightseeing')} />
        <Row label={t('profile.locationPermission')} onPress={() => Linking.openSettings()} sf="location.fill" material="my-location" tint={categoryColor('culture')} />
        <Row label={t('profile.privacy')} onPress={() => router.push('/settings/privacy')} sf="lock.fill" material="lock-outline" tint={categoryColor('nightlife')} testID="profile-privacy" last />
      </Group>
      <Group>
        <Row label={t('profile.version')} value={versionLabel(locale)} sf="info.circle.fill" material="info-outline" tint={mapTheme.road} last />
      </Group>
    </ScrollView>
  );
}
