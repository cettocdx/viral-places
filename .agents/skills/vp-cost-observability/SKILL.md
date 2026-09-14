---
name: vp-cost-observability
description: "Polling, AI, Maps, storage, retry, cache veya ücretli bir servis değişikliğinde kullan. Ölçülen kullanım, rezervasyon, hard limit, tazelik ve arıza gözlemini birlikte tasarla."
---

# vp-cost-observability

Bu skill Viral Places için bu paket kapsamında yazılmış proje talimatıdır. Dış sağlayıcının resmi skill'i değildir. Kullanmak, adını anmak değil adımlarını uygulayıp sonucu doğrulamaktır.

## Yetki ve kaynak

Ana kaynak [ana şartname](../../../VIRAL_PLACES_MASTER_BUILD_SPEC_TR.md), özellikle **13, 17, 24, 26–28, 31** bölümleridir. [AGENTS.md](../../../AGENTS.md) kuralları geçerlidir. Resmi kütüphane API'leri sürümüne uygun güncel belgelerle doğrulanır; skill ücretli hesap, API erişimi veya production onayı sağlamaz.

## Girdiler

Plan/SKU fiyat kaydı ve tarih; bütçe sahibi onayı; günlük/aylık limit; job sözleşmesi; provider usage response; ölçüm dashboardu.

## Uygulama adımları

1. Birimleri ayır: creator, poll, dönen post, yeni post, run, transcript dakika, video saniye/token, Places field SKU, storage/egress. Birimi belirsiz fiyatı hesapta kullanma.
2. Sağlayıcı plan kredilerini iki kez faturalama; başlangıç planına Business indirimini uygulama. Resmi fiyatı güncel tarih ile kaydet; gerçek run faturasıyla doğrula.
3. Central ingestion kullanıcı harita açışından bağımsızdır. Aynı post hash’i için yinelenen AI işini ve queue retry çarpanlarını kontrol et.
4. Maliyetli iş öncesi reservation; bitince actual reconcile; crash rezervasyonu için süre/kurtarma. Budget bilinmiyorsa live_ingestion false. %50/%80 alarm; hard limitte yeni ücretli işleri durdur.
5. İş trace/run/post IDs, süre, outcome ve usage kaydet; secret ve kullanıcı exact konumu loglama. Provider error ile rights_denied/budget_exceeded ayrı ölçülsün.
6. Freshness, auto-match precision ve doğru yeni venue başına toplam maliyeti birlikte raporla. Ucuzlatırken tazelik düşerse kullanıcı etiketi güncellensin.
7. Provider outage, schema drift, duplicate webhook ve hard-budget senaryolarını test et. Güvenlik/takedown/deletion işleri bütçe kesicisinden dolayı süresiz askıda kalmasın.

## Kabul kanıtı

Sentetik 200×4×10×30=240.000 sonuç hesabı doğru; gerçek maliyet ayrı işaretli. Hard limit testte çalışıyor. Duplicate olay ek AI ücreti üretmiyor. Stale ve failed durumları ayrı dashboardda.

## Yapılmayacaklar

Tahmini maliyeti kesin fatura gibi sunma; limit aşıldığında kullanıcı bütçesini kendiliğinden artırma; kalitesiz veriyi ucuz ve başarılı raporlama.

## Birlikte kullanılacaklar

vp-source-ingestion, vp-data-security, vp-release-gates; var olan gözlem platformunun resmi belgeleri.

## Teslim kaydı

`docs/build-log.md` içine görev kimliği, okunan skill dosyası, uygulanan kural, değişen dosyalar, gerçekten çalıştırılan komutlar, sonuçlar ve kanıt yollarını ekle. Çalıştırılamayan testi `NOT_RUN`; erişim/hak/bütçe engelini `BLOCKED` yaz. Çözülemeyen konuya rağmen güvenli ve bağımsız işlere devam et; eksik entegrasyonu sahte success ile doldurma.
