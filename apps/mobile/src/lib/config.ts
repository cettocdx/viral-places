import Constants from 'expo-constants';

interface Extra {
  dataMode?: 'demo' | 'live';
  googleMapsConfigured?: boolean;
  googleMapsConfiguredIos?: boolean;
  googleMapsConfiguredAndroid?: boolean;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** Uygulama geneli veri modu; UI'da DEMO etiketi bu değerden türetilir. */
export const appConfig = {
  dataMode: extra.dataMode ?? 'demo',
  /** Google Maps anahtarı app.config.ts'de ortamdan okunur; yoksa DEMO harita yüzeyi (ADR-014). */
  googleMapsConfigured:
    process.env.EXPO_OS === 'ios'
      ? extra.googleMapsConfiguredIos === true
      : process.env.EXPO_OS === 'android'
        ? extra.googleMapsConfiguredAndroid === true
        : false,
  version: Constants.expoConfig?.version ?? '0.0.0',
  /** /api/v1 taban adresi (EXPO_PUBLIC_API_BASE_URL). Boşsa fixture istemcisi. */
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || null,
} as const;
