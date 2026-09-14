---
name: vp-source-ingestion
description: "Apify/EnsembleData adaptörü, polling, webhook, normalize veri veya source refresh işlerinde kullan. Sağlayıcı sözleşmesi, tekilleştirme, durable teslim ve hata davranışı uygula."
---

# vp-source-ingestion

Bu skill Viral Places için bu paket kapsamında yazılmış proje talimatıdır. Dış sağlayıcının resmi skill'i değildir. Kullanmak, adını anmak değil adımlarını uygulayıp sonucu doğrulamaktır.

## Yetki ve kaynak

Ana kaynak [ana şartname](../../../VIRAL_PLACES_MASTER_BUILD_SPEC_TR.md), özellikle **13–14, 18–19, 24, 27, 31** bölümleridir. [AGENTS.md](../../../AGENTS.md) kuralları geçerlidir. Resmi kütüphane API'leri sürümüne uygun güncel belgelerle doğrulanır; skill ücretli hesap, API erişimi veya production onayı sağlamaz.

## Girdiler

Güncel sağlayıcı endpoint/Actor şeması, izinli fixture, rights record, budget, schemaVersion, mevcut source watermark.

## Uygulama adımları

1. Repo adaptör arayüzünü oku; provider fonksiyon adlarını bizim domain metodumuzla karıştırma. Canlı schema ve maliyet davranışını sınırlı smoke testte doğrula.
2. Platform kimliklerini string olarak sakla. Caption ile transcript’i, post country alanı ile venue location’ı, null ile sıfırı ayır. Sayaçları overwrite etme; observedAt snapshot yaz.
3. Provider+post ID ve content hash üzerinden ingest/extract işini tekilleştir. İki kez getirilen aynı post iki kez AI ücretine dönüşmemeli; metrik refresh extraction tetiklemeyebilir.
4. Webhook’ta body/secret/run doğrulaması yap; inbox+outbox tek DB transaction’ından sonra ACK ver. Duplicate ve sıra dışı teslim testlerini çalıştır. Keyfi datasetURL fetch etme.
5. Tek dispatcher ile due creator’ları al; lease ve bounded concurrency uygula. Provider’ın pinned post/cutoff/pagination davranışını ölç; sonuç sayısını tahminle sınırsız büyütme.
6. 429/timeout için bounded retry ve backpressure; auth/schema/hak hatası için ayrı fail yolu. Framework ve HTTP retry sayılarının çarpılarak maliyeti büyütmesini önle.
7. Run ID, yeni/tekrar adet, alan eksikliği, observation age ve gerçek maliyeti kaydet; source deletion için policy ve invalidation hattını tetikle.

## Kabul kanıtı

Üç duplicate webhook yalnız bir normalize kayıt/ücretli extraction üretir. Restart sonrası kayıp iş yok. Null/large ID fixture geçer. Sağlayıcı kesintisinde kullanıcıya stale veri dürüst gösterilir.

## Yapılmayacaklar

Kapalı hesabı cookie/CAPTCHA/account rotation ile aşma; her kullanıcı harita açtığında taramayı yeniden başlatma; 2xx ACK verip sonra işi kaybetme.

## Birlikte kullanılacaklar

vp-media-rights, vp-data-security, vp-cost-observability; job platformunun güncel resmi task belgeleri.

## Teslim kaydı

`docs/build-log.md` içine görev kimliği, okunan skill dosyası, uygulanan kural, değişen dosyalar, gerçekten çalıştırılan komutlar, sonuçlar ve kanıt yollarını ekle. Çalıştırılamayan testi `NOT_RUN`; erişim/hak/bütçe engelini `BLOCKED` yaz. Çözülemeyen konuya rağmen güvenli ve bağımsız işlere devam et; eksik entegrasyonu sahte success ile doldurma.
