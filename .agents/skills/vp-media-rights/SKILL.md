---
name: vp-media-rights
description: "Sosyal kaynak metadata/medyasını alma, AI ile işleme, gösterme, cache veya silme görevlerinde kullan. Teknik erişimi kullanım hakkından ayır ve işlem bazında deny-by-default uygula."
---

# vp-media-rights

Bu skill Viral Places için bu paket kapsamında yazılmış proje talimatıdır. Dış sağlayıcının resmi skill'i değildir. Kullanmak, adını anmak değil adımlarını uygulayıp sonucu doğrulamaktır.

## Yetki ve kaynak

Ana kaynak [ana şartname](../../../VIRAL_PLACES_MASTER_BUILD_SPEC_TR.md), özellikle **3, 14–16, 20, 23–24, 30–31** bölümleridir. [AGENTS.md](../../../AGENTS.md) kuralları geçerlidir. Resmi kütüphane API'leri sürümüne uygun güncel belgelerle doğrulanır; skill ücretli hesap, API erişimi veya production onayı sağlamaz.

## Girdiler

config/provider-rights.template.json; gerçek onay kaydı; platform/ülke kapsamı; kaynak ve medya kimliği; işlem amacı; retention şartı.

## Uygulama adımları

1. İşlem türünü açık seç: metadata collect, metadata AI, metrics store, media download, media AI, summary, thumbnail, embed, rehost, creator profile, source link veya derived retention.
2. İlgili hakkın onay/dayanak/süre/ülke ve revocation durumunu kontrol et. Unknown = deny. Sağlayıcı download URL’si veya ödenmiş fatura hak kaydı sayılmaz.
3. Gösterimi official_embed/licensed_native/link_only/unavailable olarak policy’den türet. Üçüncü taraf atıf ve kontrollerini gizleme; filigran kaldırma ya da izinsiz kırpma yok.
4. Model aktarımı için metadata ve video haklarını ayrı kontrol et. Video gönderilemiyorsa yalnız ayrıca izinli metadata yolu çalışabilir; izin yokken sessizce transcript çıkarma.
5. Saklanan her varlıkta kaynağa bağlı expiresAt ve policyVersion tut. Geçici obje private; süresi kısıtlı erişim; uzak AI sağlayıcısındaki kopyanın yaşam döngüsü ayrı izlenir.
6. Takedown/expiry olayı public projection, thumbnail, playable URL, kanıt, summary ve score bağımlılıklarını güncellesin. CDN invalidation ve uzak dosya temizliği doğrulansın.
7. Google place ID istisnasını bütün Places response’a yayma. Google cache alanlarıyla kendi izinli yer verisini farklı provenance/expiry ile yönet.

## Kabul kanıtı

Aynı indirilebilir medyada hakkı olmayan işlem reddedilir; süresi geçen örnek erişilemez; source kaldırılınca türevler policy’ye göre temizlenir. Link-only durumunda UI sahte player göstermiyor.

## Yapılmayacaklar

Halka açık = sınırsız serbest kabulü; yalnız bir isLicensed boolean’ı; hak belirsizken prod işleme; Google reviews’u varsayılan AI corpus’a ekleme.

## Birlikte kullanılacaklar

vp-source-ingestion, vp-evidence-extraction, vp-data-security, vp-release-gates. Hukuki inceleme yerine geçtiğini iddia etme.

## Teslim kaydı

`docs/build-log.md` içine görev kimliği, okunan skill dosyası, uygulanan kural, değişen dosyalar, gerçekten çalıştırılan komutlar, sonuçlar ve kanıt yollarını ekle. Çalıştırılamayan testi `NOT_RUN`; erişim/hak/bütçe engelini `BLOCKED` yaz. Çözülemeyen konuya rağmen güvenli ve bağımsız işlere devam et; eksik entegrasyonu sahte success ile doldurma.
