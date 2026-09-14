---
name: vp-creator-coverage
description: "Creator keşfi/seçimi, izleme havuzu veya şehir-kategori kapsamı değiştiğinde kullan. Takipçi sayısından çok yer keşfi katkısını, hakları ve örneklem açıklığını değerlendir."
---

# vp-creator-coverage

Bu skill Viral Places için bu paket kapsamında yazılmış proje talimatıdır. Dış sağlayıcının resmi skill'i değildir. Kullanmak, adını anmak değil adımlarını uygulayıp sonucu doğrulamaktır.

## Yetki ve kaynak

Ana kaynak [ana şartname](../../../VIRAL_PLACES_MASTER_BUILD_SPEC_TR.md), özellikle **8, 12–13, 17, 28** bölümleridir. [AGENTS.md](../../../AGENTS.md) kuralları geçerlidir. Resmi kütüphane API'leri sürümüne uygun güncel belgelerle doğrulanır; skill ücretli hesap, API erişimi veya production onayı sağlamaz.

## Girdiler

İzinli aday liste; discovery query ve tarih; creator kimlikleri; örnek gönderiler; şehir/kategori hedefleri; hak ve bütçe sınırları.

## Uygulama adımları

1. Kaynağı ve keşif yöntemini kaydet. Arama sonucunun tüm dünyanın en iyi creator sıralaması olmadığını açık tut.
2. Aday creator hesaplarını platform kalıcı kimliğiyle tekilleştir. Aynı kişinin platformlar arası kimliğini yalnız kanıt varsa birleştir; benzer handle yeterli değil.
3. Konu uyumu, çıkarılabilir yer, coğrafi katkı, süreklilik, medyan izlenme istikrarı ve özgünlüğü ayrı ölç. Hak/erişim eksikliği skor cezası değil canlı kullanım engelidir.
4. CreatorFit v0 ağırlıklarını ana şartnameden uygula; en az 20 uygun post veya yetersiz örnek işareti. Tek viral video ortalama performansı şişirmesin.
5. Şehir×kategori×dil×yerel/gezgin matrisi üret. Aynı mahallede birçok kafe, çocuk aktivitesi veya müze boşluğunu kapatmaz.
6. Gezgin creator’ın diğer şehir postlarını sırf pilot şehri dışında diye pahalı tekrar çekip atma. İzin varsa coverage_pending olarak yönet; yayın kapsamı ile toplama kapsamını ayır.
7. İzlenen creator sayısı, tazelik ve kategori boşluklarını public coverage metnine yansıt. Creator profilini resmi işbirliği gibi gösterme.

## Kabul kanıtı

Adayların kaynağı, skor bileşenleri, hak durumu ve kapsam katkısı görülebilir. Pilot ve global hedef ayrıdır. Tek kişi cross-post’u bağımsız iki creator sayılmaz.

## Yapılmayacaklar

Dünyanın en iyi 200 hesabı garantisi; özel hesap/veri toplama; yalnız takipçi büyüklüğüne göre seçim; boş şehir için eksiksiz kapsam iddiası.

## Birlikte kullanılacaklar

vp-source-ingestion, vp-media-rights, vp-cost-observability, vp-trend-scoring.

## Teslim kaydı

`docs/build-log.md` içine görev kimliği, okunan skill dosyası, uygulanan kural, değişen dosyalar, gerçekten çalıştırılan komutlar, sonuçlar ve kanıt yollarını ekle. Çalıştırılamayan testi `NOT_RUN`; erişim/hak/bütçe engelini `BLOCKED` yaz. Çözülemeyen konuya rağmen güvenli ve bağımsız işlere devam et; eksik entegrasyonu sahte success ile doldurma.
