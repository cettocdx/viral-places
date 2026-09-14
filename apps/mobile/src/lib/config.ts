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

/** Entegrasyon durumu; Profil ekranında dürüstçe listelenir (§33.2). */
export const integrationStatus = [
  { key: 'googleMaps', label: 'Google Maps SDK', status: appConfig.googleMapsConfigured ? 'CONFIGURED' : 'BLOCKED' },
  { key: 'api', label: 'Viral Places API (/api/v1)', status: process.env.EXPO_PUBLIC_API_BASE_URL ? 'CONFIGURED' : 'BLOCKED' },
  { key: 'supabase', label: 'Supabase (DB/Auth)', status: process.env.EXPO_PUBLIC_SUPABASE_URL ? 'CONFIGURED' : 'BLOCKED' },
  { key: 'apify', label: 'Apify / EnsembleData (kaynak)', status: 'BLOCKED' },
  { key: 'ai', label: 'AI çıkarım modeli', status: 'BLOCKED' },
  { key: 'instagram', label: 'Instagram adaptörü', status: 'BLOCKED' },
] as const;
