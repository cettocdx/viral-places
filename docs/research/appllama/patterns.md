# Appllama araştırması — harita-first mekan keşif uygulamaları (11 Eylül 2026)

Kaynak: Appllama MCP (`search_apps`, `list_app_screens`), 6 uygulama, 29 ekran indirildi (`img/`), 12'si yakından incelendi.
Uygulamalar: Mapstr (917288465, $30K/ay), Plotline (6759443026), Rhyme/Roamy (6748781672, $100K/ay), corner (1668282277), park4night, Seed Oil Scout.
Not: Ekranlardaki Appllama filigranı kaynak işaretidir; tasarım öğesi değildir. Piksel değil kalıp kopyalanır.

## Kalıplar (iskelet, hiyerarşi, kontrol)

| Kalıp | Nerede görüldü | Bizde karşılığı |
|---|---|---|
| Tam ekran harita + yüzen chrome; kontroller cam/beyaz daire | Hepsi | Var (GlassView) |
| **Kalıcı alt sheet**: tutamaç, kısa durumda arama/segment, yarıda liste ("Trending on this map", "Nearby") | Plotline, Rhyme, Mapstr | **Eklendi**: MapSheet (peek/half detent, spring+hız devri), "Bu haritada yükselenler" |
| Seçili pin → sheet'te önizleme: küçük görsel, ad, kategori chip, mesafe/adres, tek ekle/kaydet | Mapstr, Rhyme | Var; sheet içine taşındı |
| Kategori chip'leri baş parmağa yakın (altta) | Plotline, corner | Şartname §7.2 üstte ister → **korundu** (ürün kararı) |
| Trend pili haritada + "Trending" bölümü | Plotline | Yükselen chip var + yeni bölüm |
| Detay: foto karuseli + sayfa noktaları; sosyal kanıt rozeti ("Saved by 36 plotters") | Plotline, Mapstr | **Eklendi**: hero'da kaynak/creator sayısı rozeti (dürüst metrik), placeholder karusel noktaları |
| Detay: "Your references" kartı — platform ikonu + @handle + AI "inside scoop" cümlesi | Plotline | **Eklendi**: AI özeti maddelerinde ilk kaynağın @handle'ı ve platformu |
| "Show sources • 50" pili | Rhyme | **Eklendi**: "Kaynaklar • N" pili → video şeridine kaydırır |
| Creator atıf başlığı (avatar, "1.784 yer · 206 takipçi", Follow) | Mapstr | **Eklendi**: detayda creator avatar yığını + "N creator paylaştı" |
| Top curators: avatar + yer/görüntülenme/liste sayıları | corner | Creator profilinde sayaçlar zaten var; Takip sekmesi kartına yer sayısı var |
| Alt aksiyon barı: eşit çerçeveli pill'ler (Go/Website/Call/Add) | Mapstr | Şartname: Yol Tarifi birincil + Gününe Ekle ikincil → korundu |

## Reddedilenler
- Sarı FAB "+" (Mapstr/Rhyme): bizde kullanıcı içerik eklemez (§5.3), FAB yok.
- Pembe/mor aksan ve "Recommended for you" AI iddiası: tek aksan (lacivert) ve kaynaklı özet ilkesi (§2.3, §15.4).
- Yıldız puanı satırı: viral endeks yıldız değildir (§8); bağımsız Google puanı yalnız atıfla.

## Apple HIG (resmi) — uygulanan kurallar (11 Eylül 2026)

Kaynak: developer.apple.com/design/human-interface-guidelines (Maps, Sheets, Tab bars, Searching sayfaları; `docs/research/apple-hig/*.md` olarak çıkarıldı). Ek olarak topluluk skill'leri `wondelai/skills@ios-hig-design` ve `nexu-io/open-design@apple-hig` kuruldu (resmi Apple yayını değildir; resmi metin öncelikli).

| HIG kuralı | Uygulama |
|---|---|
| Harita etkileşimli kalsın; haritayı örten etkileşimsiz öğeler beklentiyi bozar | Yüzen chrome minimal; sheet nonmodal, harita pan/zoom açık |
| Bilgi yoğun içerik için "muted" harita stili | Açık gri custom style (POI kapalı) |
| Yakın POI'leri kümele | M4/M5 kapsamı (clustering) — açık iş |
| Seçili öğeyi belirgin stille işaretle | Seçili pin büyür + gölge |
| Logo/yasal bağlantı kartın en düşük konumunun 10pt üstünde, arayüzle hareket etmesin | `mapPadding.bottom` = sheet/kart yüksekliği + tab bar; Google logosu sabit |
| Özel kontrollerle harita arasında yeterli kontrast (ince kenar/gölge) | GlassView + gölge; beyaz fallback + gölge |
| Yer kartı gösterilirken konum görünür kalsın | Kart üstünde pin görünür (padding) |
| Arama + kategori filtresi; arama kapsamı açık (placeholder) | "İstanbul'da keşfet…" + chip'ler |
| Sheet: tutamaç, medium detent ile aşamalı açılım, kaydırarak kapatma, aynı anda tek sheet | MapSheet peek/half, grabber dokunuşu detent değiştirir, aşağı fırlatma kapatır; formSheet modaller ayrı |
| Tab bar: gezinme için (aksiyon değil), etiketler tek kelime, SF Symbols, sekmeleri gizleme | NativeTabs, SF Symbols; "Takip Ettiklerin" iki kelime → şartname §7.1 adı korundu (kayıtlı sapma) |
| Arama önemliyse birincil konumda; öneriler (son aramalar) | Birincil arama alanı var; son aramalar/öneriler açık iş |
