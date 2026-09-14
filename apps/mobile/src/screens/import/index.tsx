import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { colors, hairline, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { validateSocialUrl } from '@/lib/validate-social-url';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';

export function ImportScreen() {
  const { t } = useT();
  const [value, setValue] = useState('');
  const [result, setResult] = useState<'idle' | 'invalid' | 'blocked'>('idle');
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: true, title: t('import.title'), headerTransparent: true, headerBlurEffect: 'none', headerLargeTitleEnabled: true, headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false, headerLargeTitleShadowVisible: false, headerLargeStyle: { backgroundColor: 'transparent' } }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <ThemedText tone="secondary">{t('import.body')}</ThemedText>
        <TextInput
          value={value}
          onChangeText={(v) => { setValue(v); setResult('idle'); }}
          placeholder={t('import.placeholder')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          accessibilityLabel={t('import.placeholder')}
          style={{ minHeight: 48, borderWidth: 1, borderColor: hairline, borderRadius: radius.cardSmall, backgroundColor: colors.surface, paddingHorizontal: spacing.md, fontSize: 16, color: colors.textPrimary }}
          testID="import-input"
        />
        <Button title={t('import.submit')} onPress={() => setResult(validateSocialUrl(value) === 'valid' ? 'blocked' : 'invalid')} testID="import-submit" />
        {result === 'invalid' ? <ThemedText style={{ color: colors.trending }}>{t('import.invalid')}</ThemedText> : null}
        {result === 'blocked' ? <ThemedText tone="secondary">{t('import.blocked')}</ThemedText> : null}
      </ScrollView>
    </View>
  );
}
