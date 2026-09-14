---
name: vp-design-fidelity
description: "Viral Places ekranı, bileşeni, tokenı veya etkileşimi değişirken kullan. Onaylı harita, mekan ve creator görsellerinin açık renkli premium tasarım dilini koru."
---

# vp-design-fidelity

Bu skill Viral Places için bu paket kapsamında yazılmış proje talimatıdır. Dış sağlayıcının resmi skill'i değildir. Kullanmak, adını anmak değil adımlarını uygulayıp sonucu doğrulamaktır.

## Yetki ve kaynak

Ana kaynak [ana şartname](../../../VIRAL_PLACES_MASTER_BUILD_SPEC_TR.md), özellikle **6–8, 21, 25–26** bölümleridir. [AGENTS.md](../../../AGENTS.md) kuralları geçerlidir. Resmi kütüphane API'leri sürümüne uygun güncel belgelerle doğrulanır; skill ücretli hesap, API erişimi veya production onayı sağlamaz.

## Girdiler

design/references içindeki üç PNG; config/design-tokens.json; hedef cihaz; gerçek veya açık DEMO fixture; ekran davranışı.

## Uygulama adımları

1. Üç PNG’yi görsel olarak aç. Bunlar içerik doğruluğu değil görsel dil referansıdır; harita geometrisi, sahte puan veya hayali işletme iddiasını kopyalama.
2. Tokenları tek kaynaktan kullan. Beyaz/gri yüzey, navy CTA, kategori renkleri ve sakin hiyerarşi korunur. Native platform ölçülerini kullan; resmin içine çizilmiş telefonu uygulamaya ekleme.
3. Alt navigasyonu Keşfet/Kaydedilenler/Takip Ettiklerin/Profil olarak birleştir. Yinelenen bookmark düğmelerini tekleştir; aynı işlev için farklı ikon üretme.
4. Loading, empty, error, stale, permission-denied, source-unavailable ve score-null durumlarını normal ekranla beraber tasarla. Boşluğu sahte video/puan ile doldurma.
5. Detay ve creator sayfalarını kaydırılabilir yap; bütün screenshot içeriğini tek viewport’a sıkıştırıp yazıları küçültme. Safe area, klavye ve sticky CTA çakışmasını ölç.
6. Platform video embed kontrollerini saklamadan hero kabuğuna yerleştir. Native özel oynatıcı ancak hak policy’si izinliyse. Google attribution sheet altında kalmamalı.
7. Aynı fixture/viewport ile screenshot al; altı boyutta hiyerarşi, boşluk, tipografi, medya oranı, chip/pin ve CTA incele. Dinamik harita alanını görsel regression’da ayrı değerlendir.

## Kabul kanıtı

6×5 puan incelemesinde hedef ≥26/30, hiçbir boyut <3 değil; dar ekran ve büyük fontta taşma yok; kaynak hakları için yapılan oyuncu farkları açık; üç temel ekran aynı ailenin parçası görünür.

## Yapılmayacaklar

Koyu HUD, neon veya SaaS dashboard’a dönüştürme; görselleri tek image olarak app ekranına basma; sadece pixel snapshot güncelleyip regression’ı çözülmüş sayma.

## Birlikte kullanılacaklar

expo-design-system, expo-native-ui, expo-ui, expo-animation; teslimde vp-mobile-acceptance. Figma yalnız gerçek Figma işi varsa.

## Teslim kaydı

`docs/build-log.md` içine görev kimliği, okunan skill dosyası, uygulanan kural, değişen dosyalar, gerçekten çalıştırılan komutlar, sonuçlar ve kanıt yollarını ekle. Çalıştırılamayan testi `NOT_RUN`; erişim/hak/bütçe engelini `BLOCKED` yaz. Çözülemeyen konuya rağmen güvenli ve bağımsız işlere devam et; eksik entegrasyonu sahte success ile doldurma.
