import { Stack } from 'expo-router/stack';
import { colors } from '@/theme';
import { useT } from '@/hooks/use-t';

/** Apple native büyük başlıklı navigasyon çubuğu (UINavigationBar large title, kaydırınca daralır). */
export default function SavedScreenLayout() {
  const { t } = useT();
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerLargeStyle: { backgroundColor: 'transparent' },
        headerTitleStyle: { color: colors.textPrimary },
        headerLargeTitleStyle: { color: colors.textPrimary },
        headerLargeTitleEnabled: true,
        headerBlurEffect: 'none',
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('saved.title') }} />
    </Stack>
  );
}
