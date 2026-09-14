import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Viral Places — çalışma adı; marka/domain kararı değildir (§2).
 * Google Maps anahtarları yalnız ortam değişkeninden gelir; repo'ya yazılmaz (§21.1, §23.1).
 * Anahtar yoksa harita spike'ı BLOCKED'tır; uygulama DEMO harita yüzeyiyle çalışır (ADR-014).
 */
const iosGoogleMapsApiKey = process.env['GOOGLE_MAPS_IOS_KEY'];
const androidGoogleMapsApiKey = process.env['GOOGLE_MAPS_ANDROID_KEY'];
// Platform bazında: iOS anahtarı tek başına iOS build'i açar; Android anahtarı sonradan eklenebilir.
const googleMapsConfigured = Boolean(iosGoogleMapsApiKey || androidGoogleMapsApiKey);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Viral Places (DEMO)',
  slug: 'viral-places',
  scheme: 'viralplaces',
  version: '0.0.1',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: false,
    // Placeholder; mağaza kimliği ürün adı/hesap kararından sonra belirlenir (§33.2).
    bundleIdentifier: 'dev.viralplaces.mobile',
    // Fiziksel cihaz imzalama: Team ID ortamdan (apps/mobile/.env → APPLE_TEAM_ID); yoksa yalnız simülatör.
    ...(process.env.APPLE_TEAM_ID ? { appleTeamId: process.env.APPLE_TEAM_ID } : {}),
    infoPlist: {
      CADisableMinimumFrameDurationOnPhone: true,
      NSLocationWhenInUseUsageDescription:
        'Yakınındaki mekanları göstermek için konumun yalnız uygulama açıkken kullanılır. İzin vermezsen şehir seçerek devam edebilirsin.',
    },
  },
  android: {
    package: 'dev.viralplaces.mobile',
    adaptiveIcon: {
      backgroundColor: '#F7F8FA',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-image',
    'expo-web-browser',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Yakınındaki mekanları göstermek için konumun yalnız uygulama açıkken kullanılır.',
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    ...(googleMapsConfigured
      ? ([[
          'react-native-maps',
          {
            ...(iosGoogleMapsApiKey ? { iosGoogleMapsApiKey } : {}),
            ...(androidGoogleMapsApiKey ? { androidGoogleMapsApiKey } : {}),
          },
        ]] as [string, unknown][])
      : []),
  ],
  extra: {
    dataMode: 'demo',
    googleMapsConfigured,
    googleMapsConfiguredIos: Boolean(iosGoogleMapsApiKey),
    googleMapsConfiguredAndroid: Boolean(androidGoogleMapsApiKey),
    router: {},
  },
});
