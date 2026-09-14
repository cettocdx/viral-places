import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, hairline, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { hapticSelection } from '@/lib/haptics';
import { appConfig, integrationStatus } from '@/lib/config';
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
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 48, backgroundColor: pressed ? 'rgba(17,24,39,0.05)' : 'transparent', borderBottomWidth: last ? 0 : 1, borderBottomColor: hairline })}
      testID={testID}
    >
      <Icon sf={sf} material={material as never} size={18} color={colors.textSecondary} weight="regular" />
      <ThemedText style={{ flex: 1 }}>{label}</ThemedText>
      {value ? (
        <ThemedText variant="helper" tone="secondary">
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
      <View style={{ gap: spacing.xs }}>
        <ThemedText variant="headline">{t('profile.guest')}</ThemedText>
        <ThemedText tone="secondary">{t('profile.guestBody')}</ThemedText>
      </View>
      <Group>
        <Row label={t('profile.language')} value={locale === 'tr' ? 'Türkçe' : 'English'} onPress={() => { hapticSelection(); prefs.setLocale(locale === 'tr' ? 'en' : 'tr'); }} sf="globe" material="language" testID="profile-language" />
        <Row label={t('profile.distanceUnit')} value={prefs.distanceUnit} onPress={() => { hapticSelection(); prefs.setDistanceUnit(prefs.distanceUnit === 'km' ? 'mi' : 'km'); }} sf="ruler" material="straighten" />
        <Row label={t('profile.locationPermission')} onPress={() => Linking.openSettings()} sf="location" material="my-location" />
        <Row label={t('profile.notifications')} value="M2" sf="bell" material="notifications-none" />
        <Row label={t('profile.syncStatus')} value={t('profile.syncLocalOnly')} sf="arrow.triangle.2.circlepath" material="sync" />
        <Row label={t('profile.privacy')} onPress={() => router.push('/settings/privacy')} sf="lock" material="lock-outline" testID="profile-privacy" />
        <Row label={t('import.title')} onPress={() => router.push('/import')} sf="link" material="link" testID="profile-import" />
        <Row label={t('profile.reportIssue')} value="M2" sf="flag" material="flag" last />
      </Group>
      <Group>
        <Row label={t('profile.dataMode')} value={appConfig.dataMode.toUpperCase()} sf="shippingbox" material="inventory" />
        {integrationStatus.map((i) => (
          <Row key={i.key} label={i.label} value={i.status} sf={i.status === 'BLOCKED' ? 'xmark.octagon' : 'checkmark.circle'} material={i.status === 'BLOCKED' ? 'block' : 'check-circle-outline'} />
        ))}
        <Row label={t('profile.version')} value={appConfig.version} sf="info.circle" material="info-outline" last />
      </Group>
    </ScrollView>
  );
}
