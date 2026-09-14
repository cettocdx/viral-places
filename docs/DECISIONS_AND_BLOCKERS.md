# Kararlar ve canlı üretim bağımlılıkları

Kaynak: [ana şartname bölüm33](../VIRAL_PLACES_MASTER_BUILD_SPEC_TR.md#s33). Durumlar başlangıç kaydıdır; kullanıcı hesabına girilip kontrol edilmiş değildir.

## Kilit ürün kararları

Harita-first mobil; üç referansın beyaz/gri premium dili; kaynak creator videoları; şeffaf viral endeks; kaydet/follow/plan; arka planda AI; global veri modeli ve kademeli kapsam. Creator takibi yalnız uygulama içinde. Marka adı kesin değil; çalışma adı Viral Places.

## Teknik uygulama önerileri

Expo/RN/TypeScript; Google provider iki platformda; Next.js admin/API; Supabase/PostGIS/Auth; Trigger.dev tek job platformu; Apify ilk adapter; Ensemble alternatif; sürümlü AI/kanıt pipeline. Bunlar araştırılmış seçeneklere dayalı proje mimarisidir, kullanıcı tarafından önceden satın alınmış servisler değildir.

## Bloker matrisi

| Bağımlılık | Başlangıç durumu | Bloke ettiği | Bloke etmediği |
|---|---|---|---|
| Ürün adı/domain | Kesinleşmedi | Marka/mağaza final metadata | Çalışma adlı geliştirme |
| Google SDK/Places billing+keys | Bu teslimde erişim test edilmedi | Gerçek Maps/Places smoke | UI fixture ve domain test |
| İçerik/metadata/AI/gösterim hakları | Onay kaydı gerekli | İlgili canlı işlem | Sentetik/izinli örnek geliştirme |
| Apify/Ensemble hesabı | Canlı run yok (12.09: webhook ucu + inbox/outbox + normalize/dedupe saf modülleri hazır ve test edildi) | Veri erişim/maliyet doğrulama, gerçek payload replay | Adapter fixture test, webhook idempotency testi |
| AI sağlayıcı/model | Hesap/eval yok (12.09: hak+bütçe kapılı çıkarım planlayıcısı ve §16.2 eşleştirici saf modül olarak hazır) | Gerçek inference, holdout eval | Prompt/şema/test harness, planlayıcı/eşleştirici birim testi |
| Supabase projesi | LIMITED-OPEN: yerel stack (11.09); 12.09: 6 migration, RLS 23 pgTAP, /api/v1 entegrasyon 17 test — bulut projesi yok | Bulut DB/Auth, mobil OTP girişi | Yerel API + mobil canlı istemci geliştirme |
| Üretim bütçesi | Null; onay gerekli | Ücretli otomatik işler | Doküman/UI/unit test |
| Instagram izin/endpoint | Ayrıntılı doğrulama açık | Instagram production | TikTok/creator lisanslı pilot |
| Mağaza/signing hesapları | Bu teslimde kontrol edilmedi | TestFlight/Play/public yayın | Local simulator/dev çalışması |
| Native test cihazları | Test yapılmadı | Native VERIFIED sonucu | Web admin veya statik test |
| Privacy/legal/support | İşletmeye göre hazırlanacak | Public yayın | Güvenli kapalı geliştirme |
| Figma | Opsiyonel | Yalnız Figma görevleri | PNG'den native uygulama |
| Çok-instance oran sınırı (edge/KV) | Karar yok (12.09) | Public API'nin çok instance'lı dağıtımı | Süreç içi token-bucket ile tek instance/dev |
| Trigger.dev (outbox tüketicisi) | Kurulmadı (12.09) | Webhook sonrası işleme; outbox satırları birikir | Webhook kabulü, inbox/outbox kaydı |

## Açılma kanıtı

Her blokaj için kontrol eden, tarih, ortam, sözleşme/hesap referansı, yapılan sınırlı test ve kalan kapsam yazılır. API anahtarının mevcut olması içerik hakkının veya bütçenin de onaylı olduğu anlamına gelmez.

## Durum değiştirme formatı

```text
ID:
Önceki/yeni durum:
Kanıt:
Yetkili/onaylayan:
Kapsam ve bitiş tarihi:
İzin verilen işlem:
Hâlâ kapalı kalan işlem:
```


## Durum kontrolü — 11 Eylül 2026 (M0/M1 tesliminde, geliştirme makinesi)

Kontrol eden: kodlama ajanı. Ortam: kullanıcı macOS makinesi; ortam değişkenleri ve `~/.agents/skills` incelendi. Hiçbir hesaba giriş yapılmadı; ücretli servis açılmadı.

| Bağımlılık | Kontrol sonucu | Etki |
|---|---|---|
| Google Maps SDK anahtarları | `GOOGLE_MAPS_IOS_KEY`/`GOOGLE_MAPS_ANDROID_KEY` yok | **BLOCKED**: gerçek harita spike'ı; ADR-014 DEMO yüzeyle fixture UI VERIFIED |
| Supabase projesi | Anahtar/proje yok | **BLOCKED**: M2 DB/Auth; misafir yerel kütüphane çalışıyor |
| Apify/EnsembleData | Hesap yok | **BLOCKED**: M3; adapter yalnız arayüz düzeyinde |
| AI sağlayıcı/model | Anahtar yok | **BLOCKED**: özet/çıkarım DEMO fixture etiketli |
| Instagram | Doğrulanmadı | Kapalı; UI'da "çalışıyor" gösterilmiyor |
| Üretim bütçesi | Null | Canlı iş yok |
| Android SDK/emülatör | Makinede yok | **BLOCKED**: Android doğrulaması NOT_RUN |
| iOS simülatör | iOS 26.5, `VP iPhone 17` oluşturuldu; Expo Go | Fixture UI iOS'ta doğrulanabilir; native dev build alınmadı |
| Maestro | Kurulu değil | Native E2E NOT_RUN |
| Figma | Kullanılmadı | Engel değil |

## Durum değişikliği — Google Maps SDK (iOS) — 11 Eylül 2026

```text
ID:                       BLK-GOOGLE-MAPS-IOS
Önceki/yeni durum:        BLOCKED → LIMITED-OPEN (iOS geliştirme)
Kanıt:                    Ürün sahibi Google Cloud'da Maps SDK for iOS anahtarı oluşturdu; apps/mobile/.env (gitignore) içinde. `npx expo run:ios` development build başarılı (Debug, VP iPhone 17, iOS 26.5); gerçek Google haritası, açık gri stil, 7 sentetik pin ve Google atfı ekranda: docs/qa/screenshots/2026-09-11-ios-expo-go/20-devbuild-google-map.png ve devamı.
Yetkili/onaylayan:        Ürün sahibi (anahtar sahibi)
Kapsam ve bitiş tarihi:   Yalnız iOS geliştirme/simülatör; anahtarın bundle kısıtı ve faturalandırma ürün sahibince doğrulanacak. Süresiz değil; üretim anahtarı ayrı iş.
İzin verilen işlem:       iOS'ta PROVIDER_GOOGLE ile harita render, pin/kamera/jest testleri, attribution kontrolü.
Hâlâ kapalı kalan işlem:  Android anahtarı (yok → Android'de DEMO yüzey); Places API (backend anahtarı, M3); üretim anahtar kısıtları ve kota izleme.
Not:                      İlk verilen anahtar sohbete yapıştırıldığı için açığa çıkmış kabul edildi; ürün sahibine iptal/yenileme önerildi. Ajan anahtar değerini hiç okumadı/yazmadı; kullanıcı .env.example'a yazmıştı, dosya .env olarak taşındı, örnek dosya boş haline getirildi.
```

## Durum değişikliği — Supabase — 11 Eylül 2026

```text
ID:                       BLK-SUPABASE
Önceki/yeni durum:        BLOCKED → LIMITED-OPEN (yerel)
Kanıt:                    Yerel Supabase stack (Docker) ayakta; 4 migration + demo seed; pgTAP RLS negatif testleri 17/17; advisors temiz (docs/build-log.md VP-006).
Yetkili/onaylayan:        Kodlama ajanı (yerel geliştirme; hesap/ücret yok)
Kapsam ve bitiş tarihi:   Yalnız yerel geliştirme/test. Bulut projesi ürün sahibi hesabı ister.
İzin verilen işlem:       Şema/RLS/migration geliştirme ve testi; mobil auth entegrasyonu için yerel URL/publishable key.
Hâlâ kapalı kalan işlem:  Bulut proje, staging/production, gerçek kullanıcı verisi, e-posta sağlayıcısı.
```


## Durum kontrolü — 13 Eylül 2026 (motor teslimi)

| Bağımlılık | Kontrol sonucu | Etki |
|---|---|---|
| Sağlayıcı seçimi | Araştırma tamam ([docs/research/social-data-access.md](research/social-data-access.md)): birincil **ScrapeCreators** (TikTok+IG, poi/konum, transkript, $1,88/1k kredi), yedek **Apify**, üçüncü EnsembleData; Instagram resmi **Business Discovery** (App Review gerekli, konum yok) | Adaptörler kodlandı; **hesap/anahtar yok → canlı run NOT_RUN** |
| ScrapeCreators / Apify / EnsembleData hesabı | Yok | BLOCKED: gerçek payload replay, fiyat/birim doğrulaması, contract spike (§13.1) |
| Instagram Graph (Business Discovery) | Kendi IG profesyonel hesabı + Facebook Page + App Review yok | BLOCKED: resmi Instagram akışı; adaptör hazır |
| Google Places API (New) anahtarı + birim fiyat | Yok (`GOOGLE_PLACES_API_KEY`, `PRICE_GOOGLE_PLACES_USD_PER_1K`) | BLOCKED: aday araması; kendi kayıtlarla eşleştirme çalışır |
| AI sağlayıcı (Anthropic) | `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` yok; SDK kuruldu, çıkarım/özet kodu sahte model ile test edildi | BLOCKED: gerçek inference ve eval; worker `ai_provider_unconfigured` ile atlar |
| Bütçe onayı | `config/pipeline-policy.example.json` bütçe alanları null; `approvedBy` null | Ücretli iş açılmaz (bütçe kapısı testli) |
| Docker / yerel Supabase | Docker.app harici diskte, takılı değil | **NOT_RUN:** yeni migration, pgTAP, worker DB koşusu, admin entegrasyon testleri |
| Trigger.dev | Kurulmadı; Node outbox döngüsü aynı iş sözleşmesiyle çalışır | Engel değil (tek instance) |
| Hukuk (GDPR/KVKK/ToS) | Araştırma özeti yazıldı; danışman onayı yok | `rights_policies` kaydı onaylanmadan canlı creator izlemesi açılmaz (`admin_upsert_monitored_creator` reddeder) |
