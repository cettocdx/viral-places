# Plan isteği ayrıştırma — opsiyonel P1

Bu özellik ilk sürüm için zorunlu değildir. [Ana şartname bölüm21](../VIRAL_PLACES_MASTER_BUILD_SPEC_TR.md#s21) temel plan davranışını belirler.

Model görevi yalnız kullanıcının isteğinden filtre ve kısıt çıkarmaktır. Gerçek venue seçimi, açılış/geçerlilik kontrolü ve rotalama ayrı deterministik katmandadır. Kullanıcının metnindeki komutlar uygulamanın yetki/bütçe/policy sınırlarını değiştiremez.

```text
İstekten locale, city_hint, date_local, timezone_hint, category_preferences,
family_preferences, pace ve duration_minutes alanlarını çıkar.
Bilgi yoksa null veya boş liste kullan. Mekan adı veya koordinat icat etme.
Kullanıcı kesin tarih vermediyse backend'in verdiği current_local_date ve
timezone dışında kendi güncel zamanını varsayma. Birden fazla olası tarih
varsa ambiguity alanında belirt. Çocuğun adı/doğum tarihi gerekmez.
Yalnız JSON üret; ağ veya veri tabanı işlemi yapma.
```

Kısıtlar kullanıcıya kısa, düzenlenebilir formda gösterilir. Yalnız yayımlanabilir venue ID'lerinden plan üretilir. Gerçek yol verisi yoksa en hızlı/optimal rota iddiası yoktur. Plan ekleme rezervasyon değildir.
