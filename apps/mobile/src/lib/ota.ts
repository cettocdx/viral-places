import { useEffect } from 'react';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/**
 * Kablosuz güncelleme (EAS Update). Varsayılan davranış "açılışta indir, bir SONRAKİ açılışta uygula" idi; ürün sahibi
 * TestFlight'ta güncellemeyi görmedi (21.09.2026). Açılışta güncelleme varsa indirilip hemen yeniden yüklenir
 * (ilk saniyelerde, kullanıcı henüz etkileşime girmeden). Geliştirme istemcisinde ve gömülü paketle çalışırken kapalı.
 */
export function useApplyUpdatesOnLaunch(): void {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable || cancelled) return;
        const fetched = await Updates.fetchUpdateAsync();
        if (fetched.isNew && !cancelled) await Updates.reloadAsync();
      } catch {
        // Ağ yok / sunucu yok: sessizce mevcut paketle devam.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}

/** Profil › Sürüm satırı: "0.0.1 (5) · 21.09 17:11" — hangi native build ve hangi güncelleme yüklü, uygulamadan görülür. */
export function versionLabel(locale: string): string {
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const build = Constants.nativeBuildVersion ? ` (${Constants.nativeBuildVersion})` : '';
  if (__DEV__) return `${version}${build} · dev`;
  if (!Updates.isEnabled || Updates.isEmbeddedLaunch || !Updates.createdAt) return `${version}${build}`;
  const stamp = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(Updates.createdAt);
  return `${version}${build} · ${stamp}`;
}
