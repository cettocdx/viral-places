# ADR-020 — Pin üstünde açılan mekan kartı ve sticker pinler

Tarih: 27 Ekim 2026 · Durum: Yerel uygulama; ADR-019'un pin ve seçim kartı bölümünü değiştirir.

## Karar ve dayanak

Ürün sahibi, mekanların ve dokununca açılan kartların [Andrey Rybin — Places, Map & Pins](https://x.com/rybinandy/status/2112514892813205801) videosundakiyle birebir aynı olmasını istedi. Video (24 sn, 1080×1080) kare kare incelendi; ADR-019'daki alt sayfa kartı referansla uyuşmuyordu. Referansta kart alttan çıkmaz, seçilen pinin hemen üstünde kuyruklu bir balon olarak açılır.

- **Pin:** beyaz halkalı dairesel fotoğraf, altında küçük beyaz kuyruk. Yakın zoomda üstte, fotoğrafın kenarına binen, yuvarlak kalın siyah ve beyaz kesim kenarlı, mekana göre sabit −9…9° eğik kategori etiketi ("Yemek", "Kahve", "Gece"…). Seçili halka, skor rozeti ve büyütme kaldırıldı; referansta yoktur.
- **Kart, önizleme:** pinin üstünde beyaz, 30 pt köşeli kart; üst kenara binen kategori rozeti (renkli daire ve sticker yazı); kareye yakın fotoğrafın altında isim ve semt; altında adres ve tek bilgi satırı; aşağıyı gösteren kuyruk.
- **Kart, detay (karta dokununca):** fotoğraf kalkar; büyük başlık (dokununca mekan sayfası), adres, bilgi satırı, kaynaklı özet (3 satır), "Daha fazla", kaynak video şeridi, altta soluk kategori yazısı ve kaydet düğmesi.
- **Kart, tam ("Daha fazla"):** özetin tamamı; kartın köşesinde yüzen beğeni ve izlenme sayaçları.
- Kamera pini, kart başlığın altına sığacak noktaya kaydırır; uzaktan seçimde önce mahalle ölçeğine yakınlaşır. Kart büyüyünce pin yeniden yerleşir. Harita hareket ederken kart gizlenir, hareket bitince pinin yeni yerine demirlenir. Boş haritaya dokunmak kartı kapatır.
- Mekan seçiliyken alt sayfa gösterilmez. Küme listesi ve "Bu haritada keşfet" sayfası değişmedi.

## Dürüstlük sınırları

Referanstaki "★ Shop 4.9" satırı ve "👍 24 / ★ 4.9" sayaçları uydurulmaz:

- Bilgi satırı: Google puanı varsa yalnız o, "· Google" atfıyla; yoksa viral skor; o da yoksa kategori ve kaynak video sayısı. 27 Ekim canlı verisinde puan ve skor çoğunlukla boş olduğundan çoğu kartta üçüncü hal görünür.
- Sayaçlar: kaynak videoların erişilebilir beğeni ve izlenme toplamı (`sumCounters`); hiçbir kaynak sayaç vermiyorsa gösterilmez (null ≠ 0).
- Alt başlık semttir; referanstaki tanıtım cümlesi için kaynaklı alan yoktur.
- Özet yoksa "Kaynaklı özet için yeterli kanıt yok." yazılır.
- Video şeridindeki küçük resme dokunmak mevcut `SourceVideoPreview` ile kart içinde oynatır; hak kuralları değişmedi.

## Uygulama

- `components/map/venue-marker.tsx`, `sticker-text.tsx` (12 beyaz kopya ile metin kenarı; harita snapshot'ında da çalışır), `place-callout.tsx`.
- `lib/callout-layout.ts`: kart çerçevesi, kenar sıkıştırma, kuyruk konumu, hedef pin yüksekliği, en büyük kart yüksekliği, sayaç toplamı; birim testli.
- `VenueMapProps.onSelectedPoint` / `calloutHeight`: native harita `pointForCoordinate` ile noktayı bildirir; DEMO yüzey kendi izdüşümünü kullanır.
- Token: `map.marker` boyutları ve yeni `map.callout` sözlüğü (`config/design-tokens.json`).
- `place-preview-card.tsx` artık kullanılmıyor; geri dönüş ihtimali için silinmedi.

## Bilinen sınırlar

Kuyruk kartın gölgeli görünümünün içindeyken gri görünüyordu, dışına taşındı. Simülatörde dokunuşlar Expo Go geliştirme modunda 1–3 sn gecikmeyle işlendi; release build performansı ölçülmedi. Kart kapanınca alt sayfa geri geldiği için harita dolgusu değişir; seçili pin sayfanın altında kalabilir. Android, VoiceOver, büyük yazı ve reduce-motion bu turda denenmedi.
