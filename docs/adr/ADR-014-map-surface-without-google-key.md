# ADR-014 — Google Maps anahtarı yokken harita yüzeyi

**Tarih:** 11 Eylül 2026 · **Durum:** Kabul edildi (M1) · **Güncelleme 11.09.2026:** iOS anahtarı geldi; iOS dev build'de gerçek Google haritası doğrulandı, DEMO yüzey Android ve anahtarsız ortamlar için sürüyor · **Kapsam:** §7.2, §9.1, §21.1, §29 M1 kabul

## Bağlam

Ürün kararı Google taban haritasıdır (ADR-002); `react-native-maps` iki platformda `PROVIDER_GOOGLE` ile kullanılır. Bu ortamda Google Maps SDK anahtarı yok; Google Cloud billing ve anahtar kısıtları ürün sahibinin hesabına bağlıdır. Anahtarsız `PROVIDER_GOOGLE` iOS'ta çalışmaz; anahtarsız varsayılan provider ise Apple Maps'tir ve şartname bunu "yanlışlıkla Apple Maps" olarak yasaklar.

## Karar

- `app.config.ts`, `GOOGLE_MAPS_IOS_KEY` ve `GOOGLE_MAPS_ANDROID_KEY` ortam değişkenlerini okur; ikisi de varsa `react-native-maps` config plugin'i etkinleşir ve `extra.googleMapsConfigured=true` olur.
- `VenueMap` bileşeni anahtar varsa `GoogleVenueMap` (gerçek SDK), yoksa `DemoVenueMap` render eder. `DemoVenueMap` coğrafya çizmez; sentetik koordinatların eşit-dikdörtgen izdüşümüyle pinleri yerleştirir ve ekranda "DEMO harita yüzeyi — Google Maps anahtarı yapılandırılmadı" notu taşır.
- Apple Maps'e sessiz düşüş yoktur. Harita SDK spike'ı bu teslimde **BLOCKED**; yalnız fixture UI doğrulanır (§29 M1 kabul cümlesiyle uyumlu).

## Açılma koşulu

Ürün sahibi Google Cloud projesi, billing ve bundle/paket kısıtlı Maps SDK anahtarlarını sağlayınca `.env` ile development build alınır (`npx expo run:ios` / `run:android`), pin/attribution/jest testleri gerçek cihazda yapılır ve blokaj `docs/DECISIONS_AND_BLOCKERS.md`'de kapatılır.

## Uygulama notları (11 Eylül 2026)

- `googleMapsConfigured` artık platform bazında çözülür: iOS anahtarı iOS'u açar, Android anahtarı yoksa Android DEMO yüzeyde kalır.
- CocoaPods bu makinede UTF-8 locale ister: `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios`. İlk native derleme bu makinede yaklaşık 60 dakika sürdü (108 pod).
- `ios/` klasörü prebuild ürünüdür ve gitignore'dadır; native değişiklik `app.config.ts` üzerinden yapılır.
