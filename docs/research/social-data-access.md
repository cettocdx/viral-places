# Creator içeriğine erişim: TikTok ve Instagram seçenekleri (araştırma, 13 Eylül 2026)

**Kapsam:** 20–200 public creator, günlük yenileme, alanlar: caption, hashtag, medya/kapak URL'si, izlenme/beğeni/yorum/paylaşım sayaçları, tarih, yer etiketi, mümkünse transkript. Creator'lar uygulamamıza izin vermemiş kabul edilir. Fiyatlar sağlayıcı sayfalarından **13 Eylül 2026** tarihinde okunmuştur; birim/fiyat gerçek faturayla doğrulanmadan bütçe kapısında kesin sayılmaz (§27.4).

Bu belge hukuki görüş değildir. Hak/izin kararı `private.rights_policies` kaydı ve `vp-media-rights` kurallarına tabidir.

## 1. Özet karar

| Platform | Birincil | Yedek | Resmi API durumu |
|---|---|---|---|
| TikTok | **ScrapeCreators** `GET /v3/tiktok/profile/videos` (+ `/v1/tiktok/video/transcript`) | **Apify** `clockworks/tiktok-scraper` (webhook + dataset) · EnsembleData `/tt/user/posts` | Research API akademik/kâr amacı gütmeyen; Display API creator OAuth'u ister; oEmbed yalnız başlık/yazar/thumbnail/embed HTML |
| Instagram | **Instagram Graph API Business Discovery** (resmi, ücretsiz, izin gerektirmez; yalnız Business/Creator hesaplar; **konum alanı yok**) + konum için **ScrapeCreators** `GET /v1/instagram/post` | **Apify** `apify/instagram-scraper` (`locationName/locationId`) | Basic Display 4 Aralık 2024'te kapandı; oEmbed yalnız görüntüleme amaçlı ve App Review ister |

Neden ScrapeCreators: tek senkron çağrıda ham TikTok `aweme` nesnesi (`statistics.play_count`, `poi`/`anchors` yer etiketi, `music`, `text_extra`, `create_time`), TikTok'un kendi altyazısını dönen transkript ucu, kredi başına ödeme (kredi bitmez), belgelenmiş oran limiti yok. Zayıflık: küçük satıcı, SLA yok → yanıt ham JSON olarak şema doğrulamasından geçirilir (`normalizeTikTokAweme`).

Neden Apify yedek: farklı altyapı, %97–99 run başarısı, webhook + dataset API (mevcut `/webhooks/apify` ucu ve inbox/outbox), `locationMeta`, `subtitleLinks`, ücretli ASR eklentisi, private/silinmiş profil için açık `errorCode`.

## 2. Resmi API'ler (izinsiz creator için ne mümkün?)

- **TikTok Research API** — yalnız akademik/kâr amacı gütmeyen kurumlar; ticari kullanım "No". Alanlar: `id, video_description, create_time, region_code, share_count, view_count, like_count, comment_count, hashtag_names, username, voice_to_text, video_duration…`; POI ve medya URL'si yok; 1.000 istek/gün. Araştırma ToS: veri en az 30 günde bir yenilenir, erişilemez içerik silinir. Kaynak: developers.tiktok.com/products/research-api, /doc/research-api-specs-query-videos, tiktok.com/legal/page/global/terms-of-service-research-api/en
- **TikTok Display API** — `POST /v2/video/list/` (scope `video.list`, ≤20/istek) yalnız yetki veren kullanıcının kendi videoları; `cover_image_url` 6 saatlik. İleride "profilini sahiplen" yolu olarak kullanılabilir (§30 claim). Kaynak: developers.tiktok.com/docs/en/tiktok-api-v2-video-list
- **TikTok oEmbed** — `GET https://www.tiktok.com/oembed?url=…` → `title, author_name, author_url, html, thumbnail_url…`; sayaç/POI/tarih yok; resmi gömme oynatıcı için güvenli yol. Kaynak: developers.tiktok.com/doc/embed-videos
- **Instagram Graph API Business Discovery** — `GET /v25.0/{OUR_IG_USER_ID}?fields=business_discovery.username({target}){id,username,followers_count,media_count,media.limit(n).after(cursor){id,caption,comments_count,like_count,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,username,view_count}}`. Ön koşul: kendi IG profesyonel hesabımız + Facebook Page + App Review (`instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`). Hedef public Business/Creator olmalı. `location/latitude/longitude` desteklenmez; hashtag caption'dan ayrıştırılır; oran limiti 200 çağrı/saat × uygulama kullanıcısı. Kaynak: developers.facebook.com/docs/instagram-platform/instagram-graph-api/business-discovery, /docs/instagram-platform/reference/instagram-media, /docs/graph-api/overview/rate-limiting
- **Instagram oEmbed** — "Meta oEmbed Read" App Review; 1.000 istek/saat; `thumbnail_url` ve `author_name` yanıttan kaldırıldı; yalnız ön yüz görüntüleme için. Kaynak: developers.facebook.com/docs/instagram-platform/oembed
- **Instagram Basic Display API** — 4 Aralık 2024'te kapatıldı; kişisel hesaplara resmi erişim yok.

