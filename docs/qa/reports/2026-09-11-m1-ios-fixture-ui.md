# M1 kabul raporu — iOS fixture UI (Expo Go)

**Tarih:** 11 Eylül 2026 · **Ortam:** macOS, Xcode 26.6, iOS 26.5 simülatör `VP iPhone 17` (402×874 pt), Expo Go 57.0.9, Metro dev bundle · **Veri modu:** DEMO (sentetik fixture) · **Build ID:** dev bundle, native binary yok (Expo Go)

## Kapsam ve sınır

Bu rapor **yalnız fixture UI** kabulüdür (§29 M1: "API anahtarı yoksa gerçek harita spike'ı BLOCKED, yalnız fixture UI VERIFIED olabilir"). Google Maps SDK, Supabase, sağlayıcı ve AI entegrasyonları BLOCKED; harita yüzeyi ADR-014 DEMO canvas'tır. Android test edilmedi (SDK yok). Maestro kurulu değil; akışlar elle (simülatör MCP tap/swipe) yürütüldü ve `flow-recording.mov` ile kaydedildi.

## Yürütülen akışlar (iOS)

| # | Akış | Sonuç | Kanıt |
|---|---|---|---|
| 1 | Uygulama açılışı → Keşfet harita, 7 DEMO pin, kategori chip'leri, kapsam notu, DEMO rozetleri | GEÇTİ | 01-explore-map.png |
| 2 | Pin seç → alt kart (ad, kategori, skor rozeti, tazelik, tek Kaydet) | GEÇTİ | 02, 14, 15 |
| 3 | Kaydet → formSheet → yeni koleksiyon oluştur → "Kaydedildi" durumu | GEÇTİ | 03, 04 |
| 4 | Kart gövdesi → mekan detayı (hero yer tutucu, trend kartı, videolar, AI özeti, aile bilgisi, sabit CTA) | GEÇTİ | 05, 06 |
| 5 | "Gününe Ekle" → formSheet → yeni plan oluştur ve ekle → onay | GEÇTİ | 07, 08 |
| 6 | Video kartındaki creator → creator profili → Takip Et → "Takip Ediliyor" | GEÇTİ | 09, 10 |
| 7 | Takip Ettiklerin sekmesi: takip edilen creator ve yeni yerleri | GEÇTİ | 11-tab-following |
| 8 | Kaydedilenler: koleksiyon listesi; Planlar segmenti; plan detayı (rev 2, sıra kontrolleri, yol tarifi) | GEÇTİ | 11-tab-saved, 12, 13 |
| 9 | Profil: tercihler, veri modu DEMO, BLOCKED entegrasyon listesi | GEÇTİ | 11-tab-profile |
| 10 | Geri navigasyon → Keşfet kamera/seçim durumu korunuyor (§7.1) | GEÇTİ | flow-recording.mov |
| 11 | Dynamic Type XXXL: metin sarıyor, CTA erişilebilir, kesilme yok (DEMO notu 2 satırda … ile biter) | GEÇTİ | 16, 17 |
| 12 | Uygulamayı öldür → yeniden aç: koleksiyon/takip/plan kalıcı (expo-sqlite kv-store) | GEÇTİ | 18-saved-after-relaunch.png |
| 13 | Stale/insufficient/trending skor durumları farklı pinlerde doğru etiketlerle | GEÇTİ | 01, 14, 15, 11-tab-following |

