---
name: vp-place-resolution
description: "Sosyal içerikte geçen mekanı gerçek şehir/şubeyle eşleştirirken kullan. Provenance, aday karşılaştırması, Google cache sınırları ve insan incelemesini uygula."
---

# vp-place-resolution

Bu skill Viral Places için bu paket kapsamında yazılmış proje talimatıdır. Dış sağlayıcının resmi skill'i değildir. Kullanmak, adını anmak değil adımlarını uygulayıp sonucu doğrulamaktır.

## Yetki ve kaynak

Ana kaynak [ana şartname](../../../VIRAL_PLACES_MASTER_BUILD_SPEC_TR.md), özellikle **15–16, 18, 21–22, 25** bölümleridir. [AGENTS.md](../../../AGENTS.md) kuralları geçerlidir. Resmi kütüphane API'leri sürümüne uygun güncel belgelerle doğrulanır; skill ücretli hesap, API erişimi veya production onayı sağlamaz.

## Girdiler

Mention ve evidence; mevcut venue/alias; izinli Places adayları; resolverVersion; kalibrasyon eşikleri; field policy.

## Uygulama adımları

1. Mention orijinal ismini koruyup normalize et; kendi alias ve kesin mevcut linklerini önce ara. Benzer marka adlarını aynı şube varsayma.
2. Açık gönderi şehir/adres/mahalle kanıtını önceliklendir. Creator’ın bio şehri veya upload country alanı venue koordinatı olamaz.
3. Gerekirse güncel Places Text Search ile sınırlı aday ve en küçük field mask iste. Fetch maliyeti, attribution ve expiry kaydı oluştur.
4. İsim, açık şehir, adres/mahalle ve kategori bileşenlerini ana şartnamedeki öneriyle hesapla. Missing feature’ın otomatik renormalization ile tek isimden tam güven üretmesini önle.
5. İlk aday eşiği, ikinci aday farkı, en az iki tür kanıt ve hard conflict kapılarını birlikte uygula. Başlangıç eşiklerini olasılık değil kalibre edilecek kurallar olarak raporla.
6. Çoklu venue video için her mention’a ayrı link oluştur. Video toplam izlenmesini mekana özel video izlenmesiymiş gibi etiketleme.
7. Unresolved/review kararını kalıcılaştır. Yanlış merge/split’i audit’li geri al; bağlı score/summary/creator projection güncelle. Google placeId ile internal venueId ayrı kalsın.

## Kabul kanıtı

Aynı marka/farklı şehir/şube testleri geçiyor; coğrafi kanıtsız ad auto-publish olmuyor; kaynak/expiry ayrımı var; yanlış eşleştirme geri alınabiliyor.

## Yapılmayacaklar

En yüksek arama sonucu = doğru şube; uydurma koordinat; Google response’u sınırsız kendi venue kataloğuna kopyalama; unresolved’ı haritaya rastgele pinleme.

## Birlikte kullanılacaklar

vp-evidence-extraction, vp-media-rights, vp-data-security, supabase-postgres-best-practices.

## Teslim kaydı

`docs/build-log.md` içine görev kimliği, okunan skill dosyası, uygulanan kural, değişen dosyalar, gerçekten çalıştırılan komutlar, sonuçlar ve kanıt yollarını ekle. Çalıştırılamayan testi `NOT_RUN`; erişim/hak/bütçe engelini `BLOCKED` yaz. Çözülemeyen konuya rağmen güvenli ve bağımsız işlere devam et; eksik entegrasyonu sahte success ile doldurma.
