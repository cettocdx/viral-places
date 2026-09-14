---
name: vp-trend-scoring
description: "Viral skor, normalizer, metrik penceresi veya yükselen rozeti üzerinde çalışırken kullan. Ürün endeksini deterministik, açıklanabilir, kaynak sınırlı ve eksik veriye duyarlı tut."
---

# vp-trend-scoring

Bu skill Viral Places için bu paket kapsamında yazılmış proje talimatıdır. Dış sağlayıcının resmi skill'i değildir. Kullanmak, adını anmak değil adımlarını uygulayıp sonucu doğrulamaktır.

## Yetki ve kaynak

Ana kaynak [ana şartname](../../../VIRAL_PLACES_MASTER_BUILD_SPEC_TR.md), özellikle **8, 12, 17, 25, 35** bölümleridir. [AGENTS.md](../../../AGENTS.md) kuralları geçerlidir. Resmi kütüphane API'leri sürümüne uygun güncel belgelerle doğrulanır; skill ücretli hesap, API erişimi veya production onayı sağlamaz.

## Girdiler

İzinli ve eligible postlar; zamanlı snapshots; independent creator mapping; versioned normalizer; config/pipeline-policy.example.json; test vectors.

## Uygulama adımları

1. Önce eligibility filtresini uygula: son 7 gün, açık kaynak, onaylı venue linki, uygun stance, hak ve duplicate/ad/repost kuralları. Kanıtsız reklam tespiti yapma; yalnız bilinen durumları dışla.
2. İki geçerli snapshot arası 1–48 saat; sayaç artışı/zaman ile velocity. Tek gözlem, null veya düşen sayaç normal sıfır velocity değildir.
3. Platform×post yaşı×şehir/kategori cohort ile M normalizasyonu; en az 100 gözlem hedefi ve tanımlı fallback. Cohort sürümünü dondur, gelecekte gözlenen veriyi geçmiş score’a sızdırma.
4. M/D/F/O ve .45/.30/.15/.10 ağırlıklarını şartnameden uygula. O eksikse yalnız tanımlı .90 renormalization; M/D/F eksikse sayı yok. D bağımsız creator sayısını altıda doyurur.
5. En az 3 post, 2 creator, ≥%70 momentum coverage, <24 saat gözlem ve yeterli cohort kapıları. Yükselen için ayrıca score≥75, M≥.70, ≥3 creator, yeni post<72h.
6. Pozitif sonuç yuvarlamasını floor(x+0.5) olarak sabitle. Input ID/hash, asOf, scoreVersion ve normalizationVersion ile replay üret.
7. UI’da örneklem, pencere, null/stale durumunu açık göster. Sponsor/editoryal yerleşimi organik skor dışında tut; bütün platformun kalitesi veya olasılık diye anlatma.

## Kabul kanıtı

V01=71; O eksik V02=72/baseline_partial; tek creator/snapshot => null; eski veri => stale; aynı input/version aynı sonuç. Admin puanı elle artıramıyor.

## Yapılmayacaklar

Skoru LLM’den isteme; eksik metrikleri 0 veya ortalama ile doldurup güvenli gösterme; cross-post audience tekilliği iddiası; global en popüler garantisi.

## Birlikte kullanılacaklar

vp-creator-coverage, vp-source-ingestion, vp-evidence-extraction, vp-cost-observability.

## Teslim kaydı

`docs/build-log.md` içine görev kimliği, okunan skill dosyası, uygulanan kural, değişen dosyalar, gerçekten çalıştırılan komutlar, sonuçlar ve kanıt yollarını ekle. Çalıştırılamayan testi `NOT_RUN`; erişim/hak/bütçe engelini `BLOCKED` yaz. Çözülemeyen konuya rağmen güvenli ve bağımsız işlere devam et; eksik entegrasyonu sahte success ile doldurma.
