# ADR-022 — "Bu haritada keşfet" reels akışı

Tarih: 27 Ekim 2026 · Durum: Yerel uygulama.

## Karar

Ürün sahibi, haritadaki mekan listesinin Instagram Reels gibi tam ekran, dikey kaydırılan bir video akışı olmasını istedi; durup mekan sayfasına gidilebilmeli.

- "Bu haritada keşfet" düğmesi ve liste düğmesi, arama yokken `ReelsFeed`'i açar; arama sonuçları liste olarak kalır.
- Her sayfa bir mekan: kapak görseli, sayfa görünür olunca kaynak videosu (`CalloutVideo`, TikTok resmi oynatıcısı arayüzü kapalı, sessiz başlar, döngü). Yalnız görünen sayfa oynar; detay yalnız görünen ve komşu sayfalar için çekilir.
- Ses tercihi videodan videoya taşınır (oynatıcı her zaman sessiz başlar, izleyici sesi açtıysa hazır olunca açılır).
- Sol altta sticker kategori, ad, semt · @creator · izlenme (kaynağın gerçek sayacı), "Mekanı gör" ve kaydet. Sağ kenar TikTok oynatıcısının kendi sayaçlarına kaldığı için bizim kontrollerimiz orada değil.
- Sol üstte her zaman görünen "‹ Harita" düğmesi; sayaç (3/36). Mekan sayfasından dönünce aynı sayfada kalınır (indeks Keşfet ekranında tutulur).

## Sınırlar

TikTok logosu ve sağdaki beğeni/yorum sayaçları resmi oynatıcıda kapatılamıyor. Instagram kaynakları resmi gömme sayfasıyla yüklenir ve bu turda oynadığı doğrulanmadı. Video önbelleği yok: her sayfa oynatıcıyı yeniden yükler.
