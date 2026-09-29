import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, hairline, pressedTint, pressFeedback, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { hapticSelection } from '@/lib/haptics';
import { appConfig } from '@/lib/config';
import { usePreferences } from '@/features/preferences/store';
import { DemoBanner } from '@/components/demo-badge';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';

/**
 * HIG "inset grouped" satır modeli: gruplu beyaz kart, hairline ayırıcı, satır basınca arka plan vurgusu (scale değil).
 * Not: @expo/ui SwiftUI Form/List denendi; bu build'de HostView "FieldInvalidTypeException" ile render etmedi (build-log'a bakınız).
 */
function Row({ label, value, onPress, sf, material, testID, last }: { label: string; value?: string; onPress?: () => void; sf: string; material: string; testID?: string; last?: boolean }) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 48, ...pressFeedback(pressed, 'row'), borderBottomWidth: last ? 0 : 1, borderBottomColor: hairline })}
      testID={testID}
    >
      <Icon sf={sf} material={material as never} size={18} color={colors.textSecondary} weight="regular" />
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
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl * 2 }} testID="profile-scroll">
      <DemoBanner />
      {/* Marka yalnız keşfet başlığında yaşar (HIG "Branding": logo ekran ekran tekrar etmez, içeriğe yer açar). */}
      <ThemedText variant="helper" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
        {t('profile.guestBody')}
      </ThemedText>
      <Group>
        <Row label={t('profile.language')} value={locale === 'tr' ? 'Türkçe' : 'English'} onPress={() => { hapticSelection(); prefs.setLocale(locale === 'tr' ? 'en' : 'tr'); }} sf="globe" material="language" testID="profile-language" />
        <Row label={t('profile.distanceUnit')} value={prefs.distanceUnit} onPress={() => { hapticSelection(); prefs.setDistanceUnit(prefs.distanceUnit === 'km' ? 'mi' : 'km'); }} sf="ruler" material="straighten" />
        <Row label={t('profile.locationPermission')} onPress={() => Linking.openSettings()} sf="location" material="my-location" />
        <Row label={t('profile.privacy')} onPress={() => router.push('/settings/privacy')} sf="lock" material="lock-outline" testID="profile-privacy" last />
      </Group>
      <Group>
        <Row label={t('profile.version')} value={appConfig.version} sf="info.circle" material="info-outline" last />
      </Group>
    </ScrollView>
  );
}