NOT_RUN: Android; VoiceOver gerçek okuma (etiketler kodda mevcut, ekran okuyucu ile dinlenmedi); azaltılmış hareket; çevrimdışı; gerçek Google harita jestleri; Maestro E2E; release build performans ölçümü (Expo Go dev bundle'da 60 fps iddiası yapılmıyor).

## Tasarım incelemesi (§6.5, 6 boyut × 0–5)

Referans: `design/references/01-map.png`, `02-place-detail.png`, `03-creator-profile.png`. Aynı fixture, aynı viewport.

| Boyut | Puan | Not |
|---|---:|---|
| Hiyerarşi | 4 | Başlık → kategori → trend → videolar → özet sırası referansla aynı; gerçek fotoğraf olmadığı için hero zayıf (hak politikası gereği kasıtlı). |
| Yüzey/boşluk | 5 | Beyaz kartlar, açık gri taban, 4'lük ızgara, sheet 28 / kart 24-16 / chip 999. |
| Tipografi | 4 | Sistem fontu, 24/19/15/12 ramp; XXXL'de sarma doğru. |
| Fotoğraf/video oranı | 3 | Referansta gerçek video/foto var; burada hak-duyarlı yer tutucu (unavailable/link_only). Lisanslı medya gelene kadar kasıtlı fark. |
| Chip/pin | 5 | Kategori renk + ikon + metin; trend halkası ek sinyal; skor yoksa etiket yok. |
| CTA ve genel his | 4 | Lacivert birincil, ikincil beyaz; tek Kaydet; sakin ve ferah. Google harita dokusu yok (BLOCKED). |
| **Toplam** | **25/30** | Hedef ≥26; eksik puan hero/medya oranından (hak ve anahtar blokajı). Görsel dil aynı aile. |

## appllama-app-design-skill ön uçuş sayımı

Aksan tonu: 1 (lacivert `primaryAction`; kategori renkleri şartname §6.3 gereği anlamsal, dekoratif değil). Köşe yarıçapları: token ölçeğinden (999/28/24/16). Emoji ikon: 0. Gerekçesiz gradient: 0. Aynı niyet için farklı etiket: 0. Haptik: kaydet/takip/chip seçiminde tek dokunuş, görselle birlikte. Koyu tema: ürün kararı gereği yok (§6.2 "koyu tema varsayılanı yok"); Appllama'nın "iki tema" yasası ürün sahibinin açık kararıyla ertelendi. Appllama MCP bağlı olmadığından referans-ekran araştırması yapılmadı (UNAVAILABLE).

## Bulunan ve düzeltilen kusurlar

1. Başlık alanı kuzey pinleri örtüyordu → harita izdüşümüne `topInset`.
2. Stale rozet uzun etiketi mekan adını kesiyordu → rozet meta satırına alındı, etiket kısaltıldı.
3. DEMO harita notu pinlerin üstüne biniyordu → izdüşüm alt rezerv.
4. Bağlantı renkleri mavi (kategori rengi) idi → tek aksan (lacivert).
5. İlk viewport sorgusu tetiklenmiyordu (bbox items'a bağlıydı) → kamera merkezli varsayılan bbox.

## Açık kusurlar

- Expo Go'nun kendi dev-menü düğmesi sağ üstteki Kaydet/DEMO rozetini kapatıyor (uygulama bileşeni değil; dev build'de yok).
- Cihangir/Beyoğlu pinleri gerçek coğrafya nedeniyle üst üste; kümeleme (§7.2) M4/M5 kapsamında.
- Mini harita (creator) sabit; pan/zoom yok (DEMO yüzey).

## Ek — Gerçek Google Maps (iOS dev build) ve Apple native bileşen yükseltmesi (11 Eylül 2026, 16:00–16:20)

**Ortam:** `npx expo run:ios` Debug development client, `VP iPhone 17` iOS 26.5, Metro dev bundle. Anahtar: ürün sahibinin Maps SDK for iOS anahtarı (`apps/mobile/.env`, gitignore).

| # | Kontrol | Sonuç | Kanıt |
|---|---|---|---|
| 14 | Gerçek Google haritası, açık gri stil, pinler kara üzerinde, Google atfı görünür, anahtar hatası yok | GEÇTİ | 20-devbuild-google-map.png |
| 15 | Marker basma → alt kart; `mapPadding` ile atıf kartın üstünde | GEÇTİ (onMarkerPress düzeltmesinden sonra) | 21-devbuild-pin-selected.png |
| 16 | NativeTabs (UITabBar, iOS 26 Liquid Glass), glass arama çubuğu, tab bar payı ile atıf/Yakınımda düğmesi görünür | GEÇTİ | 22-native-tabs-explore.png |
| 17 | Native large-title UINavigationBar: Kaydedilenler / Takip Ettiklerin / Profil | GEÇTİ | 23-native-*.png |
| 18 | UISegmentedControl (@expo/ui community) Koleksiyonlar/Planlar | GEÇTİ | 23-native-saved.png |
| 19 | Alt kart 1:1 sürükleme + hız devri + momentum projeksiyonu ile kapatma | GEÇTİ (aşağı fırlatma kartı kapattı) | manuel |
| 20 | Mekan detayı yüzen glass düğmeler (geri/paylaş/kaydet) | GEÇTİ | 24-devbuild-place-detail-glass.png |
| 21 | @expo/ui SwiftUI Host (universal List/ListItem ve swift-ui Form/Section) | BAŞARISIZ — native log "HostView FieldInvalidTypeException"; Profil HIG inset-grouped özel satırlara döndürüldü | build-log |
| 22 | Link.Preview / Link.Menu (UIContextMenu, peek) liste satırlarında: uzun basma → native peek önizleme + Kaydet / Gününe Ekle menüsü | GEÇTİ | 26-link-preview-context-menu.png |
| 23 | Liste modu satır düzeni (Link.Trigger sarmalayıcı sonrası bozulmuştu, statik Pressable + iç satır View ile düzeltildi) | GEÇTİ | 25-list-mode-link-rows.png |

**Bulgular:** Google iOS'ta marker basması `Marker.onPress` ile gelmedi; `MapView.onMarkerPress` + `identifier` ile çözüldü. Yüzen tab bar harita altına uzandığından atıf ve düğmeler için 58 pt + safe-area payı eklendi. Reanimated layout animasyonu ile `transform` çakışması uyarısı, sarmalayıcı `Animated.View` ile giderildi.

**Kapsam notu:** Bu doğrulama iOS simülatör Debug build'idir; release build fps ölçümü ve gerçek cihaz testi yapılmadı. Android anahtarı yok → Android DEMO yüzeyde kalır.

## Ek — Appllama araştırması ve HIG uygulaması (11 Eylül 2026, akşam)

| # | Kontrol | Sonuç | Kanıt |
|---|---|---|---|
| 24 | Harita üstünde nonmodal sheet: tutamaç, peek/half detent, sürükleme, fırlatma, grabber dokunuşu | GEÇTİ (sürükleme/dokunma manuel) | 27-explore-map-sheet.png |
| 25 | "Bu haritada yükselenler" şeridi: yükselen → skor sırası, skorsuz mekanlar "Veri birikiyor" | GEÇTİ | 27 |
| 26 | Şeritten seçim → pin vurgusu + önizleme kartı; Google logosu kartın üstünde | GEÇTİ | 28-explore-trending-selected.png |
| 27 | Detay: creator avatar yığını, "Kaynaklar · N" pili (kaynaklara kaydırır), karusel noktaları, özet maddelerinde @handle | GEÇTİ (ilk sürümde çift sayaç ve nokta/başlık çakışması düzeltildi) | 29-place-detail-references.png |