## 3. Üçüncü taraf sağlayıcılar

### TikTok

| Sağlayıcı | Uç / girdi | Dönen alanlar | Fiyat | Not |
|---|---|---|---|---|
| ScrapeCreators | `GET /v3/tiktok/profile/videos?handle=&max_cursor=&sort_by=latest`, `GET /v1/tiktok/video/transcript?url=` (`use_ai_as_fallback`), header `x-api-key`, 1 kredi/istek | `aweme_list[]`: `aweme_id, desc, create_time, region, statistics{play_count,digg_count,comment_count,share_count,collect_count}, video{play_addr,download_addr,download_no_watermark_addr,cover,duration}, poi, anchors, music, text_extra, share_url, is_ad, is_top` | 100 ücretsiz; $47 = 25k kredi ($1,88/1k); $497 = 500k ($0,99/1k); krediler bitmez; cache isabeti ücretsiz | 200 creator/gün ≈ $11/ay |
| Apify `clockworks/tiktok-scraper` / `tiktok-profile-scraper` | `POST /v2/acts/{id}/runs` (`webhooks` base64, `maxTotalChargeUsd`), `GET /v2/datasets/{id}/items`; girdi `profiles[], resultsPerPage, profileSorting, oldestPostDateUnified, shouldDownloadVideos, downloadSubtitlesOptions` | `id, text, createTimeISO, webVideoUrl, playCount, diggCount, shareCount, commentCount, collectCount, hashtags[], isAd, isPinned, authorMeta, musicMeta, videoMeta{duration,coverUrl,downloadAddr}, subtitleLinks[], locationCreated (ülke), locationMeta{address,city,countryCode,locationName}`; hata satırı `errorCode` (`PROFILE_PRIVATE, NOT_FOUND…`) | Sonuç başına $0,0037 (FREE) → $0,0017 (GOLD) → $0,0005 (DIAMOND); tarih filtresi/indirme eklentileri ayrı; transkript $0,015–0,048/dk; profile-scraper "$1,00/1k sonuçtan" | 120k sonuç/ay ≈ $120–444 kademeye göre |
| EnsembleData | `/tt/user/posts?username=&depth=&cursor=&oldest_createtime=&token=` (token query string'de → redaksiyon zorunlu) | ham `aweme_list` (`poi_info` dahil), `nextCursor`; pinned önce | Günlük birim: Free 50; Wood $100 (1.500/gün); Bronze $200 (5.000); … ; user posts 1 birim / 10 post; kullanılmayan birim devretmez | ≈ $100/ay |
| Bright Data | `datasets/v3/trigger?dataset_id=gd_lu702nij2f790tmv9h&discover_by=profile_url` (async, snapshot) | `post_id, description, create_time, play_count, share_count, collect_count, comment_count, video_url, hashtags, video_duration, profile_username…`; ürün sayfası location/POI iddia eder, örneklerde doğrulanmadı | $1,50/1k kayıt PAYG; 5k ücretsiz/ay; Scale $499 | En güçlü hukuki sicil (Meta ve X davaları); async ağır |
| Lamatok (HikerAPI'nin TikTok kardeşi) | `GET /v2/user/medias/by/secUid`, `/v1/media/by/url`, `/v1/media/video/download/by/id` | ham şekil; alan belgesi canlı spec'te | $0,60–1,00/1k istek, ön ödemeli | Giriş yapılmış hesap havuzu modeli → ToS sürtünmesi yüksek |
| TokApi (RapidAPI) / tiktok-api23 | `GET /v1/post/user/{user_id}/posts`; `/v1/location/{id}` | ham `aweme_list` | Pro $12,99 (1,5M istek) | Tek geliştirici, SLA yok; RapidAPI listeleri kaybolabilir |
| TikAPI | `GET /public/posts?secUid=` | CDN URL'lerinde `expire=` ≈ 48 saat | $29/$79/$189 aylık | Starter 300 istek/gün yetersiz |

### Instagram

| Sağlayıcı | Uç / girdi | Dönen alanlar | Fiyat | Not |
|---|---|---|---|---|
| Graph Business Discovery (resmi) | yukarıda | konum yok; `view_count` yalnız Reels | ücretsiz | App Review + kendi profesyonel hesabımız |
| ScrapeCreators | `GET /v2/instagram/user/posts?handle=&next_max_id=`, `GET /v1/instagram/user/reels`, `GET /v1/instagram/post?url=` (`download_media` +10 kredi, `cache_max_age`) | `like_count, comment_count, play_count, view_count, video_versions, image_versions2, caption, taken_at_timestamp, code, usertags, location{name,lat,lng,pk}` (post ucu) | 1 kredi/istek (yukarıdaki paketler) | Play count "bazen hatalı" notu |
| Apify `apify/instagram-scraper`, `instagram-reel-scraper`, `instagram-profile-scraper` | `directUrls[], resultsType posts/reels, resultsLimit, onlyPostsNewerThan`; reel-scraper `includeTranscript`, `includeDownloadedVideo` (3 gün) | `id, shortCode, url, productType, caption, hashtags[], likesCount, commentsCount, videoViewCount, videoPlayCount, displayUrl, videoUrl, videoDuration, timestamp, locationName, locationId, ownerUsername, ownerId, isPinned, isSponsored` | $2,70/1k (Free) → $1,50/1k (Business); reel-scraper $1,00–2,60/1k | `videoPlayCount` tarayıcıyla eşleşir; `videoViewCount` iç sayaç |
| EnsembleData | `/instagram/user/posts?user_id=&depth=&chunk_size=&oldest_timestamp=`, `/instagram/user/reels` | ham IG şekli (`play_count, location, video_versions`) | user posts 1 birim/10 post; reels post başına | Şema OpenAPI'de (giriş gerekli) |
| HikerAPI | `/v1/user/by/username`, `/v2/user/medias`, `/v2/user/clips`, `/v2/media/info/by/code` (`safe_int`) | ham IG private-API şekli | $0,60/1k (standart) | Hesap havuzu; Meta ToS'a göre en riskli model |
| Bright Data | Instagram Profiles/Posts/Reels scraper (async) | `post_id, description, hashtags, date_posted, likes, views, video_play_count, video_url, thumbnail…`; konum örneklerde yok | $1,50/1k; 5k ücretsiz | |
| Data365 | async görev modeli | `likes_count, comments_count, shortcode…` | €300/ay | Belgeler giriş ardında |
| RapidAPI (`instagram-scraper-api2`, `instagram230`) | — | — | $5–100/ay | 13.09'da her iki liste "API not found"; kararsız |

## 4. Medya URL'leri ve haklar

- TikTok ve Instagram CDN URL'leri imzalıdır: TikTok `expire=` ≈ 48 saat (TikAPI örnekleri), Display API kapak 6 saat; Instagram `oe` hex Unix zamanı, reels DASH ≈ 108 saat, görseller saatler–günler.
- Sağlayıcı bir mp4 URL'si döndürmesi **hak vermez**. TikTok ToS içerik indirme/çoğaltma/yeniden yayınlamayı yasaklar; Meta şartları 1 Ocak 2025'ten itibaren giriş yapılmamış otomatik toplamayı da yasak sayar.
- Güvenli duruş (uygulanan): yalnız metadata + sayaç + yer etiketi + kaynak link; gösterim `link_only`/`official_embed` (oEmbed HTML); video yeniden barındırma yok; thumbnail yalnız `may_store_thumbnail` hakkıyla ve süreli; transkript ses dosyası saklanmadan türetilmiş metin olarak.

## 5. Transkript

- Resmi `voice_to_text` yalnız Research API'de.
- TikTok otomatik altyazısı: ScrapeCreators `/v1/tiktok/video/transcript` (1 kredi; AI fallback 10 kredi, ≤2 dk), Apify `subtitleLinks[]` (WebVTT, `source`=ASR/creator/MT) veya ASR eklentisi ($0,015–0,048/dk).
- ASR alternatifleri: Deepgram Nova-3 $0,0043/dk, OpenAI Whisper $0,006/dk; 200 video/gün × 30 sn ≈ $13–18/ay. Uygulamada yalnız `may_send_metadata_to_ai` + sağlayıcı altyazısı kullanılır; ses indirme/ASR ayrı hak kararı (`may_download_media` + `may_send_media_to_ai`) olmadan çalışmaz.

## 6. Hukuk / ToS özeti

- **ABD:** hiQ v. LinkedIn (9th Cir. 2022) CFAA'nın public veriyi kapsamadığını söyledi ama dava hiQ aleyhine sözleşme ihlali ve ihtiyati tedbirle bitti (Aralık 2022). Meta v. Bright Data (N.D. Cal., 23 Ocak 2024): giriş yapılmamış public veri toplaması Meta şartlarını ihlal etmedi; Meta davayı Şubat 2024'te düşürdü. X Corp v. Bright Data (Mayıs 2024): iddialar reddedildi. Meta'nın 2025 şartları ve "Automated Data Collection Terms" (7 Ekim 2024) giriş şartından bağımsız yasak getirir; yeni metin henüz test edilmedi.
- **TikTok ToS:** otomatik toplama ve içerik indirme yasağı; EEA/UK metninde "ticari amaçla veri çıkarma" açıkça yasak; TikTok CAPTCHA/oran sınırı/izleme uygular. Kendi hesabımızla giriş yaparak toplama **yapılmaz** (§13.6 kuralı ile uyumlu: cookie/CAPTCHA/hesap rotasyonu yok).
- **GDPR:** kullanıcı adı, caption, POI kişisel veridir; hukuki dayanak meşru menfaat (Md. 6/1-f) + üç aşamalı test; Md. 14 şeffaflık (bireysel bildirim orantısızsa kamuya açık gizlilik bildirimi); EDPB web scraping kılavuzu 03/2026 (7 Temmuz 2026, istişare 30 Ekim 2026'ya kadar) robots.txt/CAPTCHA/giriş duvarını beklenti sinyali sayar. 17 veri koruma otoritesinin ortak açıklaması (Ekim 2024): public ≠ serbest.
- **KVKK (6698):** Md. 5/2-d "alenileştirme" istisnası amaçla sınırlıdır; Kurul duyurusu her amaç için işleme izni vermediğini söyler; gerçekçi dayanak Md. 5/2-f meşru menfaat; VERBİS ve envanter gerekir. Hukuk danışmanı onayı `rights_policies` kaydına yazılır.
- Uygulanan duruş: yalnız public profesyonel/creator hesaplar; giriş yapılmamış sağlayıcı; minimum alan; gizlilik bildiriminde kaynak platformlar; silme/itiraz ucu (`private.takedown_requests`, bütçe kesicisinden bağımsız); erişilemeyen içerik 30 gün içinde silinir (Research ToS yenileme kuralına paralel).

## 7. 200 creator/gün için tahmini aylık maliyet

| Sağlayıcı | Hesap | ≈ USD/ay |
|---|---|---|
| ScrapeCreators (TikTok) | 200 istek/gün × 30 = 6k kredi @ $1,88/1k | 11 (+6 transkript) |
| ScrapeCreators (IG konum zenginleştirme, yalnız yeni gönderiler) | ~100 istek/gün | 6 |
| Graph Business Discovery | 200 çağrı/gün | 0 |
| Apify profile-scraper | 120k sonuç @ $1/1k | 120 |
| Apify tiktok-scraper | 120k @ $1,70/1k (GOLD) / $3,70/1k (FREE) | 204 / 444 |
| EnsembleData | Wood | 100 |
| Bright Data | 120k @ $1,50/1k − 5k ücretsiz | 173 |
| Google Places Text Search (New) | yalnız eşleşme adayı; alan maskesi dar | kullanım oranına bağlı; birim fiyat env'de yoksa çağrı yapılmaz |
| Anthropic (çıkarım, metadata_only) | ~4k giriş + 1,2k çıkış token/gönderi, claude-opus-5 liste | ~$0,06/gönderi → 100 yeni gönderi/gün ≈ 180 |

Sonuç sayısı tabanlı faturalar yalnız yeni gönderileri çekerek (tarih filtresi/watermark) ve sayaçları daha seyrek yenileyerek 5–10× düşer.

## 8. Doğrulanmamış / yapılacak contract spike (§13.1)

- Bright Data ve HikerAPI alan şemaları (belge 404/giriş ardında).
- ScrapeCreators `/v2/instagram/user/posts` öğelerinde `location` nesnesi (post ucu döner; liste ucu doğrulanmadı).
- Apify Starter plan ücreti; RapidAPI listelerinin güncel durumu.
- Gerçek response kayıtları, pinned post davranışı, pagination sırası, private/deleted durumları ve faturalandırma gözlemi: 5–10 izinli hesap, ≥50 gönderi (anahtar ve hak kaydı olmadan tamamlanmış sayılmaz).
