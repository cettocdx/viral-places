# QA — Harita pinleri: kümeleme, kısa skor rozeti, aynı-nokta seçim listesi (VP-014) — 14 Eylül 2026

**Build:** Debug dev client `dev.viralplaces.mobile` (13.09 native build) + Metro dev bundle, `VP iPhone 17` iOS 26.5 simülatör. **Veri modu:** DEMO fixture (8 sentetik mekan; `demo-venue-008` Karaköy kafeyle aynı koordinat). **Harita:** gerçek Google Maps SDK (iOS anahtarı, ADR-014 LIMITED-OPEN). Android ve Maestro NOT_RUN.

## Kapsam ve sınır

Yalnız Keşfet haritasının pin davranışı (§7.2). Referans `01-map.png`'deki her pinde uzun "Viral Skoru" etiketi bilinçli olarak uygulanmadı; şartname §7.2 "her pine uzun etiket çizip haritayı kapatma; kısa skor rozeti; yoğun alanda küme; aynı koordinatta seçim listesi" der. Kanıt görüntüleri `docs/qa/screenshots/2026-09-14-map-clusters/`.

## Yürütülen akışlar (iOS)

| # | Kontrol | Sonuç | Kanıt |
|---|---|---|---|
| 1 | Şehir zoom'unda (11,8) çakışan Taksim/Cihangir/Karaköy pinleri tek küme ("4"); seyrek pinlerde kısa rozet (71, 51); skorsuz mekanda rozet yok | GEÇTİ | 01-city-zoom-clusters-and-badges.png |
| 2 | Kümeye dokunma → üyelere yakınlaşma (zoom 14,2); üyeler ayrıştı; rozetler 73 ve 🔥82; Google atfı ve "Yakınımdakiler" düğmesi görünür | GEÇTİ | 02-cluster-tap-fit-labels.png |
| 3 | Aynı koordinatlı iki mekan zoom 18'de de ayrışmadığından "2" kümesi kaldı; dokununca "Bu noktada 2 mekan" seçim kartı (skorlu satır + "Veri birikiyor" satırı, kapat düğmesi) | GEÇTİ | 03-same-spot-selection-card.png |
| 4 | Satıra dokunma → pin seçimi + önizleme kartı; küme pini seçili görünüm; tek Kaydet aksiyonu | GEÇTİ | 04-pick-from-list-preview-card.png |
| 5 | Boş harita dokunuşu seçimi kaldırır; trend şeridi geri gelir | GEÇTİ (manuel) | — |
| 6 | Kümeleme deterministik, zoom'a göre çözülür, aynı koordinat en yüksek zoom'da bile küme | GEÇTİ (birim) | apps/mobile/src/lib/map-cluster.test.ts (11/11) |

NOT_RUN: Android; DEMO yüzeyde (anahtarsız) küme görünümü; sunucu kümesi (`MapClusterItemDto`) çizimi ve dokunuşu (fixture/yerel API üretmiyor); VoiceOver ile küme ve kart etiketleri (etiketler kodda: `explore.clusterA11y`, `explore.clusterSameSpotA11y`); büyük font; Maestro; release fps; creator profili mini haritasında küme.

## Tasarım incelemesi (§6.5, 6 boyut × 0–5) — Keşfet haritası

| Boyut | Puan | Not |
|---|---:|---|
| Hiyerarşi | 4 | Küme sayısı > seçili pin > rozet > pin sırası okunuyor; kapsam uyarısı hâlâ büyük (ayrı iş). |
| Yüzey/boşluk | 5 | Seçim kartı önizleme kartıyla aynı yüzey/yarıçap (24), satırlar hairline ile gruplu. |
| Tipografi | 4 | Rozet caption tabular-nums; küme bodyStrong ters ton. |
| Fotoğraf/video oranı | 3 | Değişmedi: hak-duyarlı yer tutucu (BLOCKED medya). |
| Chip/pin | 5 | Kategori renk + ikon + kısa rozet; küme tek aksan; skor yoksa rozet yok; pin koordinattan kaymıyor. |
| CTA ve genel his | 4 | Lacivert küme ve Kaydet aynı aksan; harita kapanmıyor. |
| **Toplam** | **25/30** | Eksik puan medya/hak blokajından; bu teslim pin/küme boyutunu 11.09'daki açık kusurdan arındırdı. |

## Bulunan ve düzeltilen kusurlar

1. `fitToCoordinates` kenar payı `mapPadding` ile toplanınca kamera hareket etmiyordu → sabit 48 pt pay.
2. Rozet açılınca pin koordinattan kayıyordu (satır düzeni anchor 0.5) → sabit genişlikli marker + pin merkezine göre anchor.
3. Rozet eşiği 12 iken ilk şehir görünümü (11,8) rozetsizdi → eşik 11.

## Açık kusurlar

- Seçim kartı açıkken küme pini kartın üst kenarında kısmen örtülüyor; kamerayı kümeyi görünür tutacak şekilde kaydırma küçük iyileştirme olarak bekliyor.
- Kapsam uyarısı kartı harita alanının önemli kısmını kaplıyor (ürün sahibi listesindeki ayrı kalem).
