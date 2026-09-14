---
name: vp-mobile-acceptance
description: "Viral Places native mobil ekranı veya uçtan uca akışı tamamlandı denmeden önce kullan. iOS/Android gerçek build, erişilebilirlik, video/harita jestleri ve cihaz durumlarını doğrula."
---

# vp-mobile-acceptance

Bu skill Viral Places için bu paket kapsamında yazılmış proje talimatıdır. Dış sağlayıcının resmi skill'i değildir. Kullanmak, adını anmak değil adımlarını uygulayıp sonucu doğrulamaktır.

## Yetki ve kaynak

Ana kaynak [ana şartname](../../../VIRAL_PLACES_MASTER_BUILD_SPEC_TR.md), özellikle **6–7, 19–21, 25–26, 29–30** bölümleridir. [AGENTS.md](../../../AGENTS.md) kuralları geçerlidir. Resmi kütüphane API'leri sürümüne uygun güncel belgelerle doğrulanır; skill ücretli hesap, API erişimi veya production onayı sağlamaz.

## Girdiler

Çalışan native build; test cihaz/OS kaydı; fixture veya staging account; ilgili kabul akışı; üç görsel referans; erişilebilirlik ayarları.

## Uygulama adımları

1. Expo SDK ve native modül uyumunu güncel projeden belirle. Google Maps iOS ve Android provider, key restriction ve development build davranışını gerçek native ortamda doğrula.
2. Harita→pin→mekan→kanıt→kaydet/plan/directions ile creator→haritası→takip akışlarını çalıştır. Kontroller gerçek eylem üretmeli; sadece toast ile bitmesin.
3. Konum reddi/approximate konum, offline, token expire, permission restore, background/foreground ve back navigation state durumlarını test et.
4. Tek video playback, sessiz başlangıç, başka ekrana geçince durma, sosyal app kurulu değilken dış link fallback ve resmi embed davranışını cihazda kontrol et.
5. Maestro native testleri veya eşdeğer doğrulanmış cihaz otomasyonu çalıştır. Web browser screenshot native test yerine geçmez; hangi platformun test edilmediğini belirt.
6. VoiceOver/TalkBack, büyük font, düşük hareket, dar ekran, safe area ve klavye çakışmasını kontrol et. Harita alternatif liste ile kullanılabilir olsun.
7. Build ID, cihaz/OS, veri modu, geçen/kalan senaryo ve screenshot/video yollarını evidence raporuna yaz. Provider veya signing yoksa ilgili kapsamı BLOCKED bırak.

## Kabul kanıtı

İki platformda ana akışlar geçiyor; ekranlar referans hissini koruyor; performans ölçümleri cihaz/ağ ile raporlu; erişilebilirlik ve bozuk network senaryoları kanıtlı.

## Yapılmayacaklar

Web preview’ı iOS uygulaması diye sunma; screenshot’ı çalışan buton kanıtı sayma; yalnız en yeni telefonla bütün cihazları destekliyor iddiası.

## Birlikte kullanılacaklar

vp-design-fidelity, expo-overview, expo-dev-client, expo-router, expo-data-fetching, gerektiğinde eas-simulator. Ücretli test hizmeti için onay gereklidir.

## Teslim kaydı

`docs/build-log.md` içine görev kimliği, okunan skill dosyası, uygulanan kural, değişen dosyalar, gerçekten çalıştırılan komutlar, sonuçlar ve kanıt yollarını ekle. Çalıştırılamayan testi `NOT_RUN`; erişim/hak/bütçe engelini `BLOCKED` yaz. Çözülemeyen konuya rağmen güvenli ve bağımsız işlere devam et; eksik entegrasyonu sahte success ile doldurma.
