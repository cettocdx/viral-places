# ADR-025 — Harita kontrolleri ve sayfa kalitesi

Tarih: 27 Ekim 2026 · Durum: Yerel uygulama.

Ürün sahibi: "bu butonları ve diğer sayfaları yapabileceğin en yüksek kalitede tekrar yap".

- `components/map/map-controls.tsx`: tek kontrol yüksekliği (44 pt). Sağ üstte arama + filtre tek cam kapsülde, aralarında ince çizgi (Apple Haritalar düzeni); filtre etkinse yeşil nokta, açıkken ikon yeşil. Yanında beyaz halkalı avatar (menü açıkken halka yeşil). Sağ altta dikey kapsül: beyaz daire içinde oynat (reels) + konum (izin varsa dolu ikon). Her dokunuşta seçim haptiği.
- Hesap menüsü: avatardan yaylanarak büyür (sağ üst köken), arkada hafif karartma, dışarı dokununca kapanır. Opak koyu yüzey (cam, haritanın yazılarını menü metninin altına sızdırıyordu). Misafir başlığı; Kaydedilenler ve Takip Ettiklerin satırlarında gerçek sayılar.
- Kaydedilenler: Expo Go'da açık kalan sistem seçicisi yerine koyu iz + yaylanan beyaz başparmaklı `components/segmented.tsx`.
- Takip Ettiklerin boşken: şehrin ilk 14 mekanının kaynaklarından gerçek creator önerileri (paylaştıkları mekan sayısına göre), mekan küçük görselleri ve "Takip Et" (`useSuggestedCreators`).
