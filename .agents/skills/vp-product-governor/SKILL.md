---
name: vp-product-governor
description: "Viral Places üzerinde her geliştirme, kapsam veya mimari kararı öncesinde kullan. Şartname, referanslar, bağımlılıklar, gerçek test kanıtı ve ürün sınırlarını uygula."
---

# vp-product-governor

Bu skill Viral Places için bu paket kapsamında yazılmış proje talimatıdır. Dış sağlayıcının resmi skill'i değildir. Kullanmak, adını anmak değil adımlarını uygulayıp sonucu doğrulamaktır.

## Yetki ve kaynak

Ana kaynak [ana şartname](../../../VIRAL_PLACES_MASTER_BUILD_SPEC_TR.md), özellikle **1–5, 9–11, 29, 32–36** bölümleridir. [AGENTS.md](../../../AGENTS.md) kuralları geçerlidir. Resmi kütüphane API'leri sürümüne uygun güncel belgelerle doğrulanır; skill ücretli hesap, API erişimi veya production onayı sağlamaz.

## Girdiler

Görev/issue, mevcut repo ve git durumu, ana şartname, karar günlüğü, mevcut test raporları.

## Uygulama adımları

1. Önce mevcut repoyu ve git durumunu incele. Çalışan projeyi varsayım üzerine silme; eksik bir dependency tüm projeyi yeniden scaffold etme gerekçesi değildir.
2. Görevi şartnamedeki milestone ve kabul kriterlerine bağla. Kullanıcı kararı, teknik öneri, hedef, varsayım ve gerçek sağlayıcı kanıtını ayır.
3. Gerekli yerel ve resmi skill’leri seç; dosyalarını gerçekten oku. Eksik skill’i UNAVAILABLE, yalnız kataloğu bilinen skill’i DISCOVERED olarak kaydet.
4. En küçük çalışan dikey parçayı seç. Önce contract/domain; ardından UI veya provider uygulaması. Paralel ajan varsa dosya ve schema sahipliğini netleştir.
5. Canlı anahtar, hak veya bütçe eksikliğini ilgili göreve BLOCKED yaz; bağımsız sentetik test ve UI işlerine devam et. Gerçekten eksik olmayan bir bilgiyi tekrar kullanıcıdan isteme.
6. Büyük teknoloji/kapsam değişikliğinde ADR yaz. Önce sorunu, alternatifleri, geçiş ve lisans etkisini göster; ürün kararını sessiz değiştirme.
7. Teslimde değişen dosya, kullanılan skill path, komut ve gerçek çıktıyı build log’a kaydet. Başlamamış testi başarılı diye yazma.

## Kabul kanıtı

Her issue’nun şartname bölümü, seçilmiş skill’leri, doğrulanabilir kabul kriteri ve gerçek durumu vardır. Demo/production ayrımı UI ve raporda görünür. Proje adı geçici kalır.

## Yapılmayacaklar

Yalnız mockup üretip ürün bitti deme; kullanıcı onayı olmadan paid service açma/production deploy yapma; rakiplerin doğrulanmamış altyapısını kanıt sayma.

## Birlikte kullanılacaklar

Görevin vp-* skill’leri; mobilde expo-overview; DB’de Supabase; web’de Next.js. Hepsini gereksiz yere aynı anda yükleme.

## Teslim kaydı

`docs/build-log.md` içine görev kimliği, okunan skill dosyası, uygulanan kural, değişen dosyalar, gerçekten çalıştırılan komutlar, sonuçlar ve kanıt yollarını ekle. Çalıştırılamayan testi `NOT_RUN`; erişim/hak/bütçe engelini `BLOCKED` yaz. Çözülemeyen konuya rağmen güvenli ve bağımsız işlere devam et; eksik entegrasyonu sahte success ile doldurma.
