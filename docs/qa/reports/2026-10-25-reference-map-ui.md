# 25 Ekim 2026 — Referans odaklı harita UI kontrolü

Kapsam: M5 kullanıcı deneyimi, şartname §6–8/21/26; [ADR-019](../../adr/ADR-019-reference-map-ui.md).

## Ortam

Yerel main `561ab55` üzerine çalışma kopyası; Expo SDK 57 / Expo Go; iPhone 17 simülatör, iOS 26.5. Development sunucusu localhost:8082, DEMO istemcisi. Özel development/release binary üretilmedi. Native screenshotlar CUA ile alındı; web önizlemesi kullanılmadı. Sistem metin boyutu `large` ve `extra-extra-extra-large` kontrol edildi, ardından `large` geri yüklendi.

## Gerçek sonuçlar

| Kontrol | Sonuç |
|---|---|
| `pnpm test` | PASS: 150 birim testi, 11 çalışma paketi |
| `pnpm typecheck` | PASS: tüm çalışma paketleri |
| Son mobil değişikliklerinden sonra `pnpm --filter @viral-places/mobile test` | PASS: 18 test |
| Son mobil değişikliklerinden sonra mobil typecheck | PASS |
| `node scripts/sync-design-tokens.mjs --check` | PASS |
| `git diff --check` | PASS |
| Doküman paket kontrolü | Güncel sonuç: [PACK_VALIDATION](../../PACK_VALIDATION.md) |
| Küme → yakın görünüm | Native simülatörde çalıştırıldı; 7/4/2 kümeler ayrıştı |
| Pin / keşif kartı → mekan önizlemesi | Native simülatörde çalıştırıldı; seçili halka ve kart güncellendi |
| Önizleme → kaydet → koleksiyon | Native simülatörde `UI Deneme` oluşturuldu; `Kaydedildi` durumu görüldü |
| Önizleme → mekan detayı → geri | Native simülatörde çalıştırıldı |
| Arama + kategori | `Karaköy` araması iki sonuç gösterdi; Yemek filtresi boş duruma geçti |
| Boş durum → filtreleri temizle | Native simülatörde haritaya dönüldü |
| Büyük yazı | Kart metni ve aksiyonlar erişilebilir kaldı; kamera pinin kart altında kalmasını önleyecek şekilde düzeltildi |

Vite, mevcut CommonJS/ESM config biçimi hakkında gelecek sürüm uyumluluk uyarısı veriyor; testler geçiyor.

## Kanıt

- [Standart yazıda seçili mekan](../screenshots/2026-10-25-map-ui/ui-map-selected.png)
- [Büyük yazı](../screenshots/2026-10-25-map-ui/ui-large-text.png)
- [Boş durum](../screenshots/2026-10-25-map-ui/ui-empty-state.png)

İlk üç PNG görsel olarak açıldı. Yeni harita yönü kullanıcı tarafından verilen videodan gelir; ilk PNG'lerin hiyerarşi, kaydırılabilir içerik, sade yüzey ve gerçek veri ayrımı korunur. Medya boyutu/snapshot kalitesi gerçek fotoğrafla değerlendirilmediği için 6×5 tam görsel kabul puanı veya release kabulü verilmedi.

## Sınırlar ve NOT_RUN

Canlı `https://viral-places-api.vercel.app/api/v1/health` yanıtı OK. `/api/v1/cities` ve geçerli bbox ile `/api/v1/map/places` yanıtları `INTERNAL / Unexpected error`; bu nedenle gerçek mekan görselleriyle görsel kontrol BLOCKED. Önizleme açık DEMO etiketli; kategori yedekleri gerçek kaynak fotoğrafı gibi sunulmuyor.

Android native, dar cihaz, VoiceOver/TalkBack, cihazda reduce-motion, offline/izin senaryoları, gerçek fotoğrafın yüklenmesi/hatası, release performansı ve mağaza/OTA dağıtımı NOT_RUN. Worker, veri toplama ve ücretli sağlayıcı koşusu çalıştırılmadı. Kaynak/özet/skor veya production verisi değiştirilmedi.

## Okunan rehberler

- `.agents/skills/vp-product-governor/SKILL.md`
- `.agents/skills/vp-design-fidelity/SKILL.md`
- `.agents/skills/vp-mobile-acceptance/SKILL.md`
- `.agents/skills/vp-media-rights/SKILL.md`
- Expo resmi deposu, `d5caf7fdf8b4854351f05841a7e315ac87ad7d24`: `plugins/expo/skills/{expo-overview,expo-design-system,expo-native-ui,expo-ui,expo-animation}/SKILL.md`; overview `references/launch-without-dev-menu.md`. Uzaktan okunmuştur, kurulum yapılmamıştır.
- Kurulu Vercel `react-best-practices/SKILL.md`: hook sırası/bağımlılıkları, render maliyeti, typed props, erişilebilir aksiyonlar kontrol edildi. Yeni state/data sistemi veya kütüphane eklenmedi.

Paket kontrolünün ilk koşusunda değişen token/build-log dosyalarının eski manifest hash’leri eşleşmedi (511 PASS / 2 FAIL). Paket manifesti güncel doküman ve QA kanıtları için yeniden hesaplandı; doğrulama kontrolleri kapatılmadı.
