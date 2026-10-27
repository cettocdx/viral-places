# ADR-019 — Referans odaklı keşif haritası

Tarih: 25 Ekim 2026 · Durum: Kullanıcının yeni görsel yönüne dayalı yerel uygulama.

## Karar ve dayanak

Ürün sahibi bu sohbette arayüzü geliştirmemizi ve [Andrey Rybin — Places, Map & Pins](https://x.com/rybinandy/status/2112514892813205801) referansına yaklaştırmamızı istedi. Gönderi tarayıcıda açıldı; video 5,5 ve 18,5 saniyede incelendi. Bu istek, ilk PNG'lerdeki açık harita yönünü keşif ekranı için günceller.

Keşif haritasında sistem görünümünden bağımsız gece tabanı, fotoğraf destekli dairesel işaretçiler, beyaz kategori etiketleri, seçili mekan için açık yeşil halka, kompakt cam kontroller ve yüzen mekan kartı kullanılır. Detay, koleksiyon ve profil yüzeyleri mevcut sistem temasına uyar. Fotoğrafın olmaması veya yüklenememesi kategori ikonuyla gösterilir; hayali mekan fotoğrafı eklenmez.

## Uygulama sınırı

- Harita ve işaretçi renkleri `config/design-tokens.json` içindeki `map` sözlüğündedir; `tokens:sync` ile paylaşılır.
- Mevcut MapKit (iOS) / Google Maps (Android) entegrasyonu kullanılır. Google görünümü tokenlardan; MapKit görünümü `mutedStandard` ve gece görünümünden gelir. Sağlayıcı döşemelerinin birebir aynı olması beklenmez.
- Yalnız DTO'nun gösterilebilir saydığı küçük görsel kullanılır. Native snapshot, resim tamamlandığında yeniden çizilir. Kaynak işleme veya medya hakları genişletilmez.
- Seçili mekan kümeye gömülmez. Kamera, kart/yazı yüksekliği değiştiğinde de kullanılabilir harita alanına uyar.
- Arama açılınca sonuç listesi, kategori/yükselen filtreleri, boş durumdan geri dönüş, kaydetme ve detay gezinmesi çalışır. Tam liste tek düğmeyle açılır; keşif kartı yarım ekran boşluğuna büyümez.
- Bu yerel UI teslimidir; production dağıtımı veya M5/M6 kapanışı değildir.

## Doğrulama

[QA raporu](../qa/reports/2026-10-25-reference-map-ui.md). Canlı veri uçları hata verdiğinden native görsel kontrol açık DEMO verisiyle yapıldı. Android, gerçek cihaz performansı ve gerçek küçük görselin gecikmeli yüklenmesi ayrıca doğrulanmalıdır.
