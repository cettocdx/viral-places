# Viral Places — Geliştirme paketi

**Dil:** Türkçe · **Sürüm:** 1.0 · **Tarih:** 11 Eylül 2026

Bu paket, konuştuğumuz sosyal medya kaynaklı mekan keşif uygulamasını geliştirmek için hazırlanmıştır. Bir uygulama build'i veya çalışan repo değildir.

## Nereden başlanır?

1. [Ana Markdown şartnamesini](VIRAL_PLACES_MASTER_BUILD_SPEC_TR.md) aç. 36 bölüm; ürün, üç ekranın tasarım dili, mimari, veri/AI motoru, skor, API, DB, güvenlik, test, maliyet ve yayın koşulları içerir.
2. Paketi geliştirme ortamında bir proje klasörüne aç. [AGENTS.md](AGENTS.md) ile [.agents/skills](.agents/skills) klasörünü koru. Mevcut uygulama repo'su varsa dosyaları körlemesine ezme.
3. Kodlama ajanına bölüm32'deki başlangıç talimatını ver. Önce M0/M1; sonra tek gerçek uçtan uca veri akışı. Sadece ana Markdown kullanılabilir fakat görseller ve skill dosyaları için tam paket önerilir.

## İçerik

- 36 bölümlü tek ana şartname ve 31 birincil kaynak kaydı.
- Üç onaylanmış UI referansı: harita, mekan detayı, creator profili.
- 12 proje-özel SKILL.md; gerçek resmi Expo/Vercel/Supabase skill eşlemesi ve kurulum kaynakları.
- AGENTS.md, karar/blokaj günlüğü, build log ve skill lock şablonu.
- Tasarım tokenları; deny-by-default hak policy; kapalı canlı özellikler ve boş bütçelerle örnek pipeline policy.
- Kanıt çıkarımı ve kaynaklı özet promptları; skor aritmetik fixture'ları.
- Belge/paket bütünlük kontrol betiği ve kontrol raporu.

## Uygulama kodu (M0/M1 — 11 Eylül 2026)

Paket artık bir pnpm monorepo'dur: `packages/` (domain, contracts, design-tokens, scoring, policy, test-fixtures) ve `apps/mobile` (Expo SDK 57, Expo Router). Durum ve kanıtlar: [docs/M0_INVENTORY.md](docs/M0_INVENTORY.md), [docs/build-log.md](docs/build-log.md), [docs/qa/reports](docs/qa/reports/2026-09-11-m1-ios-fixture-ui.md), ADR'ler [docs/adr](docs/adr/ADR-014-map-surface-without-google-key.md).

```bash
pnpm install
pnpm test && pnpm typecheck
pnpm mobile          # Metro; iOS simülatörde Expo Go ile açılır
```

Google Maps anahtarı olmadan harita DEMO yüzeydir (ADR-014). Gerçek harita için `apps/mobile/.env` + `LANG=en_US.UTF-8 npx expo run:ios`.

Yerel Supabase (M2): Docker açıkken `npx supabase start`, RLS testleri `npx supabase test db`, danışman `npx supabase db advisors --local` (ADR-016). Tüm veriler sentetik DEMO fixture'dır; canlı entegrasyonlar BLOCKED listesindedir.

API (M2, ADR-017): `apps/admin` Next.js `/api/v1`. `GET /api/v1/map/places` zoom < 11'de mekan yerine `type: "cluster"` öğeleri döndürür (§19.3; `packages/domain` ızgara kümeleme, `SERVER_CLUSTER_BELOW_ZOOM`); filtreler kümelemeden önce uygulanır, küme konumu üyelerin en az güvenilen `origin` değerini taşır. `apps/admin/.env.local` dosyasını `npx supabase status -o env` çıktısından doldur (`.env.example` şablonu; secret yalnız sunucuda). `pnpm api` (port 3100), entegrasyon testleri `pnpm test:integration` (yerel Supabase gerekir). Mobilde canlı istemci için `apps/mobile/.env` içine `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3100`.

## Motor: ingestion → AI çıkarımı → eşleştirme → skor (13 Eylül 2026, ADR-018)

Sosyal kaynak adaptörleri, Claude tabanlı kanıt çıkarımı, Google Places aday eşleştirmesi, cohort tabanlı viral skor ve outbox worker'ı `packages/pipeline` + `apps/worker` altındadır. Sağlayıcı araştırması ve öneri: [docs/research/social-data-access.md](docs/research/social-data-access.md) (birincil ScrapeCreators, yedek Apify; Instagram için resmi Business Discovery + konum zenginleştirme).

```bash
pnpm --filter @viral-places/pipeline test     # adaptör/çıkarım/skor/bütçe birim testleri (ağ yok)
cp apps/worker/.env.example apps/worker/.env  # DATABASE_URL (npx supabase status) + sağlayıcı anahtarları
pnpm worker:once                              # tek geçiş: tik → iş kuyruğu → handler'lar
pnpm worker                                   # sürekli döngü
```

`VP_DATA_MODE=demo` iken fixture adaptörü ücretsiz çalışır; canlı sağlayıcılar `config/pipeline-policy` bütçe onayı + `features.liveIngestion=true` + onaylı hak kaydı (`private.rights_policies`) olmadan hiç çağrılmaz. Auto-publish kapalıdır; eşleşmeler `/api/v1/admin/review-tasks` üzerinden insan kararıyla yayına girer (`ADMIN_API_TOKEN`). Migration `supabase/migrations/20260913120000_engine_tables.sql` ve pgTAP `supabase/tests/engine.test.sql` bu teslimde Docker olmadığı için NOT_RUN'dır (bkz. build-log).

## Kontrol

```bash
python3 scripts/validate_pack.py
```

Bu komut yalnız paket tutarlılığını, dosya bağlantılarını, JSON/YAML başlıklarını ve sentetik skor aritmetiğini kontrol eder. Mobil uygulama, sağlayıcı, AI modeli, RLS veya mağaza yayını testi değildir.

## Önemli ayrım

Proje skill'leri burada gerçek dosyalardır ve bu ürün için yazılmıştır. Resmi üçüncü taraf skill'lerin kaynakları incelenmiştir ama bu paket kullanıcının ajana kurulum yapmış sayılmaz. Canlı API, içerik hakkı, bütçe ve production onayı yerine geçmez.

PNG'lerdeki puanlar, mekan anlatımları ve kişiler tasarım örneğidir; doğrulanmış canlı veri değildir. Ana şartname bu ayrımı üretim kurallarına dönüştürür.
