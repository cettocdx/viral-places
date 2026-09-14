import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SystemUI from 'expo-system-ui';
import { colors } from '@/theme';
import { queryClient } from '@/lib/query-client';
import { useLibraryStore } from '@/features/library/store';
import { usePreferences } from '@/features/preferences/store';

/**
 * Kök layout: sağlayıcılar + native stack. Tab'lar, stack detaylar ve formSheet modaller (§7.1).
 * Hidrasyon tamamlanmadan karar verilmez (kalıcı misafir verisi yanlış ekran flaşı yapmasın).
 */
export default function RootLayout() {
  const libraryHydrated = useLibraryStore((s) => s.hydrated);
  const prefsHydrated = usePreferences((s) => s.hydrated);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, []);

  if (!libraryHydrated || !prefsHydrated) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="places/[id]" />
            <Stack.Screen name="creators/[id]" />
            <Stack.Screen name="collections/[id]" />
            <Stack.Screen name="plans/[id]" />
            <Stack.Screen name="settings/privacy" />
            <Stack.Screen name="import" />
            <Stack.Screen
              name="save-to-collection"
              options={{ presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: [0.55, 0.95], contentStyle: { backgroundColor: colors.background } }}
            />
            <Stack.Screen
              name="add-to-plan"
              options={{ presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: [0.6, 0.95], contentStyle: { backgroundColor: colors.background } }}
            />
            <Stack.Screen
              name="trend-explainer"
              options={{ presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: [0.75, 1.0], contentStyle: { backgroundColor: colors.background } }}
            />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
