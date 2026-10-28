import { Fragment } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { isFeaturedCityName } from '@viral-places/api-client';
import { useRouter } from 'expo-router';
import { colors, hairline, pressedTint, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { useCities, useCity } from '@/lib/api/hooks';
import { usePreferences } from '@/features/preferences/store';
import { hapticSelection } from '@/lib/haptics';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';

/**
 * Şehir seçici (çok şehir, 02.10.2026): kapsamı olan şehirler seçilebilir; kapsamı olmayanlar "Yakında".
 * 28.10.2026: seçili 15 şehirden sonra "Diğer şehirler" ayracı ve mekan sayısı.
 */
export function CityPickerSheet() {
  const { t } = useT();
  const router = useRouter();
  const cities = useCities();
  const current = useCity();
  const setLastCityId = usePreferences((s) => s.setLastCityId);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }} testID="city-picker">
      <ThemedText variant="sectionTitle">{t('cityPicker.title')}</ThemedText>
      {(cities.data ?? []).map((c, i, all) => {
        const selected = c.id === current.data?.id;
        const available = c.coverage.status !== 'none';
        const firstOther = !isFeaturedCityName(c.name) && (i === 0 || isFeaturedCityName(all[i - 1]!.name));
        return (
          <Fragment key={c.id}>
          {firstOther && i > 0 ? (
            <ThemedText variant="sectionTitle" style={{ marginTop: spacing.lg }}>{t('cityPicker.others')}</ThemedText>
          ) : null}
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !available }}
            accessibilityLabel={available ? c.name : `${c.name}, ${t('cityPicker.soon')}`}
            disabled={!available}
            onPress={() => {
              hapticSelection();
              setLastCityId(c.id);
              router.back();
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              minHeight: 52,
              paddingHorizontal: spacing.md,
              borderRadius: radius.cardSmall,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: selected ? colors.primaryAction : hairline,
              backgroundColor: pressed ? pressedTint() : colors.surface,
              opacity: available ? 1 : 0.5,
            })}
            testID={`city-picker-${c.id}`}
          >
            <Icon sf={selected ? 'checkmark.circle.fill' : 'circle'} material={selected ? 'check-circle' : 'radio-button-unchecked'} size={22} color={selected ? colors.primaryAction : colors.textSecondary} weight="regular" />
            <ThemedText style={{ flex: 1 }} numberOfLines={1}>
              {c.name}
            </ThemedText>
            {!available ? (
              <View>
                <ThemedText variant="helper" tone="secondary">
                  {t('cityPicker.soon')}
                </ThemedText>
              </View>
            ) : c.placeCount ? (
              <ThemedText variant="helper" tone="secondary" style={{ fontVariant: ['tabular-nums'] }}>
                {t('saved.placesCount', { count: c.placeCount })}
              </ThemedText>
            ) : null}
          </Pressable>
          </Fragment>
        );
      })}
    </ScrollView>
  );
}
