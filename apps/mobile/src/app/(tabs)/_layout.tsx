import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { usePathname } from 'expo-router';
import { colors, mapTheme } from '@/theme';
import { useT } from '@/hooks/use-t';

/**
 * Apple'ın kendi tab bar'ı (UITabBarController; iOS 26'da Liquid Glass) — Expo Router NativeTabs.
 * Keşfet · Kaydedilenler · Takip Ettiklerin · Profil (§7.1). Sekme geçişinde animasyon yok; her sekme kendi stack'ini tutar.
 */
export default function TabsLayout() {
  const { t } = useT();
  const onMap = usePathname() === '/';
  // The explore route also hosts a light search list; system blue stays legible on both surfaces.
  const selectedColor = colors.food;
  const inactiveColor = onMap ? mapTheme.textMuted : colors.textSecondary;
  return (
    <NativeTabs
      tintColor={selectedColor}
      backgroundColor={onMap ? mapTheme.background : colors.surface}
      iconColor={{ default: inactiveColor, selected: selectedColor }}
      labelStyle={{ default: { color: inactiveColor, fontWeight: '600' }, selected: { color: selectedColor, fontWeight: '600' } }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' } as never} md="map" />
        <NativeTabs.Trigger.Label>{t('tab.explore')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="saved">
        <NativeTabs.Trigger.Icon sf={{ default: 'bookmark', selected: 'bookmark.fill' } as never} md="bookmark" />
        <NativeTabs.Trigger.Label>{t('tab.saved')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="following">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' } as never} md="group" />
        <NativeTabs.Trigger.Label>{t('tab.following')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' } as never} md="account_circle" />
        <NativeTabs.Trigger.Label>{t('tab.profile')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
