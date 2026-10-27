# ADR-023 — Videolar kalıcı depodaki dosyadan oynatılır

Tarih: 27 Ekim 2026 · Durum: Ürün sahibi kararı, yerel uygulama.

## Karar

Ürün sahibi, videoların önbellekli, beklemeden ve hiçbir TikTok izi (logo, beğeni/yorum sayacı) olmadan oynamasını istedi ve riski açıkça kabul etti: "Evet, riski biliyorum. Videoları mp4 dosyasından doğrudan oynat… creator adı görünmeye devam etsin."

- `appConfig.playStoredVideoFiles = true`. `sourcePlayback(..., { preferFile: true })`: gösterilebilir (`official_embed`) ve onaylı bir kaynağın kalıcı depodaki `videoUrl`'i varsa dosya oynatılır; yoksa resmi oynatıcı. `unavailable`, onay bekleyen ve süresi dolan kaynaklar yine oynatılmaz (testli).
- `components/map/file-video.tsx`: `expo-video` (57.0.5), `useCaching: true` (cihazda önbellek), döngü, sessiz başlar, oynatıcı arayüzü yok, kapak ilk kareye kadar kalır; dokununca duraklat; creator adı ve avatarı görüntünün üstünde.
- Reels'te görünen sayfa oynar, komşu sayfalar dosyayı duraklatılmış olarak yükler (kaydırmadan önce hazır).
- Ürün sahibi isteğiyle beğeni sayıları gösterilmez; yalnız izlenme ve creator adı.

## Risk ve geri alma

Bu, ADR'lerdeki ve seed hak politikasındaki `may_rehost_video: false` kuralının istemcide bilerek aşılmasıdır; hak kayıtları değişmedi. Telif ve platform şartları riski ürün sahibindedir. Geri almak: `playStoredVideoFiles: false` (resmi oynatıcıya döner).
