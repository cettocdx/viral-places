# ADR-021 — Gece baskısı: tek koyu görsel dil

Tarih: 27 Ekim 2026 · Durum: Yerel uygulama.

## Karar

Ürün sahibi tüm arayüzün "çok daha çekici, yaratıcı, yeni sisteme uygun" olmasını istedi. Harita gece görünümündeyken diğer sekmeler açık griydi; uygulama iki ayrı ürün gibi görünüyordu. Karar:

- **Her zaman koyu.** `app/_layout.tsx` şemayı `dark` sabitler; `app.config.ts` `userInterfaceStyle: 'dark'`. Koyu palet harita lacivertiyle aynı aileden (`background #0F1A22`, `surface #182731`). Sekme çubuğu her ekranda aynı zeminde, seçili sekme beyaz.
- **Ortak dil:** beyaz çerçeveli fotoğraf kartları, yuvarlak kalın sticker yazı, açık yeşil vurgu (`map.accent`).
- **Keşfet:** alttaki kartlar kaydırıldıkça ortadaki kartın pini kümeden ayrılır, açık yeşil halka ve etiketle vurgulanır (`highlightedId`).
- **Mekan detayı:** üst alan, gösterim hakkı olan ilk kaynağın fotoğrafı (460 pt); üstünde sticker kategori, büyük isim, semt. Oynatılabilir kaynakta cam oynat düğmesi; dokununca video aynı alanda arayüzsüz oynar (`CalloutVideo`). Bu, 21.09.2026 "üst alan markanın yeri" kararını değiştirir; logo üst alandan kaldırıldı çünkü kaynak görseldeki yazıyla çakışıyordu.
- **Kaydedilenler:** koleksiyonlar, ilk mekanın kaynak görselini kapak yapan iki sütunlu kartlar (`CoverCard`); "yeni koleksiyon" aynı ızgarada kesik çizgili kart. Görsel yoksa ikonlu koyu zemin.
- **Boş durumlar:** `EmptyState` pinlerle aynı dilde üç eğik ikon sticker'ı gösterir (süs; erişilebilirlikten gizli).

## Sınırlar

Expo Go sistem görünümünü açık tutar; `SegmentedControl` gibi native denetimler bu yüzden simülatörde açık kalır. Gerçek build'de `userInterfaceStyle: dark` düzeltir; doğrulanmadı. Kart–pin vurgusu kümeleri yeniden hesaplar; çok mekanlı alanda performans ölçülmedi. Açık tema artık kullanılmıyor; palet kodu duruyor.
