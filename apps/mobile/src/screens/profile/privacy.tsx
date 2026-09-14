import { Alert, ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { colors, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { useLibraryStore } from '@/features/library/store';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';

export function PrivacyScreen() {
  const { t } = useT();
  const clearAll = useLibraryStore((s) => s.clearAll);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: true, title: t('privacy.title'), headerTransparent: true, headerBlurEffect: 'none', headerLargeTitleEnabled: true, headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false, headerLargeTitleShadowVisible: false, headerLargeStyle: { backgroundColor: 'transparent' } }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <ThemedText tone="secondary">{t('privacy.body')}</ThemedText>
        <Button
          title={t('privacy.clearLocal')}
          variant="secondary"
          onPress={() =>
            Alert.alert(t('privacy.clearLocal'), t('privacy.clearLocalConfirm'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('privacy.clearLocal'), style: 'destructive', onPress: () => { clearAll(); Alert.alert(t('privacy.cleared')); } },
            ])
          }
          testID="privacy-clear"
        />
        <Button title={t('privacy.deleteAccount')} variant="ghost" disabled onPress={() => {}} />
      </ScrollView>
    </View>
  );
}
