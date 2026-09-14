---
name: vp-data-security
description: "DB, Auth, RLS, API, secrets, URL import veya kişisel veri işleme değiştiğinde kullan. Sahiplik, minimum yetki, alan kaynakları, saldırı sınırları ve negatif testleri uygula."
---

# vp-data-security

Bu skill Viral Places için bu paket kapsamında yazılmış proje talimatıdır. Dış sağlayıcının resmi skill'i değildir. Kullanmak, adını anmak değil adımlarını uygulayıp sonucu doğrulamaktır.

## Yetki ve kaynak

Ana kaynak [ana şartname](../../../VIRAL_PLACES_MASTER_BUILD_SPEC_TR.md), özellikle **18–20, 23–25, 30–31** bölümleridir. [AGENTS.md](../../../AGENTS.md) kuralları geçerlidir. Resmi kütüphane API'leri sürümüne uygun güncel belgelerle doğrulanır; skill ücretli hesap, API erişimi veya production onayı sağlamaz.

## Girdiler

Schema/migration; API contract; aktör-yetki matrisi; threat model; env envanteri; test kullanıcıları; veri retention politikası.

## Uygulama adımları

1. Public/private/geo şema sınırını ve grants’i incele. Exposed tabloların RLS’i, ownership USING/WITH CHECK ve ilişkili collection/plan sahibi ayrı ayrı doğrulansın.
2. View privilege/security invoker durumunu kontrol et. SECURITY DEFINER’ı permission hatasını örtmek için ekleme. User metadata admin yetkisi sayılmasın.
3. Client’ta service/secret anahtar yok; worker ve user yetkileri farklı. JWT’yi yalnız decode etme; doğrula. Log ve error payload token/konum/ham medya içermesin.
4. URL fetch’te izinli HTTPS domain, DNS/IP ve redirect kontrolü; private/link-local/loopback engeli. Medya süre/boyut/MIME ve iş timeouts uygulansın.
5. Ücretli endpoint’lerde idempotency, per-user quota, body limit ve bounded work; webhook secret/replay/run doğrulaması. Admin MFA ve kritik audit şartları.
6. Exact kullanıcı konumu ve özel plan verisini asgari tut. Logout/hesap silme token/local cache/device token temizliğini ve session davranışını test et.
7. Local/staging migration uygulaması ve A/B/misafir/reviewer/worker negatif testlerini çalıştır. Güvenlik danışman çıktısını değerlendir; sadece danışmanın uyarı vermemesi yeterli kanıt değildir.

## Kabul kanıtı

A kullanıcısı B verisini okuyamıyor/değiştiremiyor; public rol private kaynağa erişemiyor; worker endpoint user JWT kabul etmiyor; expired media erişilemiyor; migration temiz DB’de tekrar kurulabiliyor.

## Yapılmayacaklar

Auth var diye bütün tablolara erişim; public service key; keyfi URL indirme; sıfır testle güvenli iddiası; production’da onaysız yıkıcı migration.

## Birlikte kullanılacaklar

supabase, supabase-postgres-best-practices, vp-media-rights, vp-release-gates; Next.js için güncel server/auth belgeleri.

## Teslim kaydı

`docs/build-log.md` içine görev kimliği, okunan skill dosyası, uygulanan kural, değişen dosyalar, gerçekten çalıştırılan komutlar, sonuçlar ve kanıt yollarını ekle. Çalıştırılamayan testi `NOT_RUN`; erişim/hak/bütçe engelini `BLOCKED` yaz. Çözülemeyen konuya rağmen güvenli ve bağımsız işlere devam et; eksik entegrasyonu sahte success ile doldurma.
