---
name: vp-release-gates
description: "Milestone kapanışı, staging dağıtımı, mobil mağaza yayını veya production açılışı öncesinde kullan. Kanıtlı kabul, hak, güvenlik, maliyet ve geri alma kapılarını uygula."
---

# vp-release-gates

Bu skill Viral Places için bu paket kapsamında yazılmış proje talimatıdır. Dış sağlayıcının resmi skill'i değildir. Kullanmak, adını anmak değil adımlarını uygulayıp sonucu doğrulamaktır.

## Yetki ve kaynak

Ana kaynak [ana şartname](../../../VIRAL_PLACES_MASTER_BUILD_SPEC_TR.md), özellikle **25–27, 29–36** bölümleridir. [AGENTS.md](../../../AGENTS.md) kuralları geçerlidir. Resmi kütüphane API'leri sürümüne uygun güncel belgelerle doğrulanır; skill ücretli hesap, API erişimi veya production onayı sağlamaz.

## Girdiler

Milestone issue listesi; test komut/çıktıları; native build ve screenshot; hak/onay kayıtları; maliyet ölçümü; açık bug/risk; rollback planı.

## Uygulama adımları

1. Önce release kapsamını belirle: belge paketi, demo UI, staging dikey akış, kapalı pilot veya public production. Bir kapsamdaki başarı diğerine otomatik geçmez.
2. Checklist kutularını gerçek test/inceleme kanıtlarına bağla. Yalnız typecheck veya screenshot ile RLS/AI/doğru şube/video hakkı geçilmiş sayılmaz.
3. Kalite raporunda örnek sayısı, veri seti ve precision belirsizliği göster. Yeterli doğrulama yoksa auto-publish veya ilgili claim türü kapalı kalır.
4. Instagram erişim, içerik hakları, Google alan policy, budget ve mağaza gereksinimleri blokajlarını tek tek kontrol et. Kapalı özellik UI’da çalışıyormuş gibi pazarlanmasın.
5. Secrets/env, migration backward compatibility, backup restore ve kill switch kanıtını kontrol et. Staging’den production’a kişisel veri veya demo fixture taşınmasın.
6. Mobil binary, JS OTA runtime ve API sürümü uyumunu doğrula. Upload, store approval ve public rollout ayrı status. Canary/rollout/rollback sorumlusu ve durdurma eşiği belli olsun.
7. GO / NO-GO / LIMITED-GO kararını kapsam ve gerekçesiyle yaz. Production deploy/ücretli işlem için gereken insan yetkisini koru; izin yoksa publish yapma.

## Kabul kanıtı

Her kapanan milestone kanıtlı, her açık blocker görünür. Critical yetki/hak sorunu varken GO yok. Release sürümü/ortamı ve geri alma akışı kayıtlı; ürünün gerçekten yapılmış olduğu yalnız bölüm36 zinciriyle söylenebilir.

## Yapılmayacaklar

Mağaza onayını varsayma; doküman kontrolünü uygulama testi sanma; broken testleri ignore ederek yeşil rapor; eksik hukuki incelemeyi skill kullanımıyla tamamlandı sayma.

## Birlikte kullanılacaklar

vp-mobile-acceptance, vp-data-security, vp-cost-observability; eas-app-stores/eas-workflows/eas-update ve gerekiyorsa deployments-cicd.

## Teslim kaydı

`docs/build-log.md` içine görev kimliği, okunan skill dosyası, uygulanan kural, değişen dosyalar, gerçekten çalıştırılan komutlar, sonuçlar ve kanıt yollarını ekle. Çalıştırılamayan testi `NOT_RUN`; erişim/hak/bütçe engelini `BLOCKED` yaz. Çözülemeyen konuya rağmen güvenli ve bağımsız işlere devam et; eksik entegrasyonu sahte success ile doldurma.
