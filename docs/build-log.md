# Geliştirme günlüğü

## Başlangıç durumu — 11 Eylül 2026

Bu pakette ürün/teknik şartname, proje skill'leri, görsel referanslar ve örnek config/promptlar hazırlanmıştır. Uygulama kodu, native build, canlı veri run'ı, migration veya deployment yapılmamıştır.

## Her uygulama tesliminde eklenecek kayıt

```text
Issue / milestone:
Ortam / commit / build:
İlgili şartname bölümleri:
Okunan skill dosyaları:
Uygulanan kurallar:
Değişen dosyalar:
Çalıştırılan komutlar:
Sonuç / ölçümler:
Kanıt dosyaları:
NOT_RUN testler:
BLOCKED bağımlılıklar:
Bir sonraki bağımsız uygulanabilir iş:
```

## VP-001 → VP-005 — M0 envanter + M1 etkileşimli mobil kabuk — 11 Eylül 2026

```text
Issue / milestone:            VP-001 repo/skill/env envanteri; VP-002 token+referans analizi; VP-003 navigation+map spike; VP-004 place screen; VP-005 creator screen (M0 tamam, M1 fixture-UI kapsamı)
Ortam / commit / build:       macOS Darwin 25.6.0; git repo yok (paket klasörü); Expo SDK 57.0.22, RN 0.86.3, Expo Router 57.0.21, Expo Go 57.0.9, iOS 26.5 sim "VP iPhone 17"; native binary alınmadı
İlgili şartname bölümleri:    1, 2, 6, 7, 8, 9, 10, 11, 14, 17, 19, 20, 21, 25, 26, 29 (M0/M1), 32, 33, 35
Okunan skill dosyaları:       .agents/skills/vp-product-governor, vp-design-fidelity, vp-mobile-acceptance, vp-media-rights, vp-data-security, vp-cost-observability, vp-trend-scoring (SKILL.md, tamamı; diğer 5 vp-* de okundu);
                              expo-overview, expo-project-structure, expo-router, expo-design-system, expo-native-ui, expo-ui, expo-animation, expo-dev-client, expo-data-fetching (github expo/skills @ ea892a7d, fetch/okundu, kurulmadı);
                              .claude/skills/appllama-app-design-skill (+ references/native-controls, motion, simulator-loop) ve appllama-usage (+ improve-a-screen) — kullanıcı talimatıyla `npx skills add appllama/appllama-skills` ile proje düzeyine kuruldu, okundu; Appllama MCP bağlı değil → araştırma playbook'u UNAVAILABLE
Uygulanan kurallar:           Harita-first 4 sekme; DEMO etiketi her ekranda; deny-by-default hak → link_only/unavailable medya; skor yalnız deterministik motor (packages/scoring) ile, null/stale/insufficient gerçek durum; büyük sayaç decimal string; koordinat origin=synthetic; Google anahtarı yokken Apple Maps'e düşüş yok (ADR-014); tokenlar tek kaynak (config/design-tokens.json → paket); borderCurve/boxShadow/SF Symbols/gap; tab animation none; press scale .97/120ms; formSheet modaller; misafir yerel kütüphane idempotent + plan revision (ADR-015); yalnız kullanıcı isteğiyle konum izni; canlı özellik/bütçe kapalı
Değişen dosyalar:             package.json, pnpm-workspace.yaml, .npmrc, .nvmrc, tsconfig.base.json, .gitignore, pnpm-lock.yaml, skills-lock.json, .claude/skills/appllama-*/**,
                              scripts/sync-design-tokens.mjs,
                              packages/design-tokens/**, packages/domain/**, packages/contracts/**, packages/scoring/**, packages/policy/**, packages/test-fixtures/**,
                              apps/mobile/** (app.config.ts, tsconfig.json, vitest.config.ts, .env.example, src/app/*, src/screens/*, src/components/*, src/features/*, src/lib/*, src/i18n/*, src/theme/*, src/hooks/*),
                              docs/M0_INVENTORY.md, docs/adr/ADR-013..015, docs/DECISIONS_AND_BLOCKERS.md (durum kontrolü), docs/skills-lock.md, docs/qa/reports/2026-09-11-m1-ios-fixture-ui.md, docs/qa/screenshots/2026-09-11-ios-expo-go/*, docs/pack-manifest.json (hash yenileme), docs/build-log.md
Çalıştırılan komutlar:        pnpm install; pnpm -r test (vitest); pnpm -r typecheck (tsc); npx expo install ...; npx expo install --fix; pnpm dedupe; npx expo-doctor; npx expo start --ios (Expo Go); xcrun simctl create/boot/openurl/screenshot/recordVideo/ui content_size; npx skills@latest add appllama/appllama-skills -y -a claude-code -s '*'; python3 scripts/validate_pack.py
Sonuç / ölçümler:             vitest: 6 paket + mobil = 54 test geçti (design-tokens 5, domain 14, contracts 3, scoring 13, policy 8, test-fixtures 5, mobile 6); tsc: 7 proje hatasız; expo-doctor 21/21; iOS bundle 2108 modül; 13 manuel akış GEÇTİ (bkz. QA raporu); tasarım incelemesi 25/30 (hedef 26; eksik hero/medya oranı hak+anahtar blokajından)
Kanıt dosyaları:              docs/qa/screenshots/2026-09-11-ios-expo-go/01..18 *.png, flow-recording.mov; docs/qa/reports/2026-09-11-m1-ios-fixture-ui.md
NOT_RUN testler:              Android (SDK yok); Maestro E2E (kurulu değil); VoiceOver/TalkBack dinleme; reduce-motion; offline; gerçek Google Maps jest/attribution; release build fps; RLS/API/entegrasyon testleri (M2+)
BLOCKED bağımlılıklar:        Google Maps SDK anahtarları (harita spike'ı); Supabase projesi; Apify/EnsembleData; AI sağlayıcı; Instagram izinleri; üretim bütçesi; mağaza/signing hesapları; Appllama MCP (referans araştırması)
Bir sonraki bağımsız iş:      VP-006 DB/RLS (yerel Supabase migration + negatif testler, supabase skill kurulumu) ve VP-007 saves/follows/plans API sözleşmesi; ayrıca Google anahtarı gelince `npx expo run:ios` dev build ile ADR-014 blokajını kapatma; Android SDK kurulumu
```

Ek not (aynı teslim): `scripts/validate_pack.py` artık `node_modules/.expo/.git/ios/android/dist/build` klasörlerini kapsam dışı bırakır (uygulama kodu eklenince 356 sahte JSON/MD hatası veriyordu). `docs/pack-manifest.json` 1.1'e yükseltildi; değişen belgelerin (README, build-log, skills-lock, DECISIONS, validate_pack.py) hash'leri yenilendi. `python3 scripts/validate_pack.py` → PASS.

## VP-003b / VP-004b — Google Maps iOS dev build + Apple native bileşen yükseltmesi — 11 Eylül 2026

```text
Issue / milestone:            M1 devam: gerçek harita spike'ı (iOS) + bileşen cilası (appllama + apple-design + Apple native modeller)
Ortam / commit / build:       `npx expo run:ios` Debug dev client (bundle dev.viralplaces.mobile) → VP iPhone 17 (iOS 26.5); GoogleMaps 9.4.0 pod; ExpoUI 57.0.18, ExpoGlassEffect 57.0.3 bağlı
İlgili şartname bölümleri:    6, 7, 21, 26, 29 (M1 kabul), 33
Okunan skill dosyaları:       .claude/skills/appllama-app-design-skill (SKILL + native-controls, motion, simulator-loop), appllama-usage (improve-a-screen), ~/.claude/skills/apple-design/SKILL.md (Skill tool ile yüklendi), expo-router/expo-ui/expo-animation (önceki kayıt)
Uygulanan kurallar:           Apple native modeller: NativeTabs (UITabBarController, iOS 26 Liquid Glass), native large-title UINavigationBar (Kaydedilenler/Takip/Profil/koleksiyon/plan/gizlilik/import), UISegmentedControl (@expo/ui community), UIContextMenu + peek (Link.Preview/Link.Menu), GlassView (iOS 26) yüzen kontroller, formSheet modaller; apple-design: 1:1 sürükleme, hız devri, momentum projeksiyonu (0.998), lastik bant, damping 0.8/300ms, reduce-motion fade; anti-slop: tek aksan (lacivert), emoji yok; tipografi izleme (-0.5/-0.3)
Değişen dosyalar:             apps/mobile/app.config.ts (platform bazlı Maps anahtarı), src/lib/config.ts, src/components/map/google-venue-map.tsx (onMarkerPress/identifier, topInset), src/components/glass-surface.tsx (yeni), src/components/button.tsx (glass IconButton), src/components/place-preview-card.tsx (gesture), src/app/(tabs)/_layout.tsx (NativeTabs), src/app/(tabs)/{saved,following,profile}/{_layout,index}.tsx (yeni; eski düz rotalar silindi), src/screens/{saved,following,profile,collection-detail,plan-detail,import}/*, src/screens/profile/privacy.tsx, src/screens/explore/index.tsx (glass arama, Link.Preview/Menu, tab bar payı), packages/design-tokens/src/index.ts (letterSpacing), package.json (@expo/ui, expo-glass-effect), apps/mobile/.env (kullanıcı; gitignore)
Çalıştırılan komutlar:        LANG=en_US.UTF-8 pod install; npx expo run:ios --device "VP iPhone 17"; npx expo start --dev-client; npx expo install @expo/ui expo-glass-effect; pnpm typecheck; xcrun simctl ...; log show (native hata analizi)
Sonuç / ölçümler:             iOS dev build BAŞARILI (~60 dk ilk derleme); gerçek Google haritası + açık gri stil + 7 pin + Google atfı (20-devbuild-google-map.png); marker basma düzeltildi (21); NativeTabs+glass arama (22); native large title Kaydedilenler/Takip/Profil (23-*); UISegmentedControl çalışıyor; kart sürükle-kapat çalışıyor; typecheck temiz
Kanıt dosyaları:              docs/qa/screenshots/2026-09-11-ios-expo-go/20..23 *.png
NOT_RUN testler:              Android (anahtar+SDK yok); Maestro; release build fps; VoiceOver
BLOCKED bağımlılıklar:        Android Maps anahtarı; Supabase; Apify; AI; Appllama MCP (referans araştırması)
Açık sorun:                   @expo/ui SwiftUI Host (universal List/ListItem ve swift-ui Form/Section) bu build'de render etmedi: native log "Updating props for HostView has failed: FieldInvalidTypeException"; LabeledContent RN View içinde mount uyarısı düzeltildi ama Host hatası sürdü. Profil ekranı HIG inset-grouped özel satırlarla bırakıldı; @expo/ui sürüm/native uyumu ayrı inceleme ister (ExpoUI 57.0.18 JS = pod).
Bir sonraki bağımsız iş:      Android anahtarı ile Android dev build; @expo/ui HostView hatasının minimal repro'su; M2 Supabase şeması
```

Ek not (aynı teslim, 16:20): Link.Preview/Link.Menu native peek ve bağlam menüsü iOS'ta doğrulandı (26-link-preview-context-menu.png). Link.Trigger içine stil fonksiyonlu Pressable koymak satır düzenini bozdu; statik Pressable + iç satır View ile giderildi (explore listesi, Kaydedilenler, Takip). Son kontrol: pnpm test 54/54, typecheck temiz, validate_pack PASS.

## VP-006 — Yerel Supabase: şema, PostGIS, RLS, negatif testler — 11 Eylül 2026

```text
Issue / milestone:            VP-006 DB/RLS (M2 başlangıcı)
Ortam / commit / build:       Docker Desktop 29.7.2 (daemon başlatıldı), Supabase CLI 2.117.0 (npx), Postgres 17 (yerel), PostGIS
İlgili şartname bölümleri:    10, 18, 19.3, 19.4, 20, 23, 25 (DB/RLS katmanı), 29 M2
Okunan skill dosyaları:       .agents/skills/vp-data-security; .claude/skills/supabase (SKILL.md, kurulum: `npx skills add supabase/agent-skills -y -a claude-code -s '*'`); .claude/skills/supabase-postgres-best-practices (SKILL + references/security-*.md); Supabase changelog breaking-change taraması (yerel şema için etkileyen kayıt yok)
Uygulanan kurallar:           Exposed şemada RLS+grant; TO authenticated + sahiplik USING/WITH CHECK; auth.uid() select ile sarıldı; RLS sütunlarında indeks; SECURITY DEFINER yalnız gerekçeli ve kayıtlı (map_places, handle_new_user), search_path ''; user_metadata yetki değil; Google place_id istemciye kapalı; geo/private anon'a kapalı; seed yalnız demo
Değişen dosyalar:             supabase/config.toml (init), supabase/migrations/20260911150000..150300 (4 dosya), supabase/seed.sql, supabase/tests/rls_negative.test.sql, .mcp.json (Appllama MCP kaydı), .claude/skills/supabase*, skills-lock.json, docs/adr/ADR-016
Çalıştırılan komutlar:        npx supabase init; open -a Docker; npx supabase start; npx supabase test db; npx supabase db advisors --local
Sonuç / ölçümler:             Stack ayakta (11 konteyner healthy); 4 migration + seed temiz DB'ye uygulandı; pgTAP 17/17 iddia geçti (A/B izolasyonu, owner_id sahteciliği 42501, yayımlanmamış mekan kaydı reddi, revision çakışması P0001, B'nin A planını değiştirememesi, anon private/geo erişim reddi, map_places yalnız published); advisors: sorun yok
Kanıt dosyaları:              docs/adr/ADR-016-local-supabase-and-map-rpc.md; bu kayıt
NOT_RUN testler:              Bulut Supabase (proje yok); mobil Auth akışı; misafir→hesap birleştirme; API (Next.js) sözleşme testleri
BLOCKED bağımlılıklar:        Supabase bulut projesi (ürün sahibi hesabı); Appllama MCP (oturum yeniden başlatılıp OAuth yapılmalı — .mcp.json eklendi)
Bir sonraki bağımsız iş:      VP-007 packages/api-client + mobil Supabase Auth (e-posta OTP) ve misafir kütüphanesinin idempotent birleştirilmesi; Appllama MCP ile referans-ekran araştırması
```

## VP-004c — Appllama referans araştırması + Apple HIG uygulaması — 11 Eylül 2026 (akşam)

```text
Issue / milestone:            M1/M5 UI cilası: gerçek uygulama ekranlarından kalıp çıkarımı ve uygulama
Ortam / commit / build:       iOS dev client (Google Maps), Metro dev-client; Appllama MCP bağlı (Pro, 1.481 kredi kaldı, ~19 kredi harcandı)
İlgili şartname bölümleri:    6, 7.2, 7.3, 7.4, 21.1, 26
Okunan skill dosyaları:       .claude/skills/appllama-usage (playbook: improve-a-screen, research-methods), appllama-app-design-skill, apple-design (Skill tool), ios-hig-design (wondelai, yeni kuruldu), apple-hig (nexu-io, katalog girişi), resmi Apple HIG Maps/Sheets/Tab bars/Searching metinleri (docs/research/apple-hig/*.md)
Uygulanan kurallar:           docs/research/appllama/patterns.md tablosu (Plotline/Mapstr/Rhyme/corner kalıpları) + resmi HIG kuralları tablosu; piksel değil kalıp; reddedilenler kayıtlı (FAB, pembe aksan, yıldız puanı)
Değişen dosyalar:             src/components/map/map-sheet.tsx (yeni: nonmodal sheet, peek/half detent, grabber dokunuşu), src/components/trending-strip.tsx (yeni), src/components/creator-stack.tsx (yeni), src/screens/explore/index.tsx (sheet + "Bu haritada yükselenler"), src/screens/place-detail/index.tsx (creator yığını, "Kaynaklar · N" pili → kaynaklara kaydırma, karusel noktaları, AI özeti maddelerinde @handle · platform), src/i18n/tr.ts & en.ts, .mcp.json, .claude/skills/{ios-hig-design,apple-hig}, docs/research/**
Çalıştırılan komutlar:        Appllama MCP: get_credits, list_my_boards, search_apps ×2, list_app_screens ×6, search_screens ×3; curl (29 ekran indirildi, sips ile png); curl developer.apple.com HIG JSON ×4; npx skills add ×2; pnpm typecheck; simülatör doğrulama
Sonuç / ölçümler:             typecheck temiz; Explore'da sheet + yükselenler şeridi çalışıyor (27-explore-map-sheet.png); şeritten seçim → pin + kart (28); detayda creator yığını + kaynak pili (29); Google logosu sheet'in üstünde (HIG logo kuralı)
Kanıt dosyaları:              docs/research/appllama/patterns.md, docs/research/appllama/img/*, docs/research/apple-hig/*.md, docs/qa/screenshots/2026-09-11-ios-expo-go/27..29
NOT_RUN testler:              Android; release fps; VoiceOver ile sheet detent döngüsü
BLOCKED bağımlılıklar:        Gerçek medya (foto/video) hakkı → karusel yer tutucu; kümeleme M4/M5
Bir sonraki bağımsız iş:      Arama önerileri/son aramalar (HIG Searching), pin kümeleme, creator profilinde "top curator" sayaç satırı
```

## VP-007 — Backend: public projeksiyonlar, saf pipeline, /api/v1 (Next.js), API istemcisi — 12 Eylül 2026

```text
Issue / milestone:            VP-007 (M2): backend'in uçtan uca sözleşmeli, test edilmiş hale getirilmesi
Ortam / commit / build:       Yerel Supabase (CLI 2.117, Postgres 17, PostGIS), Next.js 16.3.5 dev (port 3100), Node 22, pnpm 11, vitest 5
İlgili şartname bölümleri:    13 (ingestion/webhook), 14 (haklar), 15 (çıkarım planı), 16.1–16.3 (eşleştirme), 17 (skor projeksiyonu), 18.2, 19 (API/DTO), 20 (kütüphane), 25, 27.4 (bütçe kapısı), 32
Okunan skill dosyaları:       .agents/skills/vp-source-ingestion, vp-place-resolution, vp-evidence-extraction, vp-cost-observability, vp-data-security ("Uygulama adımları"); .claude/skills/supabase + supabase-postgres-best-practices (RLS/SECURITY DEFINER/grant); .claude/skills/nextjs-app-router-patterns (YENİ, wshobson/agents) — route.ts sözleşmesi, Promise params; vercel-labs `nextjs` skill'i bu depoda YOK (SKILLS_REGISTRY §3 uyarısı doğrulandı)
Uygulanan kurallar:           Deny-by-default hak kapısı → AI girdisi/gösterim modu; platform ID string; null≠0; caption hash'i ile tekrar AI işi yok; pinned post yeni değil; bütçe bilinmiyorsa ücretli iş yok; §16.2 ağırlıkları 0.40/0.25/0.20/0.15, auto ≥0.92 + gap ≥0.12 + ≥2 kanıt türü + coğrafi kanıt, auto-publish KAPALI; webhook secret + şema + boyut + idempotency; hata zarfı; service_role tek yerde; RLS'e güven, API'de sahiplik filtresi ekleme; SECURITY DEFINER istisnaları gerekçeli (ADR-017)
Değişen dosyalar:             supabase/migrations/20260912090000_public_projections.sql (venue_scores, venue_summaries, venue_sources, import_requests + RLS), 20260912091000_api_rpcs.sql (venue_locations_public, submit_import_request, accept_provider_event, append_plan_item), supabase/seed.sql (DEMO skor/özet/kaynak), supabase/tests/rls_negative.test.sql (plan 23); packages/pipeline/* (normalize, dedupe, extraction-planner, matcher, webhook + 5 test dosyası); packages/api-client/* (HttpApiClient + ApiClient arayüzü + test); apps/admin/* (Next.js: env, supabase istemcileri, http zarfı, auth, mappers, public-reads, 12 route.ts, unit+integration testler, .env.example); apps/mobile/src/lib/api/client.ts (canlı/demo seçimi), src/lib/config.ts (apiBaseUrl, entegrasyon durumu), .env.example; package.json (test:integration, api); .gitignore; docs/adr/ADR-017
Çalıştırılan komutlar:        npx supabase db reset; npx supabase test db; npx supabase db advisors --local; pnpm install; vitest (pipeline, api-client, admin unit, admin integration); tsc (pipeline, api-client, admin, mobile); npx next dev -p 3100 + curl smoke
Sonuç / ölçümler:             pgTAP 23/23; pipeline 20/20; api-client 4/4; admin unit 2/2; admin integration 17/17 (gerçek Supabase: A/B izolasyonu 403/404, yayımlanmamış mekan kaydı 403, plan revision 409, webhook ×3 → tek inbox/outbox, import idempotent + 21. istek 429, anon 401); advisors: sorun yok; HTTP smoke (dev server): health 200, map 7 mekan dataStatus=demo, detay skor 82 + 3 kaynak (link_only/link_only/unavailable), yayımlanmamış 404, me/* 401, webhook 401; typecheck temiz (admin, pipeline, api-client, mobile)
Kanıt dosyaları:              docs/adr/ADR-017-api-layer-and-idempotency.md; apps/admin/tests/integration/*.test.ts; supabase/tests/rls_negative.test.sql; bu kayıt
NOT_RUN testler:              Mobil uygulamanın canlı istemciyle simülatör turu (EXPO_PUBLIC_API_BASE_URL ile; bu teslimde ayarlanmadı); Next.js production build; yük/oran sınırı testi; JWKS yerel doğrulama; gerçek Apify payload replay (fixture yok — hesap yok)
BLOCKED bağımlılıklar:        Apify/EnsembleData hesabı (webhook ucu hazır, gerçek run yok); AI sağlayıcı (planlayıcı hazır, model çağrısı yok); içerik hakları (tüm DEMO kaynaklar link_only/unavailable); Supabase bulut projesi; çok-instance oran sınırı altyapısı; Trigger.dev (outbox tüketicisi yok — satırlar birikir, tüketici M3)
Bir sonraki bağımsız iş:      Outbox tüketicisi (provider_event → normalize → dedupe → planner → review_tasks) + Apify fixture replay testi; place_detail tek RPC; mobil Supabase Auth (e-posta OTP) + misafir kütüphanesinin /me'ye idempotent birleştirilmesi; simülatörde canlı istemci turu
```

## Ortam kurtarma — dev build yeniden alındı, DEMO modda simülatör turu — 13 Eylül 2026

```text
Issue / milestone:            Bakım (kod değişikliği yok): "uygulamayı aç" isteği; M1/M2 durumu değişmedi
Ortam / commit / build:       macOS Darwin 25.6.0; git repo yok; simülatör "VP iPhone 17" (iOS 26.5) yeniden oluşturuldu; `npx expo run:ios --no-bundler` Debug dev client yeniden derlendi (pod install + xcodebuild ≈ 20 dk, 0 hata / 4 uyarı); Metro `--dev-client` 8081
İlgili şartname bölümleri:    10 (ortam), 29 M1 kabul, 33 (blokajlar)
Okunan skill dosyaları:       — (yalnız README, build-log, DECISIONS_AND_BLOCKERS, M0_INVENTORY, apps/mobile/src/lib/config.ts ve api/client.ts okundu)
Uygulanan kurallar:           .env değerleri okunmadı/yazılmadı (yalnız anahtar adları listelendi); kullanıcının symlink/offload düzeni değiştirilmedi; canlı servis açılmadı
Değişen dosyalar:             docs/build-log.md (bu kayıt). Kaynak kod değişmedi.
Çalıştırılan komutlar:        pnpm test (80/80 geçti, 10 paket); pnpm typecheck (temiz); xcrun simctl create/boot; npx expo run:ios --device "VP iPhone 17" --no-bundler; npx expo start --dev-client --port 8081; xcrun simctl openurl (dev client deep link)
Sonuç / ölçümler:             Uygulama simülatörde açıldı: gerçek Google haritası (İstanbul), 7 DEMO pin, DEMO rozeti, kapsam uyarısı, "Bu haritada yükselenler" şeridi; kart → pin seçimi + önizleme kartı + Kaydet çalışıyor. iOS bundle 2011 modül.
Kanıt dosyaları:              Bu kayıt (ekran görüntüsü dosyaya kaydedilmedi; 11.09 QA görüntüleriyle aynı ekranlar)
Ortam bulguları:              (1) 12.09 akşamı ~/.expo, ~/.dotnet, ~/.nuget vb. "/Volumes/MacOffloadVault" harici diskine symlink'lenmiş; disk takılı değilken Expo CLI `mkdir ~/.expo` ENOENT ile çöküyor (eski Metro süreci de bu yüzden manifest 500 veriyordu). Geçici çözüm: Metro ve build `__UNSAFE_EXPO_HOME_DIRECTORY=<yerel klasör>` ile başlatıldı; symlink'e dokunulmadı. (2) /Applications/Docker.app → "/Volumes/Mac-External-Apps" symlink'i; disk takılı değil → yerel Supabase ve /api/v1 başlatılamadı. (3) ~/Library/Developer/Xcode/DerivedData ve ios/Pods silinmişti; yeniden üretildi. (4) apps/mobile/.env içindeki EXPO_PUBLIC_API_BASE_URL=http://192.168.1.17:3100 canlı istemciyi seçtiğinden (API kapalı) harita şehir olmadan mount edilmiyor; bu oturumda Metro süreç ortamında değişken boş verilerek FixtureApiClient (DEMO) kullanıldı, .env düzenlenmedi.
NOT_RUN testler:              Canlı /api/v1 + yerel Supabase ile simülatör turu (Docker yok); Android; Maestro; VoiceOver
BLOCKED bağımlılıklar:        MacOffloadVault ve Mac-External-Apps disklerinin takılması (ürün sahibi); ardından `npx supabase start` + `pnpm api` ile canlı mod. Diğer blokajlar 12.09 ile aynı.
Bir sonraki bağımsız iş:      VP-007 kaydındaki liste geçerli (outbox tüketicisi, place_detail RPC, mobil Supabase Auth, canlı istemci turu). Ayrıca: klasörü git'e almak (yedek yok).
```

## VP-008 → VP-013 (kısmi) — Veri/AI motoru: sağlayıcı araştırması, adaptörler, outbox worker, çıkarım, eşleştirme, skor — 13–14 Eylül 2026

```text
Issue / milestone:            VP-008 provider contract (adaptörler + araştırma), VP-009 rights engine entegrasyonu (worker kapıları), VP-010 extraction (Claude, sahte model ile test), VP-011 branch resolution (Places + matcher + review), VP-012 review queue (RPC + admin API), VP-013 snapshots+score (cohort + orchestrator). M3/M4 kod tamam; canlı koşu BLOCKED/NOT_RUN.
Ortam / commit / build:       macOS; git repo yok; Node 22, pnpm 11.2.2 (allowBuilds: esbuild), vitest 5, TypeScript 6; @anthropic-ai/sdk (pipeline), postgres 3.4 + tsx (worker). Docker/yerel Supabase kullanılamadı (harici disk).
İlgili şartname bölümleri:    12, 13 (13.2 adaptör, 13.3 program, 13.4 dedupe, 13.5 webhook, 13.6 hata), 14, 15 (15.2–15.6), 16 (16.1–16.4), 17 (17.2–17.6), 18.3, 19.2 (admin/internal uçları), 27.4, 29 M3/M4
Okunan skill dosyaları:       claude-api (Skill tool; typescript/claude-api/README.md + tool-use.md structured outputs); .agents/skills vp-source-ingestion, vp-evidence-extraction, vp-place-resolution, vp-trend-scoring, vp-media-rights, vp-cost-observability (Explore ajanı özetiyle, kurallar uygulandı)
Araştırma:                    docs/research/social-data-access.md — TikTok (Research/Display/oEmbed resmi; ScrapeCreators, Apify, EnsembleData, Bright Data, Lamatok, TokApi, TikAPI) ve Instagram (Graph Business Discovery, oEmbed, Basic Display kapanışı; Apify, EnsembleData, HikerAPI, ScrapeCreators, Bright Data, Data365) uçları, alanları, fiyatları, medya URL süreleri, transkript yolları, hukuk (hiQ, Meta v. Bright Data, X v. Bright Data, Meta 2025 şartları, TikTok ToS, GDPR/EDPB 03/2026, KVKK 5/2-d). Karar: birincil ScrapeCreators, yedek Apify; Instagram resmi Business Discovery + konum için ScrapeCreators.
Uygulanan kurallar:           Platform ID string (safeJsonParse büyük tamsayıları korur; hassas olmayan sayısal ID reddedilir); sağlayıcı JSON'u normalize sınırında; secret'lar header'da ve hata/log'da redakte; 403/login engeli aşılmaz; hak kapısı her adımda (may_collect_metadata/may_store_metrics/may_send_metadata_to_ai/may_create_derived_summary/may_store_thumbnail); native video/kare yolu kapalı; AI: system ↔ güvenilmeyen zarf ayrı, tool yok, code point offset doğrulaması, tek onarım, refusal → review, prompt_version/model_id/input_hash/usage audit; aynı content hash için ikinci ücretli iş yok (idempotency key post+hash); bütçe: limit/birim bilinmiyorsa ücretli iş yok, rezervasyon+uzlaştırma+lease TTL, hak silme muaf; Google: en dar alan maskesi, yalnız coğrafi ipucuyla, cache ≤30 gün CHECK, place_id ayrı; matcher .40/.25/.20/.15, auto-publish kapalı → review; skor saf kod, cohort yüzdelik, admin skor yazamaz; queue: SKIP LOCKED + lease, backoff, dead-letter; retry çarpanı yok (sağlayıcı hatası hesap programında).
Değişen dosyalar:             packages/pipeline/src/{normalize.ts (locationTag/hashtags/thumbnail/shortcode, provider enum), normalize-instagram.ts, normalize-tiktok-aweme.ts, budget.ts, scheduler.ts, import-url.ts, discovery.ts, score-orchestrator.ts, adapters/{types,apify,scrapecreators,ensembledata,instagram-graph,fixture}.ts, ai/{extraction-schema,extractor,summarizer}.ts, places/google-places.ts, index.ts}, packages/pipeline/package.json (+@anthropic-ai/sdk), 8 yeni test dosyası;
                              apps/worker/** (package.json, tsconfig, src/{main,env,db,adapters,fixtures,budget-gate}.ts, src/handlers/{types,ingest,poll,extract,resolve,venue,import-maintenance,index}.ts, tests/worker-pure.test.ts, .env.example);
                              apps/admin/src/lib/admin-auth.ts, src/app/api/v1/admin/{review-tasks,review-tasks/[id]/decision,creators,jobs,budget}/route.ts, tests/unit/admin-auth.test.ts, .env.example (ADMIN_API_TOKEN);
                              supabase/migrations/20260913120000_engine_tables.sql (extraction_runs, place_mentions, post_transcripts, google_places_cache, normalization_cohorts, venue_score_runs, budget_days/reservations, cost_events, creator_discovery_candidates, takedown_requests; source_posts/creator_monitoring/provider_runs/job_outbox/review_tasks genişletmeleri; RPC: claim_outbox_jobs, finish_outbox_job, enqueue_job, decide_review_task, purge_expired_places_cache, admin_*), supabase/seed.sql (demo-synthetic/user-import hak kayıtları, demo izleme), supabase/tests/engine.test.sql;
                              package.json (worker scriptleri), pnpm-workspace.yaml (allowBuilds esbuild), pnpm-lock.yaml; docs/research/social-data-access.md, docs/adr/ADR-018-ingestion-ai-engine.md, README.md, docs/DECISIONS_AND_BLOCKERS.md, docs/pack-manifest.json, docs/build-log.md
Çalıştırılan komutlar:        pnpm --filter @viral-places/pipeline add @anthropic-ai/sdk; pnpm install; npx tsc --noEmit (pipeline, worker, admin); npx vitest run (pipeline, worker, admin unit); pnpm test; pnpm typecheck; python3 scripts/validate_pack.py
Sonuç / ölçümler:             pnpm test: 27 dosya / 126 test geçti (pipeline 60, worker 5, admin unit 3, diğerleri değişmedi); pnpm typecheck: 12 proje hatasız; validate_pack: bkz. son satır. Sahte model ile: geçerli çıkarım → ok; excerpt uyuşmazlığı → tek onarım → invalid; refusal → refused; UTF-16 offset reddi; 3 sağlayıcı normalizer'ı + 4 adaptör HTTP sözleşmesi (sayfalama, 429 retryable, secret redaksiyonu, webhook şablonu) testli; bütçe kapısı (unset/onaysız/günlük/aylık/iş başına/muaf), dispatcher (lease/concurrency/backoff), skor (uygunluk, cohort yüzdelik, stale, determinizm) testli.
Kanıt dosyaları:              packages/pipeline/src/__tests__/*.test.ts, apps/worker/tests/worker-pure.test.ts, apps/admin/tests/unit/admin-auth.test.ts, docs/research/social-data-access.md, docs/adr/ADR-018-ingestion-ai-engine.md
NOT_RUN testler:              supabase/migrations/20260913120000 uygulaması ve supabase/tests/engine.test.sql (pgTAP 15 iddia) — Docker yok; worker'ın gerçek DB ile koşusu (pnpm worker:once); admin entegrasyon testleri (yeni admin uçları için henüz yazılmadı); gerçek Claude çağrısı (anahtar yok); gerçek sağlayıcı çağrıları ve §13.1 contract spike (hesap yok); Google Places gerçek isteği; Instagram App Review.
BLOCKED bağımlılıklar:        ScrapeCreators/Apify/EnsembleData hesapları ve birim fiyat doğrulaması; Anthropic anahtarı; Google Places anahtarı + fiyat; IG profesyonel hesap + App Review; bütçe onayı (pipeline-policy.approvedBy); hak kayıtları için hukuki onay (GDPR/KVKK/ToS özeti araştırmada); Docker (Mac-External-Apps diski); Trigger.dev kararı.
Bir sonraki bağımsız iş:      (1) Diskler takılınca: npx supabase db reset + npx supabase test db (engine.test.sql) + VP_DATA_MODE=demo pnpm worker:once ile fixture uçtan uca koşu ve admin review kararı; (2) admin uçları için entegrasyon testleri; (3) Idempotency-Key + body hash 409 (§19.4); (4) creator başvuru/keşif akışı (discoverCreators → creator_discovery_candidates → CreatorFit) için admin ucu; (5) ScrapeCreators 100 ücretsiz kredi ile şema doğrulaması (gerçek response fixture'ı) — ürün sahibi hesabı açarsa.
```

## VP-014 — Harita pinleri: ekran-uzayı kümeleme, kısa skor rozeti, aynı-nokta seçim listesi — 14 Eylül 2026

```text
Issue / milestone:            VP-014 — §7.2 pin/küme davranışı. QA 11.09 açık kusuru "Cihangir/Beyoğlu pinleri üst üste (kümeleme M4/M5)" ürün sahibi seçimiyle öne alındı. Klasör aynı gün git'e alındı (d217fb6, github.com/cettocdx/viral-places, private).
Ortam / commit / build:       macOS Darwin 25.6.0; main d217fb6 üzerine; simülatör "VP iPhone 17" (iOS 26.5); 13.09 tarihli Debug dev client (dev.viralplaces.mobile) + çalışan Metro `expo start --dev-client` 8081 (EXPO_PUBLIC_API_BASE_URL boş → FixtureApiClient DEMO); Node 22, pnpm 11.2.2, vitest 5, TypeScript 6; react-native-maps 1.27.2 PROVIDER_GOOGLE (iOS anahtarı .env'de, değer okunmadı).
İlgili şartname bölümleri:    7.2 (pin, kısa skor rozeti, yoğun alanda küme, aynı koordinatta seçim listesi), 7.8 (VenueMarker/ClusterMarker sözleşmesi), 6.3 (tokenlar), 19.3 (MapClusterItemDto), 21.1 (attribution/padding)
Okunan skill dosyaları:       .agents/skills/vp-product-governor/SKILL.md, .agents/skills/vp-design-fidelity/SKILL.md, .agents/skills/vp-mobile-acceptance/SKILL.md; design/references/01-map.png, 02-place-detail.png, 03-creator-profile.png görsel olarak açıldı.
Uygulanan kurallar:           Referans 01'deki "Viral Skoru 98" uzun etiketi yerine §7.2 kısa rozet (sayı + trend alevi); rozet yalnız zoom ≥ 11 ve görünür pin ≤ 12 iken, seçili pinde her zaman; skor yoksa rozet yok. Küme pini tek aksan (lacivert), kategori rengi silinmedi. Yakınlaşınca da ayrışmayan mekanlar (zoom 18'de ≤ 44 pt) yakınlaştırma yerine seçim listesi açar. Sunucu kümeleri (MapClusterItemDto) artık keşfet ekranında atılmıyor, dokununca +2 zoom. Marker görünümü sabit genişlik + anchor: rozet açılınca pin koordinattan kaymaz. DEMO yüzey aynı saf çekirdeği kendi izdüşümüyle kullanır. Kümeleme saf modül, deterministik, RN'siz test. Fixture'a eklenen mekan "Demo " önekli, sentetik, skor < 90. Erişilebilirlik: küme etiketi "N mekan bir arada/aynı noktada…", seçim kartı satırları role=button.
Değişen dosyalar:             apps/mobile/src/lib/map-cluster.ts (yeni) + map-cluster.test.ts (11 test); apps/mobile/src/components/map/{venue-marker.tsx, google-venue-map.tsx, demo-venue-map.tsx, map-types.ts}; apps/mobile/src/components/map/cluster-selection-card.tsx (yeni); apps/mobile/src/screens/explore/index.tsx (serverClusters, clusterPick durumu, kart yerleşimi); apps/mobile/src/i18n/{tr,en}.ts (+4 anahtar: explore.clusterA11y, clusterSameSpotA11y, clusterHere, clusterHint); packages/test-fixtures/src/demo-dataset.ts (demo-venue-008 "Demo Çatı Bar Karaköy", Karaköy kafeyle aynı koordinat); docs/qa/screenshots/2026-09-14-map-clusters/01–04; docs/qa/reports/2026-09-14-map-clusters.md; docs/build-log.md
Çalıştırılan komutlar:        npx vitest run (apps/mobile 17/17; packages/test-fixtures 5/5); npx tsc --noEmit (apps/mobile); pnpm test (11 paket, 137 test geçti); pnpm typecheck (temiz); python3 scripts/validate_pack.py (508 geçti / 0 hata); xcrun simctl terminate/launch booted dev.viralplaces.mobile (soğuk başlatma ×4); xcrun simctl io booted screenshot; curl ile Metro bundle içeriği doğrulandı.
Sonuç / ölçümler:             iOS simülatör, gerçek Google haritası, DEMO fixture (8 mekan): (1) şehir zoom 11,79 → Taksim/Cihangir/Karaköy×2 tek "4" kümesi; Balat 71 ve Sultanahmet 51 rozetleri; skorsuz Nişantaşı rozetsiz. (2) Kümeye dokunma → fitToCoordinates → zoom 14,20; Cihangir 73, Karaköy 🔥82 rozetleri; Beyoğlu barı skorsuz. (3) Karaköy'deki aynı koordinatlı iki mekan "2" kümesi olarak kaldı → dokununca "Bu noktada 2 mekan" kartı: "Demo Kafe Karaköy · Viral Skoru 82" ve "Demo Çatı Bar Karaköy · Veri birikiyor". (4) Satır seçimi → önizleme kartı; küme pini seçili görünüme (büyük) geçti. Google marker snapshot'ları (tracksViewChanges=false, key ile yeniden mount) görünür; kümeleme O(n²), ≤ 200 öğede ölçülebilir gecikme yok.
Kanıt dosyaları:              docs/qa/screenshots/2026-09-14-map-clusters/01-city-zoom-clusters-and-badges.png, 02-cluster-tap-fit-labels.png, 03-same-spot-selection-card.png, 04-pick-from-list-preview-card.png; docs/qa/reports/2026-09-14-map-clusters.md; apps/mobile/src/lib/map-cluster.test.ts
NOT_RUN testler:              Android (SDK yok); DemoVenueMap küme yolu cihazda (anahtar olduğundan Google yüzeyi çalıştı; yalnız typecheck); sunucu kümesi (MapClusterItemDto) render/dokunma — fixture ve yerel API küme üretmiyor; VoiceOver ile küme/kart okuması; Maestro; release build fps; creator profili mini haritasında küme davranışı (aynı bileşen, görsel kontrol yapılmadı).
BLOCKED bağımlılıklar:        Değişmedi (13–14.09 kayıtları). Docker/yerel Supabase takılı değil → canlı /api/v1 ile tur NOT_RUN.
Ortam bulguları:              (1) Dev client Metro'ya `hot=false` ile bağlı → Fast Refresh yok; `viralplaces://expo-development-client/?url=…` derin bağlantısı yalnız "Open" onayı gösteriyor, bundle'ı yeniden yüklemiyor. Güncel kod için `xcrun simctl terminate` + `launch` gerekti; Metro'nun güncel kodu sunduğu curl ile ayrıca doğrulandı. (2) Google iOS'ta fitToCoordinates edgePadding'i mapPadding ile toplanıyor; başlık+sheet kadar büyük pay verilince kamera hareket etmedi → sabit 48 pt pay, geri kalanı mapPadding.
Bir sonraki bağımsız iş:      (1) Ürün sahibi listesindeki diğer UI kalemleri: önizleme kartına mesafe/açıklama satırı, kapsam uyarısını tek satır pill'e küçültme, detay istatistik etiketlerinin sarması; creator profiline "paylaştığı yerler" ve kaynaklı "tarzı" bölümleri (§7.4). (2) Maestro akışı: harita→küme→liste→mekan→kaydet. (3) Sunucu tarafı kümeleme (admin /api/v1/map/places düşük zoom) ile MapClusterItemDto yolunun gerçek doğrulaması. (4) Küçük: seçim kartı açıkken kameranın kümeyi görünür tutması (kart pini kısmen örtüyor).
```

## Ortam kurulumu — taze klon, Xcode 27 uyumu, boşluklu yol düzeltmeleri, gerçek Google haritası — 18 Eylül 2026

```text
Issue / milestone:            Bakım (ürün kodu değişmedi): github.com/cettocdx/viral-places taze klonu yeni makine kurulumunda dev build alınamadı; M1 harita kabulü aynı makinede yeniden doğrulandı
Ortam / commit / build:       macOS Darwin 25.6.0; main b67bc29 üzerine; Node 22.23.2 (brew node@22, keg-only → PATH), pnpm 11.2.2 (npm -g), CocoaPods 1.17 (brew), Xcode 27.0 (27A266a) + iOS 27.0 runtime; simülatör "Viral Places iPhone 17" (0AC21DBE-…, ürün sahibi oluşturdu; "Brevier iPhone 17 Pro" başka projeye ait, dokunulmaz); Expo Go 57.0.9 (DEMO tur) → Debug dev client dev.viralplaces.mobile; Metro 8081
İlgili şartname bölümleri:    10 (ortam), 21.1 (Google harita), 23.1 (anahtar repo'ya yazılmaz), 29 M1 kabul, 33
Okunan skill dosyaları:       — (README, AGENTS.md, build-log, DECISIONS_AND_BLOCKERS, ADR-014, §29; expo/fyi ios-scene-lifecycle.md; expo/expo #46664, #50026)
Uygulanan kurallar:           .env değeri ajan tarafından okunmadı/yazılmadı (yalnız satırın dolu olduğu grep ile doğrulandı; ürün sahibi anahtarı sohbete yapıştırdığı için açığa çıkmış sayılır → iptal/yenileme önerildi); Apple Maps'e düşüş yok (ADR-014); pnpm minimumReleaseAge politikası gevşetilmedi — `expo install --fix`'in eklediği 57.0.24 istisnaları geri alındı, politikaya uyan 57.0.23 sabitlendi
Değişen dosyalar:             apps/mobile/app.config.ts (+ expo-build-properties ios.enableSceneSupport=true; + ./plugins/with-quoted-bundle-script.js); apps/mobile/plugins/with-quoted-bundle-script.js (YENİ: "Bundle React Native code and images" betiğindeki ters tırnaklı react-native-xcode.sh çağrısını "$( … )" ile tırnaklar); apps/mobile/package.json (expo ~57.0.23, expo-build-properties 57.0.20); patches/expo-constants@57.0.18.patch (YENİ: podspec script_phase yolu + PROJECT_ROOT tırnaklandı; get-app-config-ios.sh `basename "$PROJECT_DIR"`); pnpm-workspace.yaml (patchedDependencies); pnpm-lock.yaml; docs/build-log.md (bu kayıt). apps/mobile/.env (gitignore) ürün sahibince oluşturuldu.
Çalıştırılan komutlar:        git clone; npm i -g pnpm@11; brew install node@22 cocoapods; pnpm install; pnpm typecheck; expo start (Expo Go, DEMO yüzey doğrulandı); npx expo run:ios --device <UDID> ×5; pod install; pnpm patch/patch-commit; pnpm --filter @viral-places/mobile add expo@57.0.23 expo-build-properties@57.0.20; npx expo prebuild --platform ios --no-install; pnpm --filter @viral-places/mobile typecheck
Sonuç / ölçümler:             (1) Expo Go: DEMO harita yüzeyi + 8 fixture mekan, kümeleme, rozetler çalışıyor. (2) Dev build ilk 3 deneme: boşluklu proje yolu ("…/Viral Places/…") → expo-constants script_phase "No such file: …/Viral" (podspec `bash -l -c "$PODS_TARGET_SRCROOT/…"`) ve Expo şablonu bundle betiği (ters tırnak) aynı hatayla düştü → patch + config plugin ile geçti. (3) 4. deneme: derleme + kurulum OK, açılışta "Application failed to launch: UIScene life cycle is required" (Xcode 27 SDK; Expo 57.0.22 sahne üretmiyor). (4) expo 57.0.23 + enableSceneSupport + prebuild (Info.plist UIApplicationSceneManifest → EXExpoAppSceneDelegate; AppDelegate startReactNative kaldırıldı; react-native-maps init korundu) → uygulama açıldı: gerçek Google haritası (İstanbul, Google atfı), DEMO rozeti, 71/51 rozetleri, "4" kümesi, yükselenler şeridi. Mobil typecheck temiz.
Kanıt dosyaları:              Bu kayıt (ekran görüntüleri oturum scratchpad'inde; docs/qa'ya kopyalanmadı). apps/mobile/plugins/with-quoted-bundle-script.js; patches/expo-constants@57.0.18.patch
NOT_RUN testler:              pnpm test (tam takım, bu oturumda yalnız mobil typecheck); Android; canlı /api/v1 + yerel Supabase turu (Docker açılmadı); Maestro; VoiceOver
Ortam bulguları:              (1) Klasör adındaki boşluk Expo/RN build betiklerini iki noktada kırıyor; kalıcı çözüm klasörü boşluksuz ada taşımak (ör. viral-places) — açık oturumu bozacağı için yapılmadı, plugin+patch ile geçildi. (2) iPhone hotspot'unda Expo Go indirme ve pnpm registry istekleri çok yavaş (bir istek 89 dk); Wi-Fi'a geçince düzeldi. (3) `pnpm patch-commit` ve `pnpm add` çıktı vermeden uzun süre çalışıyor — takılma değil, ağ bekleme. (4) Expo SDK 58'e geçince enableSceneSupport kaldırılmalı (no-op + uyarı). (5) Claude simülatör panelinin ekran görüntüsü bu cihazda captureFailed veriyor; `xcrun simctl io <UDID> screenshot` çalışıyor.
BLOCKED bağımlılıklar:        Değişmedi (13–14.09 kayıtları). Google Maps iOS anahtarı bu makinede .env'de (LIMITED-OPEN, ADR-014); açığa çıkan anahtarın iptali ürün sahibinde.
Bir sonraki bağımsız iş:      VP-014 kaydındaki liste geçerli. Ayrıca: bu değişiklikleri commit etmek; klasörü boşluksuz yola taşıma kararı; Expo SDK 58 (sahne desteği yerleşik) yükseltme değerlendirmesi.
```

## M3 ilk canlı koşu — yerel Supabase, OpenRouter, ScrapeCreators; 10 pilot creator; 2 forward-fix migration — 19 Eylül 2026

```text
Issue / milestone:            M3 "tek kaynaktan gerçek dikey veri akışı" ilk gerçek koşu (VP-008/009/010/013 kodu canlıda); sonuç: çekim→çıkarım OK, eşleştirme Google Places anahtarı olmadan BLOCKED
Ortam / commit / build:       main b67bc29 + çalışma ağacı; Colima Docker (6 GiB) + Supabase CLI 2.117 minimal stack (db, kong, auth, rest; studio/analytics/vector/storage kapalı — tam stack sağlık kontrolünde düşüp Colima'yı kapattı); Next.js admin :3100; worker VP_DATA_MODE=live; OpenRouter (ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN, model anthropic/claude-opus-5); ScrapeCreators API; Apify token (yedek, kullanılmadı)
İlgili şartname bölümleri:    12 (creator keşfi), 13 (adaptör/program), 14 (haklar), 15 (çıkarım), 16.3 (aday arama — Places), 19.2 (admin uçları), 27.4 (bütçe kapısı), 29 M3 kabul
Okunan skill dosyaları:       — (kod: apps/worker/src/{main,env,adapters,budget-gate,handlers/*}, packages/pipeline/src/{ai/extractor,adapters/scrapecreators,budget}, supabase/migrations/20260913120000; OpenRouter Claude Code entegrasyon dokümanı)
Uygulanan kurallar:           Anahtarlar yalnız apps/worker/.env ve apps/admin/.env.local (gitignore); ajan anahtar değerlerini okumadı/yazmadı, yalnız satır doluluğu ve önek kontrolü (ürün sahibi iki anahtarı sohbete yapıştırdı → açığa çıkmış sayılır, yenileme önerildi). Hak kaydı deny-by-default: scrapecreators-pilot (meta veri, metrik, transkript-AI, özet, embed, kaynak bağlantısı açık; medya indirme/rehost/medya-AI kapalı; 90 gün). Bütçe: config/pipeline-policy.json günlük 5 / aylık 50 / iş 0.25 USD, 60 gönderi/gün, video dakikası 0; autoPublish kapalı. pnpm minimumReleaseAge gevşetilmedi (expo istisnaları geri alındı).
Değişen dosyalar:             packages/pipeline/src/ai/extractor.ts (normalizeModelId: "anthropic/…" slug → fiyat tablosu) + __tests__/extractor.test.ts (+1 test); supabase/migrations/20260919090000_fix_admin_upsert_monitored_creator.sql (RETURNS TABLE OUT parametre/kolon adı çakışması → #variable_conflict use_column); supabase/migrations/20260919091000_budget_reservation_text_id.sql (budget_reservations.id uuid→text; worker "poll-<uuid>" bileşik kimlik üretir); supabase/tests/engine.test.sql (plan 15→18: onaylı hak kaydıyla upsert lives_ok + izleme satırı + id tipi); apps/worker/.env.example (OpenRouter satırları); config/pipeline-policy.json (YENİ, pilot; maxConcurrentCreatorRuns 5); docs/build-log.md. DB (yerel): rights_policies scrapecreators-pilot; 10 creator (admin API POST /admin/creators, x-admin-token).
Çalıştırılan komutlar:        npx supabase start (-x studio,logflare,vector,mailpit,edge-runtime,imgproxy,storage-api,postgres-meta,realtime,supavisor); npx supabase migration up --local ×2; npx supabase test db; pnpm test:integration; pnpm api; OpenRouter duman testi (messages.parse + zodOutputFormat + adaptive thinking + cache_control → OK, usage.cost döner); ScrapeCreators keyword keşfi ×3 + profil ×10; worker:once (demo ×3, live ×12; .env `set -a; source` ile — worker .env'i kendisi yüklemez); pnpm test; pnpm typecheck
Sonuç / ölçümler:             pgTAP 41/41 (engine 18 + rls 23); admin entegrasyon 17/17; pipeline 61/61; harita API 7 demo mekan. Keşif: 3 sorgu → 65 aday; seçilen 10 (foodguidee_, geztopya, gurmerehber, geziyoruzsu, yemekvetatil, istanbul_rehberii, gezintimag, 1gezi1yemek, istanbuldanereyegidilir, konumneresi; 5–38k takipçi, hepsi açık). Canlı: 2 creator × 30 gönderi = 60 source_posts, 20 extraction_runs (16 ok / 4 invalid: evidence_excerpt_mismatch, evidence_span_missing), 11 place_mentions (ör. Manhattan Cafe Kadıköy, Food and Juice Üsküdar +adres, Lokanta Yoğurt Altunizade, Taico Kadıköy, Chappal Yeniköy; 1 Antalya), 1 transkript. Maliyet: 2.61 USD / 20 çıkarım (0.05–0.23 USD/gönderi, opus-5 medium). Eşleştirme: 8 mention.resolve → tümü unresolved:no_candidates (Google Places anahtarı yok → yalnız kendi 8 demo kaydı taranıyor); review_tasks yalnız 4 extraction_invalid.
Kanıt dosyaları:              supabase/migrations/20260919090000, 20260919091000; supabase/tests/engine.test.sql; packages/pipeline/src/__tests__/extractor.test.ts; yerel DB private.extraction_runs / place_mentions / cost_events / budget_days (2026-09-18: 2.607 USD, 20 gönderi)
NOT_RUN testler:              Apify adaptörü canlı; Instagram; Google Places araması; skor/cohort gerçek veriyle (yeterli snapshot yok); mobilde canlı istemci turu (EXPO_PUBLIC_API_BASE_URL ayarlanmadı); Maestro
BLOCKED bağımlılıklar:        Google Places API (New) anahtarı + PRICE_GOOGLE_PLACES_USD_PER_1K (eşleştirme adayı; §16.3) — ürün sahibi; model kararı (opus-5 → bütçe ~50 gönderi/gün; sonnet-5 önerildi); hukuki danışman onayı (hak kaydı ürün sahibi onayıyla, danışmansız); açığa çıkan anahtarların yenilenmesi
Durum notu:                   26 post.extract işi run_after=+1 gün ile ertelendi (model/bütçe kararı bekleniyor; geri almak için: update private.job_outbox set run_after = now() where kind='post.extract' and status='pending'). poll.dispatch 5 dk'lık idempotency dilimiyle tetiklenir; maxConcurrentCreatorRuns 5.
Bir sonraki bağımsız iş:      (1) Places anahtarı gelince mention.resolve'u yeniden kuyruklayıp review_tasks + admin karar + mobil DTO zincirini doğrulamak; (2) extraction_invalid oranını (%20) düşürmek: excerpt eşleşmesi için prompt/onarım iyileştirmesi; (3) worker'a --env-file/.env yükleme ve JOB_KINDS filtresi (yalnız resolve gibi ücretsiz işleri koşturabilmek); (4) OpenRouter usage.cost ile gerçek maliyet uzlaştırması; (5) creator dispatch sonrası kalan 8 hesabın ilk taraması.
```

## M3 devam — Sonnet'e geçiş, Google Places açıldı, eşleştirici kalibrasyonu, ilk inceleme görevleri — 19 Eylül 2026 (gece)

```text
Issue / milestone:            M3: çekim→çıkarım→eşleştirme→insan incelemesi zinciri ilk kez uçtan uca (onay adımı ürün sahibinde)
Ortam / commit / build:       Aynı yerel yığın; VP_EXTRACTION_MODEL=anthropic/claude-sonnet-5 (OpenRouter); GOOGLE_PLACES_API_KEY + PRICE_GOOGLE_PLACES_USD_PER_1K=32 (.env, ürün sahibi yazdı)
İlgili şartname bölümleri:    16.2 (ağırlıklar .40/.25/.20/.15, "eval sonrası değişecek eşikler"), 16.3 (Places Text Search, cache-first), 22 (insan incelemesi), 27.4
Uygulanan kurallar:           Eşikler (auto ≥0.92, review ≥0.80) ve ağırlıklar değişmedi; yalnız özellik hesapları düzeltildi. autoPublish kapalı: hiçbir eşleşme insan kararı olmadan yayına girmedi. Places cache-first (27 kayıt, 18 istek).
Değişen dosyalar:             packages/pipeline/src/matcher.ts — (1) şehir ipucu ilçe ise (Kadıköy/Beşiktaş) adayın mahallesiyle eşleşince çelişki değil + alan puanı; (2) alan: adres ipucu mahalle/ilçe adını kelime olarak içeriyorsa eşleşir (tam eşitlik yerine); (3) kategori bilinmiyorsa null (yeniden ağırlıklandır); (4) nameSimilarity: coğrafi/şube kelimeleri (İstanbul + ilçe/semt listesi, normalizeBase + ı/i katlaması) atılır, kapsama ("ÇiÇi Beşiktaş"↔"Çi Çi") 0.9, sıkıştırılmış karşılaştırma ("daliburgeristanbul"), handle alt dizi eşleşmesi ("holecoffeeco"↔"Hole Coffee & Matcha Co."); packages/pipeline/src/__tests__/matcher.test.ts (+3 test); docs/build-log.md
Çalıştırılan komutlar:        OpenRouter duman testi (sonnet-5 OK); worker:once ×~20 (Sonnet çıkarım 10 gönderi; mention.resolve yeniden kuyruklama :places1..4 — enqueue_job run_after ile); vitest (pipeline 64/64)
Sonuç / ölçümler:             Sonnet: 0.060 USD/gönderi ort. (opus 0.111 ok / 0.195 invalid); bütçe günü 3.23 USD (30 gönderi) + Places 18 istek ≈ 0.58 USD. Eşleştirme: Places öncesi 27/27 no_candidates → Places sonrası (kalibrasyon öncesi) 3 review / 24 unresolved → kalibrasyon sonrası 10 review_required / 17 unresolved. review_tasks(mention_resolution)=10: Lokanta Yoğurt ×2 (.85), Chappal (.85), Manhattan (.85), Çi Çi (.85), Limon Lokal (.85), Hole Coffee (.81), JF Food and Juice (.81), Wood Coffee Beylikdüzü (.81), Ryo Matcha (.81). 9 taslak (draft, live) mekan oluştu. Kalan 17: 7 city_mismatch (ör. Heybeliada/Adalar, Antalya), 5 low_score+tek kanıt türü, permanently_closed 2.
Kanıt dosyaları:              packages/pipeline/src/__tests__/matcher.test.ts; yerel DB private.review_tasks / place_mentions.resolution / google_places_cache
NOT_RUN testler:              Onay sonrası zincir (decide_review_task → venue.refresh → skor → /api/v1/map → mobil) — onay ürün sahibinde; Maestro; Android
BLOCKED bağımlılıklar:        Ürün sahibi onayı (10 görev); hukuki onay; açığa çıkan anahtar yenilemeleri
Bir sonraki bağımsız iş:      (1) onay sonrası venue.refresh + skor + harita API doğrulaması ve mobil canlı istemci (EXPO_PUBLIC_API_BASE_URL); (2) city_mismatch için ilçe→şehir çözümü (Adalar/Heybeliada, kapsam matrisi); (3) extraction_invalid oranı; (4) kalan 8 creator'ın ilk taraması (dispatch 5 dk aralık)
```

## VP-015 (kısmi) — Kaynak medya deneyimi: kapak görseli, beğeni, resmi TikTok gömme oynatıcısı, creator profil alanları — 19 Eylül 2026 (sabah)

```text
Issue / milestone:            Ürün sahibi isteği: "mekanın resmi olmalı, kim koydu görünmeli, izlenme/beğeni/takipçi, creator resmi + TikTok adresi, video onun sayfasında dönmeli". M5 medya deneyiminin hak-uyumlu ilk dilimi.
İlgili şartname bölümleri:    7.3/7.4 (kaynak kartı, creator kimliği), 14.2 (official_embed; yeniden barındırma yok), 14.1 (may_store_thumbnail ayrı hak), 8 (dürüst metrik: null ≠ 0)
Uygulanan kurallar:           Video DOSYASI indirilmez/yeniden barındırılmaz: oynatma yalnız TikTok'un resmi gömme oynatıcısında (WebView, embed URL beyaz listesi; diğer gezinmeler sistem tarayıcısına). Kapak görseli yalnız may_store_thumbnail=true iken URL referansı olarak gösterilir (ürün sahibi kararıyla pilotta açıldı; dosya kopyalanmaz). Avatar yalnız kaynak gösterilebilir moddayken. Takipçi/bio "gözlemlendi" etiketiyle (platformFollowers.observedAt). Beğeni null olabilir; 0 gösterilmez.
Değişen dosyalar:             supabase/migrations/20260919100000_creator_profile_and_source_likes.sql (creator_accounts: avatar_url/follower_count/post_count/bio/profile_observed_at; venue_sources: likes); packages/contracts (SourcePostDto.likes opsiyonel); packages/pipeline adapters/types+scrapecreators (fetchCreator: avatarUrl/bio); apps/worker db.ts (likes projeksiyonu, updateCreatorProfile, rezervasyon PK çakışmasında tazeleme), handlers/poll.ts (profil çekimi tarama ÖNCESİ + 24s aralık + bütçe kapılı; bütçe blokajı sağlayıcı hatası sayılmaz → hesap devre dışı kalmaz, budget_deferred), handlers/venue.ts (likes); apps/admin mappers.ts (likes, avatar, bio, platformFollowers, officialEmbedUrl → tiktok.com/embed/v2/<id>); apps/mobile: components/tiktok-embed-player.tsx (YENİ), source-video-card.tsx (thumbnail Image, oynat rozeti, beğeni), place-detail (hero thumbnail + oynat + embed etiketi), i18n (+8 anahtar); react-native-webview 13.16.1 (expo install, prebuild).
Sonuç / ölçümler:             Simülatörde doğrulandı: JF Food and Juice detayında gerçek TikTok kapak görseli hero'da, "Resmi TikTok oynatıcısı · @foodguidee_" etiketi, oynat → sayfa içi resmi TikTok embed (video + kalp sayacı + Watch now), altında "621 izlenme · 9 beğeni" ve hak notu, "TikTok üzerinde aç". Çerez bildiriminde isteğe bağlı çerezler reddedildi. venue_sources: 10/10 likes + thumbnail. Testler 141/141, typecheck temiz. İki canlı-koşu hatası düzeltildi: (1) bütçe aşımı poll hatası sayılıp 10 hesabı otomatik devre dışı bırakmıştı; (2) rezervasyon PK çakışması (yeniden denemede) → on conflict tazeleme.
NOT_RUN / BLOCKED:            Avatar/takipçi/bio çekimi: ScrapeCreators kredisi bitti ("payment required") → ürün sahibi kredi yükleyince ilk taramada dolacak (kod hazır, cost_events provider.profile_failed×10 kanıt). Skor hâlâ insufficient_data (3 gönderi/2 creator şartı) — dürüst durum. Thumbnail URL'leri TikTok CDN süreli olabilir; yenileme metrics.refresh/poll döngüsüne bağlanmadı (sonraki iş).
Bir sonraki bağımsız iş:      (1) ScrapeCreators kredi sonrası: profil alanlarının dolduğunu ve creator ekranını simülatörde doğrulamak; (2) thumbnail süresi dolunca tazeleme; (3) commit (değişiklikler hâlâ çalışma ağacında); (4) kalan 8 creator ilk taraması (bütçe yarın açılır); (5) İkinci el thumbnail için venue_sources.rank>0 karuseli.
```

## UI sadeleştirme turu — trend kartı, özet, creator sayfası düzeni, gerçek görseller — 19 Eylül 2026

```text
Issue / milestone:            Ürün sahibi geri bildirimi (ekran görüntülü): "Nasıl hesaplandı çıksın; creator sayfasında üstte kimlik, hemen altında oynatılabilir videolar; Neden konuşuluyor sadeleşsin; AI/doğruluk ibaresi ve yıldız ikonlar kalksın; önizleme kartında çatal-kaşık yerine mekanın görseli."
Değişen dosyalar:             apps/mobile/src/components/trend-evidence-card.tsx (onExplain/`Nasıl hesaplandı?` kaldırıldı; rozet başlık satırına, üç sayı tek kutuda, ikonlar yok); screens/place-detail (özet başlığı "Öne çıkanlar", sparkle ikonu ve AI ibaresi kaldırıldı; SummaryRow ikonsuz); i18n tr/en (place.summary*, nötr derleme notu); screens/creator-profile (Paylaşımlar bölümü haritanın ÜSTÜNE taşındı; sparkle kaldırıldı; bio/takipçi satırları veri yokken gizli); components/place-preview-card + trending-strip (thumbnailUrl varsa expo-image ile gerçek görsel, yoksa kategori yer tutucusu).
Sonuç:                        Simülatörde doğrulandı: önizleme kartında video karesi; detayda sade trend kartı + kaynaklı "Öne çıkanlar"; creator sayfasında kimlik → 3 oynatılabilir video (621/12,1K/2K izlenme, beğeniler) → harita. Mobil test 17/17, typecheck temiz. Marka logosu bilinçli eklenmedi: logo varlığı/hakkı yok; mekan görseli creator videosunun karesi. Avatar hâlâ baş harf: ScrapeCreators kredisi bekleniyor (kod hazır).
Bir sonraki bağımsız iş:      Kredi sonrası avatar doğrulaması; trend-explainer route'unun ve CLAIM_ICON'un ölü kod temizliği; commit.
```

## 2026-09-28 — İstanbul otorite creator keşfi (≥300k)

Okunan skill'ler:              .agents/skills/vp-creator-coverage/SKILL.md, .agents/skills/vp-product-governor/SKILL.md
Ortam:                         Colima kaldırılmış → yerel DB kaybı; Supabase Docker Desktop'ta sıfırdan (10 migration + seed). rights_policies scrapecreators-pilot 19.09 onaylı izinlerle yeniden oluşturuldu (bitiş 2026-12-18).
Değişen dosyalar:              scripts/discover-creators.mjs (YENİ), docs/evidence/creator-discovery-2026-09-28/creator-discovery.json (YENİ)
Komut:                         set -a; . apps/worker/.env; set +a; node scripts/discover-creators.mjs docs/evidence/creator-discovery-2026-09-28
Kriter:                        takipçi ≥300k (profil ucu), son paylaşım ≤21 gün ve 90 günde ≥8 gönderi, son ~20 videoda ≥10 İstanbul+mekan/yemek gönderisi (caption/POI regex), herkese açık.
Sonuç:                         36 keyword + 9 kullanıcı sorgusu → 1186 tekil yazar → 64 eşik adayı doğrulandı; 272 kredi (~0.51 USD). Geçen: yemedengezme, gurmegorelim, hsdfoods1 → izlemeye alındı (enabled, worker çalıştırılmadı). Elenen: kokorecitekinusta (işletmenin kendi hesabı, bağımsız otorite değil), kesfedenler_kulubu (9 konu gönderisi, 90g 6 — sınırda), iambiggroove (yabancı gezgin, İstanbul odaklı değil).
Sınırlar:                      Arama tabanlı örneklem; eksiksiz kapsam iddiası değildir. Konu uyumu regex sezgisi, AI doğrulaması NOT_RUN.

## 2026-09-28 — Eşik 100k + Instagram hesapları

Komutlar:                      VP_MIN_FOLLOWERS=100000 node scripts/discover-creators.mjs docs/evidence/creator-discovery-2026-09-28-100k (476 kredi); node scripts/link-instagram.mjs … yemedengezme gurmegorelim hsdfoods1 gezi_meps
Sonuç:                         7 geçen; 3'ü işletmenin kendi hesabı (kokorecitekinusta, konyaliferdiusta, koheymuranaga) → otorite değil, eklenmedi. Yeni eklenen TikTok: gezi_meps (115k, 16/20 konu).
Instagram (ürün sahibi isteği): yemedengezme (657k, kanıt: TikTok bio IG'yi anıyor), gurmegorelim (596k, kanıt: IG bio TikTok'a link) aynı creator kaydına bağlandı; hak kaydı scrapecreators-pilot-ig; policy features.instagramEnabled=true (bayrak worker'da henüz uygulanmıyor). gezi_meps IG (692k, "Ali Özsoy") karşılıklı atıf yok → eklenmedi. hsdfoods1 IG bulunamadı.
Değişen dosyalar:              scripts/link-instagram.mjs (YENİ; Türkçe İ düzeltmesi), config/pipeline-policy.json, docs/evidence/creator-discovery-2026-09-28-100k/*

## 2026-09-28 — Geniş keşif (80 sorgu, 80 video/aday) + toplu ekleme

Komut:                         VP_MIN_FOLLOWERS=100000 node scripts/discover-creators.mjs docs/evidence/creator-discovery-2026-09-28-wide (3066 yazar → 243 aday; 2269 kredi ≈ 4.3 USD)
Script değişikliği:            video örneklemi 20 → en fazla 80 (≥10 konu gönderisinde erken durur; kriter "toplam ≥10"), 44 yeni ilçe/mutfak sorgusu, arama 3 sayfa, likelyBusiness işareti.
Eklenen (ürün sahibi "hepsini ekle"): rotani_benimle_belirle, yildiz_turkmen, ayhanmortepe, uuygunadimdoga, gezyedoy, duslerdeistanbul, meshuryemek, chefstoryweb, gezen1ciftt, firatkalkan_, gurmegunlugu, lezzetipanya, ahmetaytas34, ozcan.yuce, milliyiyici, mrdossodossi, dogandmc, harbiyiyorumcom.
Elenen (geçti ama işletme/kurum): alsultan_sweets, hasanustakebap, this.is.ilyas (TÜRSAB acente), turkiyekulturyolu (festival resmi hesabı), sultanterrace (adres bio), kokorecitekinusta.
Instagram (kanıtlı bağ): meshuryemek, gezyedoy, rotani_benimle_belirle, gezen1cift, gurmegunlugu_, ahmetaytas34, milliyiyici, dogandmc. Kanıtsız (eklenmedi): gezi_meps, ayhanmortepe, duslerdeistanbul, chefstoryweb, lezzetipanya. link-instagram.mjs: "Instagram 365k" sayısı handle sanılmasın diye filtre + ayrı yazılmış @mention desteği.
Durum:                         22 creator / 32 hesap (22 TikTok + 10 Instagram) izlemede; worker çalıştırılmadı.

## 2026-09-28 — Instagram keşfi + eşiğe yakınlar

Eşiğe yakın (ürün sahibi onayı): gencomert (196k, 9/79), nael.alshater (129k, 9/80) TikTok'tan eklendi.
Komut:                         node scripts/discover-instagram.mjs docs/evidence/creator-discovery-2026-09-28-instagram <mevcut IG handle'ları> (YENİ script; reels araması 44 sorgu×3 sayfa → 516 hesap → 112 eşik+bağımsız → gönderi doğrulaması; 1295 kredi ≈ 2.4 USD; eşzamanlılık 6)
Geçen 10; eklenen 6: istbucketlist, shebso.eats, gastrogezgin, postcards_from_istanbul, tiebowtie, yemekneredeyenircom (yemek keşif medyası). Elenen: turkish_medicals (sağlık turizmi), istanbulturkiye.explore (otel satan acente), festivaller (etkinlik medyası, yemek değil), tersaneistanbul (gayrimenkul projesi). 37 işletme hesabı kategori/bio ile otomatik elendi (meta.businessExcluded).
Durum:                         30 creator / 40 hesap (24 TikTok + 16 Instagram) izlemede, hak kayıtları scrapecreators-pilot / scrapecreators-pilot-ig. Worker çalıştırılmadı. Günlük keşif maliyeti toplam ≈ 4,340 kredi ≈ 8.2 USD.

## 2026-10-02 — Harita bbox düzeltmesi + İstanbul 50 creator

Harita:                        API 2°'den geniş bbox'ı BBOX_TOO_LARGE ile reddediyordu → uzaklaşınca harita boş. MAX_BBOX_DEG=40 (dünya ölçeği hâlâ red). Canlıda zoom 6–13 hepsi 37 mekan döndü (vercel deploy --prod, ürün sahibi çalıştırdı). İstemci limit 200, İstanbul arama bbox'ı metropol.
Keşif:                         discover-creators.mjs paralel doğrulama (6), ara kayıt (partial.json), arama sonucu önbelleği (VP_REUSE_SEARCH), VP_SKIP_HANDLES. 50k eşik: TikTok 2959 yazar → 285 doğrulandı (≈2621+ kredi; ilk iki koşu zaman sınırına takıldı); Instagram 516→160 doğrulandı (1544 kredi).
Seçim:                         26 bağımsız aday puanlandı (0.45 İstanbul mekan payı, 0.35 medyan izlenme, 0.20 takipçi); ilk 20 eklendi (14 TikTok + 6 IG), vetting approved. Yedek 6: bogazisi, enes, kanadalibuse, foodieeda, dahacokgezicez, aysegulyildirimdan.
Elenen (işletme/kurum/konu dışı): kokorecitekinusta, gallantgalata, hafizmustafa1864, hasanustakebap, burakkurufasulye, tarihipasahankonagi, remzikomur, oubaialdarra, travelwithusman23, iambiggroove, igairport, mo_istanbul, colife.istanbul, numero.istanbul vb. burakozdemer (CZN Burak, restoran sahibi) ürün sahibi kararına bırakıldı.
Bağlama (kanıtlı):             istbucketlist TikTok (bio IG'yi anıyor), shebsoeats TikTok (bio birebir aynı) mevcut IG creator'larına.
Durum:                         50 creator / 62 hesap (40 TikTok + 22 IG). Gönderiler henüz işlenmedi.

## 2026-10-02 — Çok şehir altyapısı + İstanbul 56 / Paris 21

Migration 20261002120000_multi_city (yerelde uygulandı, test: city_for_point(48.86,2.35)=Paris, city_by_name('Milan')=Milano): cities.aliases/radius_km/default_language; Paris, Milano, Londra, Barselona, Roma (coverage none); creator_vetting.home_city_id (İstanbul işaretlileri taşındı).
Kod: /api/v1/cities, noktaya göre kapsam, eşleştirme şehir yedeği = creator ana şehri, api-client şehir kutusu, mobil şehir seçici + Türkçe bulunma eki (test), keşif VP_CITY + config/city-discovery.json (şehir başına 44–56 sorgu).
İstanbul: yedek 6 eklendi → 56 creator / 68 hesap (hedef 50 ✓).
Paris keşfi: 1420 yazar → 141 doğrulandı (1119 kredi), 38 geçti; 21 bağımsız eklendi (home_city Paris). Elenen işletmeler: billsburgerfr, mr.mrs_crab, bigsmashfrance, maisonkayser, mrbeefofficiel, yescrabrestaurant, afriknfusion, outlist.co; konu dışı: hellofrenchnyc, mylifeasjul, sergioexplores.
BLOCKED: ScrapeCreators kalan 1785 kredi (4 şehir keşfi + gönderi çekimi ≈15k kredi gerekir); OpenRouter ≈20 USD. Yeni şehirler kullanıcıya kapalı (coverage none) — API deploy + OTA bekliyor.

## 2026-10-03 — Onay + yayın + buluta aktarım (TestFlight 37 → 89)

Ürün sahibi 57 mekanlık listeyi onayladı: 83 mention decide_review_task ile approve (hata 0); 2 kategori düzeltmesi. rebuild-published → venue.refresh (worker) → yerelde 57 live published.
apps/worker/src/cloud-sync.ts (YENİ): Place ID ve hesap kimliğiyle eşlemeli aktarım, tek transaction, varsayılan deneme. Deneme: 57 mekan (23 bulutta vardı → yayına açıldı, 34 yeni), 3 creator, 10 hesap, 83 kaynak. İlk --apply "sync_upsert is not unique" ile geri alındı (iki aşırı yükleme) → üçüncü parametre açık → başarılı.
Doğrulama: canlı API map/places 89 mekan (food 75, coffee 11, nightlife 2, shopping 1); yeni mekan detayı (Parlar Pastanesi) 25 kaynak + özetle açılıyor.
Açık: bulutta 20261002120000_multi_city uygulanmadı (şehir seçici tek şehre düşüşle çalışıyor); creator_vetting tablosu bulutta yok (yalnız yerelde karar); TikTok kapak URL'leri imzalı, birkaç gün sonra düşebilir (rehost-media gerekebilir).

## 2026-10-25 — Referans odaklı keşif arayüzü (VP-UI-019)

İstek: Ürün sahibi UI'ı Andrey Rybin'in “Places, Map & Pins” referansına yaklaştırmak istedi. §6–8/21/26, M5; karar ADR-019. Gece haritası, fotoğraf destekli sticker pinleri/kümeler, kategori etiketleri ve seçili halka, kompakt arama/filtreler, yüzen kart, erişilebilir liste ve detay üst kontrol kontrastı uygulandı. Geç yüklenen küçük görsel için native yeniden çizim; eksik görsel için dürüst kategori yedeği. Seçili pin kümeden ayrılır; büyük yazıda kartın üzerinde tutulur.

Okunan skill'ler: vp-product-governor, vp-design-fidelity, vp-mobile-acceptance, vp-media-rights; resmi Expo overview/design-system/native-ui/ui/animation + launch-without-dev-menu (uzaktan okuma, commit d5caf7fdf8b4854351f05841a7e315ac87ad7d24, kurulum yok); kurulu Vercel react-best-practices. Ayrıntılı yollar QA raporunda.

Değişen kaynaklar:
- `apps/mobile/src/app/(tabs)/_layout.tsx`
- `apps/mobile/src/components/button.tsx`
- `apps/mobile/src/components/category-chip.tsx`
- `apps/mobile/src/components/glass-surface.tsx`
- `apps/mobile/src/components/map/demo-venue-map.tsx`
- `apps/mobile/src/components/map/map-sheet.tsx`
- `apps/mobile/src/components/map/map-types.ts`
- `apps/mobile/src/components/map/native-venue-map.tsx`
- `apps/mobile/src/components/map/venue-marker.tsx`
- `apps/mobile/src/components/place-preview-card.tsx`
- `apps/mobile/src/components/save-button.tsx`
- `apps/mobile/src/components/trending-strip.tsx`
- `apps/mobile/src/i18n/en.ts`
- `apps/mobile/src/i18n/tr.ts`
- `apps/mobile/src/screens/explore/index.tsx`
- `apps/mobile/src/screens/place-detail/index.tsx`
- `apps/mobile/src/theme/index.ts`
- `config/design-tokens.json`
- `docs/PACK_VALIDATION.md`
- `packages/design-tokens/src/index.ts`
- `packages/design-tokens/src/tokens.generated.ts`

Ek belgeler: ADR-019; docs/qa/reports/2026-10-25-reference-map-ui.md; docs/qa/screenshots/2026-10-25-map-ui/*.png.

Gerçek komutlar/sonuçlar: pnpm install --frozen-lockfile; pnpm test (150 PASS); pnpm typecheck (PASS); son mobil testleri 18 PASS ve mobil typecheck PASS; tokens sync/check PASS; git diff --check PASS. Node 22 geçici npm runtime'ı kullanıldı. Native: Expo Go/iPhone 17/iOS 26.5; küme yakınlaştırma, pin/kart seçimi, kaydet→koleksiyon, detay→geri, Karaköy araması + kategori + boş durumdan temizleme; large ve extra-extra-extra-large yazı kontrolü. Expo Go tanıtım/araç düğmesi süreçlik launch seçenekleriyle kapatıldı, yazı boyutu geri yüklendi.

BLOCKED: canlı şehir/mekan API'si INTERNAL hata döndürdü; UI geliştirme DEMO verisiyle sürdü. Gerçek thumbnail yükleme/hata smoke, Android, dar cihaz, VoiceOver, reduce-motion cihaz testi ve release performansı NOT_RUN. Bu kayıt native/release kapılarının tümünü VERIFIED saymaz. Production/OTA yayını, worker veya ücretli veri toplama yapılmadı. Kanıt ve bilinen sınırlar QA raporunda.

Paket bütünlüğü: İlk kontrol 511 PASS / 2 FAIL (değişen token/build-log dosyalarında eski hash). Doküman kararı AGENTS.md ve ana şartname §6 girişine işlendi. docs/pack-manifest.json güncel içerik ve yeni ADR/QA kanıtları için yenilendi; validator kontrolleri değiştirilmedi. Son paket sonucu docs/PACK_VALIDATION.md içindedir.

## 2026-10-27 — Pin üstü kart ve sticker pinler (VP-UI-020)

İstek: Ürün sahibi pinlerin ve dokununca açılan kartların Andrey Rybin "Places, Map & Pins" videosundakiyle birebir aynı olmasını istedi. Karar ADR-020. Video indirildi ve kare kare incelendi (yerel kopya repoya eklenmedi).

Değişen kaynaklar:
- `apps/mobile/src/components/map/venue-marker.tsx`
- `apps/mobile/src/components/map/sticker-text.tsx` (YENİ)
- `apps/mobile/src/components/map/place-callout.tsx` (YENİ)
- `apps/mobile/src/components/map/native-venue-map.tsx`
- `apps/mobile/src/components/map/demo-venue-map.tsx`
- `apps/mobile/src/components/map/map-types.ts`
- `apps/mobile/src/lib/callout-layout.ts` (YENİ) ve test
- `apps/mobile/src/screens/explore/index.tsx`
- `apps/mobile/src/i18n/tr.ts`, `en.ts`
- `config/design-tokens.json`, `packages/design-tokens/src/tokens.generated.ts`

Önce: bulut Supabase `exceed_storage_size_quota` ile kısıtlıydı; /cities ve /map/places INTERNAL veriyordu. Storage'ı rehost-video ile kopyalanmış 335 mp4 (4,64 GB) dolduruyordu. Ürün sahibi organizasyonu Pro plana geçirdi; uçlar 13:24'te açıldı (İstanbul 64, Paris 31 canlı mekan, 65 şehir). mp4'lerin `may_rehost_video: false` kuralıyla çelişmesi açık konu.

Gerçek komutlar/sonuçlar: pnpm test (167 PASS, mobil 35); pnpm typecheck (PASS, 11 paket); tokens --check PASS; git diff --check PASS. Native: Expo Go / iPhone 17 / iOS 26.5, canlı API (`EXPO_PUBLIC_API_BASE_URL`, .env gitignore'da). Ağrı ve İstanbul'da pin → önizleme → detay → "Daha fazla" (15,5K beğeni / 520K izlenme sayaçları) → boş haritaya dokunarak kapatma denendi. Ekranlar: docs/qa/screenshots/2026-10-27-callout/ (detay ve tam hal ekranları kuyruk düzeltmesinden öncedir).

NOT_RUN: Android, VoiceOver, büyük yazı, reduce-motion, release performansı, video oynatma kart içinde (dokunma denenmedi). Bilinen: Expo Go'da dokunuşlar 1–3 sn gecikmeli işlendi; şehir listesi kapsam eşitliğinde alfabetik sıralandığı için uygulama "Ağrı" ile açılıyor (65 pilot şehir, çoğu alakasız).


## 2026-10-27 — Kart içi video, yüzen fotoğraf kartları, 15 şehir (VP-UI-020b)

İstek (ürün sahibi): video şeritten dokununca ikinci düğme olmadan, kartın tamamında ve TikTok arayüzü olmadan oynasın; alttaki beyaz "Bu haritada keşfet" sayfası daha estetik olsun, kartlardaki kategori etiketi kalksın; şehir seçici yalnız İstanbul, Paris, Londra, Milano, New York, Los Angeles, Madrid, Barselona, Roma, Floransa, Ankara, Lizbon, İzmir, Tokyo, Amsterdam olsun, gerisi kalksın.

- `components/map/callout-video.tsx` (YENİ): seçilen video kartı kaplar (9:16, kartın en büyük yüksekliğiyle sınırlı), sessiz başlar ve döngüde oynar; kapat, duraklat ve ses düğmeleri. `sourcePlayback(..., { bare: true })`: TikTok resmi oynatıcısı, kendi belgelenmiş parametreleriyle (controls, progress_bar, description, music_info… = 0, autoplay=1, loop=1). Oynatıcı kırpılmaz ve üstüne kod enjekte edilmez; mesaj protokolü değişmedi.
- `components/map/map-carousel.tsx` (YENİ): beyaz alt sayfa yerine haritada yüzen beyaz çerçeveli fotoğraf kartları ve koyu cam "Bu haritada keşfet · N" düğmesi (listeyi açar). Küme seçim listesi sayfada kaldı. Harita artık sayfa yüksekliğini beklemeden çizilir.
- `packages/api-client/src/featured-cities.ts` (YENİ): seçili 15 şehir, verilen sırayla, İstanbul varsayılan; ad varyantı eşleşmesi, yerel etiket (Firenze → Floransa). Sunucudaki diğer şehir kayıtları silinmedi, yalnız istemcide gizlendi. Lizbon için veritabanında şehir yok; veri gelene kadar listede görünmez.

Gerçek komutlar/sonuçlar: pnpm test 168 PASS (mobil 36, api-client 7); typecheck PASS; git diff --check PASS. Native (Expo Go, iPhone 17, canlı API): şehir listesi 15 şehirle sınırlı ve sıralı; yüzen kartlar; Kafe Ara → detay → video kartın tamamında oynadı (duraklat düğmesi göründü).

Bilinen sınır: TikTok resmi oynatıcısı sağdaki beğeni/yorum/paylaşım sayaçlarını ve TikTok logosunu belgelenmiş parametrelerle gizlemiyor; video kenarlarında oynatıcının bulanık dolgusu görünüyor. Tamamen arayüzsüz oynatma ancak dosyanın kendisiyle (`licensed_native`, `may_rehost_video` hakkı) mümkün; bu karar ürün sahibinde. NOT_RUN: ses aç/kapat ve duraklat düğmelerinin TikTok oynatıcısındaki etkisi, Android, VoiceOver.

## 2026-10-27 — Gece baskısı (VP-UI-021)

İstek: Ürün sahibi tüm arayüzün daha çekici ve yaratıcı olmasını istedi. Karar ADR-021.

Değişenler: `app/_layout.tsx` (her zaman koyu), `app.config.ts` (`userInterfaceStyle: dark`), `packages/design-tokens/src/index.ts` (koyu palet harita ailesine), `app/(tabs)/_layout.tsx`, `components/map/{venue-marker,native-venue-map,map-carousel,map-types,callout-video}.tsx`, `components/cover-card.tsx` (YENİ), `components/state-views.tsx`, `screens/{explore,place-detail,saved}/index.tsx`.

Gerçek komutlar/sonuçlar: pnpm test 168 PASS; typecheck PASS. Native (Expo Go, iPhone 17, canlı API): Keşfet'te ilk kartın pini (Nardis Jazz Club) kümeden ayrılıp vurgulandı; Kaydedilenler kapak kartları; Takip Ettiklerin boş durumu; Kızılkayalar detayında fotoğraflı üst alan ve dokununca video oynadı. Ekranlar: docs/qa/screenshots/2026-10-27-night/.

NOT_RUN: gerçek build'de native denetimlerin koyu görünümü, Profil ve koleksiyon/plan detay ekranlarının görsel kontrolü, Android, VoiceOver, büyük yazı.

## 2026-10-27 — Gece baskısı: profil, koleksiyon/plan detayı, başlık (VP-UI-021b)

İstek: Profil, koleksiyon ve plan detay ekranları ile Keşfet'teki şehir seçici ve kategori çipleri de yeni dile uyarlansın.

- `components/place-photo-card.tsx` (YENİ): harita kartları, koleksiyon ve planların ortak beyaz çerçeveli fotoğraf kartı.
- Koleksiyon detayı: iki sütunlu fotoğraf kartları, çıkarma köşede; sayaç etiketi. **Düzeltme:** kayıtları seçen zustand seçicisi her render'da yeni dizi döndürüyordu ve ekran "Maximum update depth exceeded" ile çöküyordu (önceden var olan hata); seçici sabit, filtre `useMemo`'da.
- Plan detayı: tarih/durak/saat dilimi etiketleri, kategori renginde numaralı sticker duraklar, kesik rota çizgisi, fotoğraflı durak kartları, cam taşı/yol tarifi/çıkar düğmeleri. Kaydedilenler'de planlar da kapak kartları.
- Profil: sticker avatar, cihazdaki gerçek sayaçlar (kayıt, koleksiyon, plan, takip), renkli ikon kareli ayar satırları.
- Keşfet başlığı: şehir beyaz sticker hap (konum dairesi + yuvarlak kalın ad; ters yazılı logo hap içinden kaldırıldı); haritadaki kategori çipleri ince, renkli ikon daireli, kısa etiketli; seçili çip beyaz.
- **Düzeltme:** `getPlacesByIds` tüm şehirleri kapsayan tek harita kutusuyla soruyordu; şehirler kıtalara yayılınca kutu 40° sınırını ve 200 sonucu aşıyor, kayıtlı mekanlar "bulunamadı" görünüyordu. Artık her mekan `/places/:id` ile; bulunamayan atlanır (testli).

Gerçek komutlar/sonuçlar: pnpm test PASS (api-client 8, mobil 36); typecheck PASS. Native (Expo Go, iPhone 17, canlı API): Profil, Kaydedilenler/Planlar kapakları, plan detayı (Kızılkayalar Taksim fotoğraflı durak), koleksiyon detayı (DEMO'dan kalan kayıt "bulunamadı" kartı + çıkar), yeni başlık ve çipler. Simülatörde test için yerel bir gün planı oluşturuldu.

NOT_RUN: birden çok duraklı planda sıralama düğmeleri, koleksiyonda gerçek fotoğraflı kartlar (simülatördeki koleksiyonda canlı mekan yok), Android, VoiceOver, büyük yazı.

## 2026-10-27 — Reels akışı (VP-UI-022)

İstek: "Bu haritada keşfet" Instagram Reels gibi tam ekran dikey video akışı olsun; durup mekan sayfasına gidilebilsin; keşfetten haritaya dönüş görünür olsun. Karar ADR-022.

Değişenler: `components/reels/reels-feed.tsx` (YENİ), `components/map/callout-video.tsx` (kapat isteğe bağlı, ses tercihi taşınır), `screens/explore/index.tsx` (liste modu → reels, indeks korunur), i18n `reels.*`.

Gerçek komutlar/sonuçlar: pnpm test PASS; typecheck PASS. Native (Expo Go, iPhone 17, canlı İstanbul): akış açıldı, dikey kaydırmayla Kafe Ara ve Kızılkayalar videoları kendiliğinden oynadı; "Mekanı gör" → mekan sayfası → geri aynı sayfaya döndü; "‹ Harita" görünür.

Bilinen: TikTok logosu ve sayaçları resmi oynatıcıda kalıyor; Instagram kaynağı (Nardis Jazz Club) yalnız kapak olarak göründü; video önbelleği yok. NOT_RUN: Android, VoiceOver, uzun akışta bellek/performans.

## 2026-10-27 — Dosyadan, önbellekli video oynatma (VP-UI-023)

İstek ve karar ADR-023 (ürün sahibi riski kabul etti). Ayrıca beğeni/yorum sayıları kaldırıldı; yalnız izlenme ve creator adı.

Değişenler: `apps/mobile/package.json` + `pnpm-lock.yaml` (`expo-video ~57.0.5`; pnpm kurulumu ağdaki diğer platform ikilileri yüzünden takıldı, paket `npm pack` ile alındı ve lock'taki sha512 ile birebir doğrulandı), `components/map/file-video.tsx` (YENİ), `components/map/callout-video.tsx`, `components/reels/reels-feed.tsx`, `lib/source-playback.ts` (+2 test), `lib/config.ts`, `screens/place-detail/index.tsx`, `components/{source-video-card,tiktok-embed-player}.tsx`, `components/map/place-callout.tsx`.

Gerçek komutlar/sonuçlar: pnpm test PASS (mobil 38); typecheck PASS. Native (Expo Go, iPhone 17, canlı İstanbul): reels'te Kafe Ara, Kızılkayalar, Barış Büfe dosyadan oynadı, ekranda TikTok öğesi yok; kaydırma sonrası ~1 sn içinde oynuyor; mekan detayında dosya oynadı, @gencomert etiketi görünür. Düzeltme: geri dönüştürülen sayfalarda serbest bırakılmış oynatıcıya `pause` çağrısı çöküyordu, çağrılar korundu.

Not: Kızılkayalar ve Barış Büfe aynı TikTok videosuna bağlı (veri). NOT_RUN: uçak modunda önbellekten oynatma, uzun akışta bellek, Android, gerçek cihaz.
- Ek (VP-UI-023): mekan detayında video, oynat düğmesine basılmadan açılışta kendiliğinden başlar (ürün sahibi isteği); simülatörde Kızılkayalar ile doğrulandı.

## 2026-10-27 — Kart önizlemesinde video, referans geçişleri (VP-UI-020c)

İstek: pine basınca açılan kartta fotoğraf yerine video kendiliğinden oynasın; kart geçişleri ve kalitesi referansla (Andrey Rybin videosu, kullanıcı aynı dosyayı tekrar gönderdi, sha256 aynı) birebir olsun. Referans 0:07.6–0:12 arası 10 fps kare kare incelendi.

- Önizleme: kaynağın dosyası sessiz döngüde, dokunuşlar karta geçer (`FileVideo ambient`), creator etiketi sol üstte.
- Açılış: kart pinden ~%30 ölçekten hafif yaylanarak büyür.
- Önizleme → detay: dikey eksende kart çevirme (rotateY 0→90°, içerik değişir, −90→0° yay).
- Detay metni aşağıdan solarak belirir.
- Tam hal: kuyruk kaybolur, sağ üstte aşağı ok (detaya döner), uzun metin alta doğru solar, izlenme hapı köşeden zıplayarak gelir.

Doğrulama: typecheck PASS, mobil 38 test PASS. Simülatör kaydı (iPhone 17) 12 fps karelerle: çevirme, metin belirmesi ve tam hal görüldü (docs/qa/screenshots/2026-10-27-night/callout-flip-frames.jpg). NOT_RUN: gerçek cihazda akıcılık, reduce-motion.

## 2026-10-27 — Temiz harita (VP-UI-024)

İstek: kart hâlâ referanstaki gibi değil, ekran çok kalabalık. Karar ADR-024. Değişenler: `screens/explore/index.tsx`, `components/map/place-callout.tsx`, `components/map/file-video.tsx`, i18n `explore.filters`. `map-carousel.tsx` artık kullanılmıyor (dosya duruyor).

Doğrulama: typecheck PASS, mobil 38 test PASS. Native (iPhone 17, canlı İstanbul): yeni harita ekranı, Nobu Istanbul önizleme (video, @gencomert alt başlıkta) ve detay hali (şerit + soluk kategori). Ekranlar: docs/qa/screenshots/2026-10-27-night/{explore-clean,callout-clean-preview,callout-clean-expanded}.png. Not: filtre düğmesi simülatörde Expo Go'nun geliştirici dişlisinin altında kalıyor (yalnız geliştirmede).
- Ek (VP-UI-024b): haritada sekme çubuğu gizlendi, sağ üstte avatar menüsü (Kaydedilenler/Takip/Profil). Simülatörde: menü → Kaydedilenler (sekme çubuğu görünür) → Keşfet → harita (sekme çubuğu yok) doğrulandı. Ekranlar: explore-no-tabs.png, explore-menu.png.

## 2026-10-27 — Kontroller ve sayfalar (VP-UI-025)

Karar ADR-025. Değişenler: `components/map/map-controls.tsx` (YENİ), `components/segmented.tsx` (YENİ), `screens/explore/index.tsx`, `screens/saved/index.tsx`, `screens/following/index.tsx`, `lib/api/hooks.ts` (`useSuggestedCreators`), i18n `following.suggested`.

Doğrulama: typecheck PASS, testler PASS. Native (iPhone 17, canlı İstanbul): gruplu kontroller, menü (opak, sayılar 1/0), menü → Takip Ettiklerin → İstanbul için 8 öneri (@gencomert, @gurmegorel…), Kaydedilenler koyu seçici. Ekranlar: account-menu.png, following-suggested.png, saved-segmented.png.

## 2026-10-27 — Pin kapakları hızlı, kart sekmesiz (VP-UI-027)

İstek: kart açılırken aşırı sekiyor; haritada pinler önce mavi duruyor, geç yükleniyor.
- Ölçüm: pin kapağı 478 KB tam boy JPEG indiriliyordu. Supabase Storage (Pro) görsel dönüşümüyle aynı kapak 7 KB (`lib/media-url.ts`, testli). Tüm pin boyutları tek 128 px rendition kullanır; harita yerleri gelince kapaklar önceden indirilir (`Image.prefetch`). Yüklenirken yer tutucu koyu, sade disk; renk+ikon yalnız fotoğraf yoksa.
- Kart: yay animasyonları kaldırıldı; açılış 280 ms ease-out (ölçek 0.55→1), çevirme dönüşü 220 ms ease-out, yükseklik değişimi 240 ms, izlenme hapı zıplamasız.
- Marka: ikonda logo %36 büyütüldü (ana ekranda küçük görünüyordu).
Doğrulama: typecheck PASS, mobil 40 test PASS. Cihaz: iPhone 17 Pro Max'e Release derlemesi kuruluyor.

## 2026-10-27 — Tüm depolanan videolar silindi (VP-DATA-028)

Ürün sahibi kararı: "335 videonun hepsini Supabase Storage'dan kalıcı olarak sil ve veritabanındaki video bağlantılarını temizle; yerine 1080p olanları sonra çekeceğiz." Gerekçe: 195 ölçülen videonun 153'ü 576×1024.
- Storage `media/videos/*`: 335 nesne Storage API ile silindi (4.640 MB). Kalan toplam depolama 273 MB (kapaklar/avatarlar).
- `public.venue_sources.video_url`: 430 satır null; `private.source_posts.video_url`: zaten 0.
- Doğrulama: kalan video nesnesi 0, video bağlantısı 0; eski video adresi 400; canlı API `videoUrl: null` döndürüyor, kaynaklar `official_embed` olarak duruyor.
- Kök neden düzeltmesi: `apps/worker/src/rehost-video.ts` `pickStream` artık tüm H.264 adaylarından kısa kenarı en büyük olanı seçiyor (önceden ilk `play_addr_h264`, çoğunlukla 576p). Yeniden indirme ScrapeCreators anahtarı ve kredi onayı bekliyor.
- Etki: uygulama dosya olmadığında resmi TikTok oynatıcısına düşer; kart önizlemesinde video yok (yalnız dosyadan oynar).

## 2026-10-28 — Otorite creator videoları yayında (VP-DATA-029)

Ürün sahibi kuralları: yalnız gerçekten mekan öneren videolar (tarif/evde yemek yok), ≥720p dikey, 6–180 sn, ≥50k izlenme, liste videosu (3+ mekan) yok, bir video tek mekan; şehir elemesi yok.
- Hat: `scripts/verify-authority.mjs` (56 hesap doğrulandı), `scripts/authority-stage.mjs` (42 hesabın son ~20 videosu, kalite kapısı + Claude Opus 5.5/OpenRouter mekan kararı; 188 video), `scripts/authority-resolve.mjs` (adsız 45+ video transkriptle: 19 çözüldü, 32 düştü), `scripts/authority-publish.mjs` (tekrar birleştirme, mevcut mekana ekleme, OpenStreetMap Nominatim/Photon konum; yeme-içme türü + ad eşleşmesi + şehir merkezine ≤60 km; video ve kapak Storage'a; tek SQL transaction).
- Sonuç: 102 yeni mekan + 5 mevcut mekana video, 31 yeni şehir (pilot), 112 video yüklendi (1.521 MB): 94'ü 1080×1920 HEVC, 14'ü 720p. 4 video ByteDance `bvc2` codec'iydi (iOS oynatamaz) → bağlantı kaldırıldı, dosya silindi; betikler artık bvc2 seçmez. Oynatılabilir: 108 video.
- Düşenler: 43 mekan konumlanamadı ya da yanlış yere eşleşti (ör. "Pollos Rikos, Barselona" 9.508 km uzağa) → eklenmedi (liste: ~/viral-places-ref/content/publish/plan.json).
- Not: `venue_external_ids.provider` yalnız belirli sağlayıcıları kabul ediyor; OSM kimliği `geo.venue_locations.source_ref` içinde ("osm:node/…"). Konum kaynağı `creator_supplied` olarak işaretli (şemada OSM değeri yok).
- Maliyet: ScrapeCreators ≈ 56 + 83 + 3 + ~51 transkript + ~120 video ayrıntısı ≈ 315 kredi (~0,59 $); OpenRouter ~4 tur, tahmini 6–8 $.
- Uygulama: şehir seçici hâlâ seçili 15 şehri gösterir; yeni şehirlerdeki mekanlar haritada görünür ama seçicide yok.

## 2026-10-28 — Şehir seçicide mekanı olan tüm şehirler (VP-UI-028)

Ürün sahibi onayı: yeni şehirler seçiciye eklensin, mekan sayısına göre sıralansın.
- `curateCities`: önce seçili 15 şehir (aynı sıra, yerel ad), sonra mekanı olan diğerleri mekan sayısı çoktan aza; mekanı olmayan gizli. `CityDto.placeCount` (sunucu zaten gönderiyordu) sözleşmeye eklendi.
- Seçici: satır sağında "N mekan", 15 şehirden sonra "Diğer şehirler" ayracı. Canlıda 15 + 81 = 96 şehir.
- Simülatörde doğrulandı: Chicago seçilince harita Chicago'ya gidiyor, pin görünüyor.
- Bilinen veri hataları (düzeltilmedi): "Baghdad" TR, "Mataró" IN, "Terrassa" FR ülke kodları ve "台北" adı yanlış/yerelleşmemiş.

## 2026-10-29 — Şehir başına derin içerik: keşif havuzu (VP-DATA-030)

Ürün sahibi isteği: her şehirde en az 30–40 yüksek kaliteli mekan videosu, o şehrin en çok izlenen yemek creator'larından; iambiggroove kesinlikle yok (`config/authority-creators.json` "excluded"); videolar Supabase Storage'da, TikTok arayüzü/izi yok, açılınca oynar.
- Hat: `scripts/authority-discover.mjs` (15 şehir, yerel dil + İngilizce sorgular, en çok beğenilen, 2 sayfa; 3.954 aday ≥50k izlenme; creator sıralaması `docs/content/city-creators-2026-10-28.md`) → `scripts/authority-pool-stage.mjs` (ön eleme + Sonnet 5.5 karar, güven <0.75 ise Opus 5.5; 1.450 aday) → `authority-resolve.mjs` (adsız 193: 48 çözüldü) → `authority-publish.mjs`.
- Publish değişiklikleri: Unicode ad normalizasyonu (Japonca adlar), şehir takma adları, banliyö 35 km içinde mevcut şehre bağlanır, arama şehirleri dışında yeni şehir açılmaz (`VP_NEW_CITY_ALLOW`, bu turda yalnız Lisboa), video başına `done/` önbelleği (yarıda kalırsa yeniden kredi harcamaz), 4 eşzamanlı, Storage yüklemesinde 3 deneme, creator eşleşmesi kullanıcı kimliğiyle de (ad değişmiş hesaplar), `is_bytevc1 === 2` (bvc2) akışlar seçilmez.
- Sonuç: 1.305 aday → 753 mekan planı (469 konumlanamadı/yanlış yer/arama dışı şehir, 83 tekrar birleşti); 764 video yüklendi (597×1080p, 167×720p), 13 indirilemedi. Kodek taraması (875 dosyanın tamamı ffprobe): 40'ı bvc2 → hiçbirinde ≥720p oynatılabilir akış yoktu, `video_url` null (dosyalar Storage'da duruyor, silinmedi).
- Canlı (oynatılabilir, bvc2 sonrası): 835 video toplam. Şehir: Paris 92, Londra 82, New York 78, İstanbul 71, Los Angeles 68, Madrid 67, Barselona 62, Firenze 46, Amsterdam 45, Milano 43, Lizbon 39, Roma 38, Tokyo 28, Ankara 12, İzmir 11.
- İnce şehirler: Tokyo, Ankara, İzmir 30'un altında — sonraki adım bu şehirlerin en güçlü creator'larının eski videoları.
- Maliyet: ScrapeCreators keşif ~400 + transkript ~192 + video ayrıntısı ~820 + bvc2 40 kredi; OpenRouter ~20–25 $.

## 2026-10-29 — İçerik denetimi, yalnız depolanmış video, zengin kart, harita açılışı (VP-DATA-031 / VP-UI-029)

Ürün sahibi: "doğrudan mekan önerisi olmayan videolar çıkmalı; TikTok işaretlerinin hepsi kalkmalı, videolar hep yüklü olmalı, çok hızlı açılmalı; kart ikinci dokunuşta referanstaki gibi daha çok bilgiyle; uzaktayken görseller yüklenmiyor, görüntü bozuk."
- Denetim (`scripts/authority-audit.mjs`): 835 yayındaki video için açıklama + konuşma metni + videodan 4 kare → Sonnet 5.5 (güven <0.75 Opus 5.5). 54 kaynak satırı silindi (yedek: ~/viral-places-ref/content/audit/audit-removed-*.json): reklam 10, liste/karşılaştırma 12, olumsuz inceleme 4, yalnız ortam/vlog/edit 19, geçerken anma 4, yanlış şube/şehir 5. Bir karar elle düzeltildi (Nova Pequim: gerekçe öneri diyor, karar hayır). Kod noktası güvenli kesme (yarım emoji isteği bozuyordu).
- Yalnız depolanmış video: dosyası olmayan 423 mekan `hidden` (silinmedi; liste audit/hidden-no-video.json). Uygulamada `hasStoredVideo` süzgeci (usePlace/useCreator); TikTok gömme oynatıcısı (CalloutVideo EmbedVideo) kaldırıldı, dosya yoksa yalnız kapak; "TikTok'ta aç" bağlantıları, platform etiketi ve creator profilindeki platform düğmesi kaldırıldı.
- Hız: ekranın merkezine en yakın 24 mekanın detayı önceden çekiliyor (`usePrefetchPlaces`) → kart açılınca video adresi hazır. Dosyalar Supabase CDN'de (cf HIT, max-age 1 yıl, moov başta).
- Kart (2. dokunuş): kaynaklı özet maddeleri (Denenebilir/Ortam/Ziyaret zamanı/Rezervasyon, kalın etiket, ikon yok), büyük video şeridi (izlenme + creator), "N creator önerdi · izlenme", Yol tarifi + Mekanı aç düğmeleri; "Paris, Paris" tekrarı giderildi.
- Özetler (`scripts/authority-summarize.mjs`): creator videolarının açıklama + konuşmasından en fazla 4 madde, her madde video kimliğine bağlı; 549 mekan yazıldı (yayında özeti olan: 571).
- Harita: karolar yüklenene kadar düz zemin örtüsü (en geç 2,5 sn; MapKit gri ızgara/çift yazı görünmüyor), pin kapakları 3x (192 px), işaretçi yeniden çizim penceresi 1,5 sn.
- Canlı: 781 video, 730 mekan. Paris 83, Londra 81, New York 74, Los Angeles 67, İstanbul 65, Madrid 62, Barselona 61, Amsterdam 43, Floransa 41, Milano 41, Lizbon 39, Roma 33, Tokyo 28, İzmir 10, Ankara 10.
- Doğrulama: typecheck PASS, mobil 40 test PASS; simülatörde kart önizlemede video oynuyor, genişletilmiş kart yeni düzende.

## 2026-10-29 — Reels akışı şehrin tamamı (VP-UI-030)

Ürün sahibi: "Milano'yu seçip oynat'a basınca oradaki her şey dikey reels gibi kaymalı; sadece 5 tane çıktı." Kök neden: akış yalnız haritada görünen alanın mekanlarını alıyordu. `useCityPlaces` şehrin tüm mekanlarını (şehir bbox, sunucu sınırı 200) haritayla birlikte önceden yükler; akış önce ekrandakileri, sonra şehrin geri kalanını (aynı filtrelerle, tekrarsız) gösterir; oynat düğmesindeki sayı şehir toplamı. Simülatörde Milano: "Milano · 39 mekan". typecheck PASS, 40 test PASS.

## 2026-10-29 — kartalgokberk çıkarıldı (VP-DATA-032)

Ürün sahibi: "kartalgokberk'i çıkar." `config/authority-creators.json` durumu `excluded` (betikler artık almaz). Hesabın 8 kaynak satırı (2'si depolanmış video, 7 mekan) silindi; yedek ~/viral-places-ref/content/audit/removed-kartalgokberk.json. Başka oynayan videosu kalmayan mekanlar `hidden`. İstanbul'da oynayan video: 63. Storage dosyaları silinmedi.

## 2026-10-29 — serennazra çıkarıldı (VP-DATA-033)

Ürün sahibi: "serennazra'yı da çıkar." Hesabın 1 kaynak satırı (depolanmış video) silindi; yedek ~/viral-places-ref/content/audit/removed-serennazra.json. Başka oynayan videosu kalmayan mekan `hidden`. Hesap `config/authority-creators.json` içinde `excluded`. Storage dosyası silinmedi.

## 2026-10-29 — eatoutguidelondon çıkarıldı (VP-DATA-034)

Ürün sahibi: "eatoutguidelondon'ı kaldır." Hesabın 1 kaynak satırı (depolanmış video) silindi; yedek ~/viral-places-ref/content/audit/removed-eatoutguidelondon.json. Başka oynayan videosu kalmayan mekan `hidden`. Hesap `config/authority-creators.json` içinde `excluded`. Storage dosyası silinmedi.

## 2026-10-29 — Yeni İstanbul hesapları: bi.mekangez, istbucketlist, yemekneredeyenir, bimekan (VP-DATA-035)

Ürün sahibi: "bunları ekle ama videolara bakarak bize uygun mekan önerisi veriyorsa." `config/authority-creators.json`'a eklendi. `authority-stage.mjs` artık `VP_STAGE_ONLY` (yalnız seçili hesaplar) ve `VP_STAGE_MONTHS` alıyor; profil API'si sayfa başına 10 video verdiği için 40 sayfa tarandı (son 24 ay).
- Tarama: 1.200 video → ≥50k izlenme, ≥720p dikey, tarif değil, AI "tek mekan önerisi" → 81 aday (istbucketlist 51, bi.mekangez 24, yemekneredeyenir 6). @bimekan hesabında video yok (0 video, 1 takipçi).
- Konum: 46 mekan bulundu; 35 aday OpenStreetMap'te bulunamadı ya da yanlış yere düştü → eklenmedi (TikTok konum etiketi yalnız semt düzeyinde). 42 video yüklendi (3×1080p, 39×720p, hepsi HEVC hvc1), 4'ünde ≥720p akış yoktu.
- Denetim (kare + konuşma): 3 video elendi (mekan sahibinin tanıtımı, yalnız yapım görüntüsü). yemekneredeyenir'den yayında video kalmadı.
- Sonuç: bi.mekangez 7 video/7 mekan, istbucketlist 32 video/30 mekan; 23 yeni mekan özeti. İstanbul'da oynayan video: 99.

## 2026-10-29 — Pin görselleri, harita ölçeği, uçtan uca inceleme düzeltmeleri (VP-UI-031)

Ürün sahibi: "haritada gezerken bazen mavi işaret çıkıyor, resim yüklenmiyor; genel olarak problem var" + "tüm UI/UX'i uçtan uca kare kare incele."
- Ölçüm: 15 şehirde 695 pinin 693'ünde kapak vardı, küçük boyut (render) hiçbirinde hata vermedi; 2 mekanın (Santo Taco, Disco Burger) kapağı yoktu → videodan kare alınıp yüklendi. Asıl sorun istemcideydi.
- Pin görseli: React Native Image yerine expo-image (bellek + disk önbelleği, ön yükleme ile aynı önbellek); hata olursa bir kez yeniden dener, sonra asıl dosyaya düşer; yüklenene kadar parlak kategori rengi (mavi) yerine koyu zemin + soluk simge. Şehrin tüm kapakları harita açılınca önceden yükleniyor.
- Harita ölçeği: uzaklaşınca sunucunun 200 sınırı başka şehirlerle doluyor, şehir 36 mekana düşüyordu → haritada her zoomda şehrin tüm mekanları (görünen alan + şehir listesi, aynı filtreler); pin seçimi ve küme seçimi tam listeden. Şehir ölçeğinin ötesine uzaklaşma kapalı (minZoomLevel 9; ülke ölçeğinde MapKit karoları gri ızgara kalıyordu).
- Mekan sayfası: video oynarken ad ve semt videonun altında görünür; özet yoksa "Öne çıkanlar · yeterli kanıt yok" kutusu gösterilmez.
- Özet: konuşmasız videolar için denetim karelerinden (ekrandaki yazı, menü fiyatı, manzara) özet; 60 mekan daha (ör. Divan Brasserie: "Latte 180₺, Türk Kahvesi 150₺", "Boğaz manzaralı teras").
- Simülatörde kontrol edildi: ilk açılış (düz zemin → karolar), şehir ölçeğinde tüm İstanbul kümeleri fotoğraflı, küme dokunuşu yakınlaştırır, uzaktan pin dokunuşu mahalleye iner ve kart açılır, önizlemede video oynar, genişletilmiş kart, şeritten video oynatma/kapatma, "Mekanı aç" → mekan sayfası, creator profili (platform etiketi/bağlantısı yok), reels akışı (şehrin tamamı).
- Not: simülatör panelinde dokunuşlar zaman zaman gecikmeli/çift işleniyor; uygulamaya ait değil (aynı adım tekrarında doğru çalıştı).
- typecheck PASS, mobil 40 test PASS.

## 2026-10-29 — Pin etiketleri her zaman, boş kutu (VP-UI-032)

Ürün sahibi: "şehir yakınlaşmadan önce de bazen kutu görünüyor" + "bir şehre girdiğinde belli bir seviyede pinlerin üstünde Yemek vs. ne olursa olsun yazsın."
- Etiket: şehre giriş ölçeğinden (zoom ≥ 13) itibaren pin sayısından bağımsız her tekil pinde kategori etiketi (`LABEL_ALWAYS_ZOOM`); önceden 12'den fazla pin varken gizleniyordu. Kümelerde etiket yok.
- Kutu: "bu filtreyle sonuç yok" kutusu yalnız filtre açıkken, şehir listesi de yüklendikten sonra gerçekten boşsa; yüklenirken/şehir dışına bakarken çıkıyordu.
- Simülatörde İstanbul açılışında etiketler görünüyor. typecheck PASS, 40 test PASS.

## 2026-10-29 — Şehir değişiminde kesintisiz harita (VP-UI-033)

Ürün sahibi: "map'te kopukluk olmasın, map hep görünsün; yeni şehir seçilince ilk başta karanlık ekran çıkıyor."
- Kök neden: harita `key={city.id}` ile her şehir değişiminde baştan kuruluyordu (karolar sıfırdan, arada koyu örtü); şehir verisi yüklenene kadar harita hiç çizilmiyordu.
- Düzeltme: harita kalıcı; yeni şehir yüklenirken önceki şehir verisi tutulur (`useCity` placeholderData), merkez değişince kamera 700 ms'de yeni şehre uçar.
- Etiketli ölçekte (zoom < 15) kümeleme mesafesi ×1.6, 15–16 arası ×1.25: Paris merkezinde etiketli pinler üst üste biniyordu.
- Simülatörde İstanbul → Paris: başlık değişti, harita karanlığa düşmedi, kamera Paris'e uçtu, pinler etiketli ve ayrık. typecheck PASS, 40 test PASS.

## 2026-10-29 — Ürün dalgaları 1–5: akışla açılış, iz bırakma, karar bilgisi, içerik makinesi, kalite kalkanı (VP-PROD-001)

Ürün sahibi: "herkesin kullanacağı, Instagram kadar bağımlılık yapan, hatasız bir uygulama; hepsini yap." Açık karar (ilk ekran) için öneri uygulandı: uygulama "Senin için" akışıyla açılır, harita bir dokunuş uzakta.
- Dalga 1 — ana döngü: ilk açılışta 2 adımlı onboarding (şehir, zevkler; hesap/izin yok). Akış haritanın üstünde katman (harita kurulu kalır, geçişte karanlık yok); sıra: seçilen zevkler → trend → puan, "Gittim" işaretlenenler sona. Sağ kenar: Kaydet (tek dokunuş, varsayılan "Kaydedilenler"), Gideceğim, Gittim, Paylaş (iOS paylaşım sayfası, mekan + yol tarifi bağlantısı). Üst çubukta şehir değiştirme ve okunurluk geçişi. İzler cihazda (`features/visits`, hesapla eşitleme sonra).
- Dalga 2 — karar bilgisi: `venues` yeni alanlar (opening_hours, phone, address_line, cuisine, price_level, practical_source) — `supabase/migrations/20261029120000_venue_practical.sql` canlıya uygulandı. `scripts/venue-practical.mjs` OpenStreetMap Overpass'tan 737 OSM kimlikli mekanın etiketleri → 594 mekan güncellendi: adres 469, web 326, saat 268, telefon 257 (uydurma yok). Uygulamada `lib/opening-hours.ts` (OSM sözdiziminin yaygın alt kümesi, gece yarısını aşan aralık, 24/7; okunamayanı "bilinmiyor" sayar; 3 test) → kartta "Açık · 23:00'e kadar", mekan sayfasında Bilgiler kutusu (mutfak, adres, saat, dokunulabilir telefon/web, © OpenStreetMap atfı). API sözleşmesi + mapper güncellendi — **API deploy bekliyor**.
- Dalga 3 — içerik makinesi: `scripts/content-refresh.mjs` tek komutla stage → resolve → publish → audit → summarize → practical (haftalık). Publish artık yayındaki ve denetimde/elle elenmiş videoları yeniden almaz. İnce şehirler: Ankara/İzmir/Tokyo için genişletilmiş yerel sorgular (`VP_DISCOVER_ONLY`, `VP_POOL_ONLY`) → 1.771 aday, eleme sonrası Ankara 102, İzmir 90, Tokyo 323; çözüm + konum + yükleme sürüyor.
- Dalga 4 — geri getiren dürtü: "Gideceğim" → 3 gün sonra 18:00'de yerel bildirim ("{mekan} seni bekliyor"); izin ilk "Gideceğim"de istenir, kaldırılınca/Gittim olunca iptal; bildirime dokununca mekan sayfası. expo-notifications (yalnız yerel; sunucu push'u ve Apple ile giriş hesap/APNs kararı gerektirdiği için sonraya).
- Dalga 5 — kalite kalkanı: kök ErrorBoundary ("Bir şeyler ters gitti · Tekrar dene"), yakalanmamış JS hataları için global işleyici; anonim olay kuyruğu (`lib/telemetry.ts`: app.open, feed.view/want/been/share, onboarding.done, reminder.permission, app.error) → `POST /api/v1/events` → `public.app_events` (yalnız ekleme, kişisel veri yok; migration uygulandı). **API deploy bekliyor**; o zamana kadar olaylar sessizce düşer.
- Doğrulama: typecheck PASS, mobil 43 test PASS; simülatörde onboarding → "Senin için · Paris" (Kahve seçimiyle ilk video Cedric Grolet Café), Kaydet/Gideceğim tek dokunuşla işaretlendi.

## 2026-10-29 — İnce şehirler sonucu, şehre bağlı konum araması (VP-DATA-036)

- İnce şehir turu (Ankara/İzmir/Tokyo): 462 aday → 81 video yüklendi, 73 yeni mekan; denetimde 16 kaynak elendi, 35 özet. Canlı: Tokyo 67 (28'den), Ankara 19, İzmir 18.
- 289 aday konumlanamadı. `authority-publish` konum araması artık şehir merkezine bağlı (Nominatim viewbox + Overpass ad araması 30 km, yeme-içme türleri) ve önbellekteki uzak yanlış eşleşmeleri yeniden dener. Ankara/İzmir'de 97 yeniden denemede 0 sonuç: bu küçük yerel mekanlar OpenStreetMap'te yok; TikTok konum etiketi de bu videolarda boş (6 örnek, 6 kredi). Ücretsiz kaynakla aşılamıyor → ücretli/anahtarlı bir yer arama servisi gerekir (ürün sahibi kararı).
- `venue-practical`: Overpass bazen 200 ile HTML hata sayfası dönüyor → okunamayan yanıt yeniden deneniyor (önceki çökme). İkinci tur: 620 mekan (saat 284, telefon 273, adres 481).

## 2026-10-29 — Yüklenme hızı ve harita görünümü (VP-PERF-001)

Ürün sahibi: "hâlâ yüklenme hızıyla ilgili sorun var; harita ve yerler çok daha güzel gösterilmeli."
- Ölçüm: API fonksiyonları ABD'de (iad1), Supabase Frankfurt'ta (eu-central-1) — her istek veritabanına Atlantik'i birkaç kez geçiyordu: şehirler 2,5 sn, şehir haritası 2,5 sn, mekan 1,7 sn (soğuk). → `apps/admin/vercel.json` regions ["fra1"]; herkese açık yanıtlar CDN'de 5 dk taze + 24 saat stale-while-revalidate (önce 60 sn / 5 dk). **Deploy bekliyor.**
- Gerileme: bugünkü deploy şehir listesinden `placeCount`'u düşürdü (önceki canlı sürüm bu depoda olmayan bir koddan yüklenmişti) → `/cities` yayındaki mekan sayısını sayfalayarak hesaplıyor (PostgREST 1000 sınırı). **Deploy bekliyor.**
- İstemci: sorgu önbelleği diskte (`lib/query-persist.ts`; şehirler, şehrin mekanları, en son 400 mekan detayı; 7 gün) → uygulama son veriyle anında açılıyor (simülatörde açılış ekranından hemen sonra video oynadı). Yeniden deneme 3 kez, üstel bekleme. Mekan detayı önden yükleme kademeli (aynı anda en fazla 4, tazesi atlanır; önce 24 paralel istek zaman aşımına düşürüyordu). Elde mekan varken geçici hata bandı gösterilmiyor.
- Görünüm: akış yüklenirken simsiyah ekran yerine nefes alan iskelet + "elsewhere" sticker; kümeler tek kapak yerine üç üyenin fotoğrafından yelpaze (yatık arkalar, öndeki dik), sayı beyaz rozet.
- typecheck PASS (mobil + API), 43 test PASS.

## 2026-10-29 — iOS uygulaması hissi (VP-UI-034)

Ürün sahibi: "app sanki iOS native Apple app'i gibi olmalı."
- Apple sekme çubuğu her ekranda (ADR-024'ün harita/akışta gizli çubuğu kaldırıldı); iOS 26'da Liquid Glass, kaydırınca küçülür (`minimizeBehavior="onScrollDown"`). Haritadaki özel hesap menüsü (avatar) gereksiz kaldı → kaldırıldı. Akış ve harita alt içerikleri çubuğun üstünde (~62–66 pt).
- Gezinme çubukları kaydırınca sistem bulanıklığı (`systemChromeMaterialDark`) — Kaydedilenler, Takip, Profil.
- Segment seçici UISegmentedControl'un koyu görünümü (systemFill iz, gri yükseltilmiş başparmak, 13 pt, 34 pt yükseklik).
- Kaydedilenler: kesikli "Yeni koleksiyon/plan" kartı yerine gezinme çubuğunda "+" (iOS kalıbı); kapak kartlarının kalın beyaz çerçevesi kaldırıldı.
- Profil: Ayarlar'daki hesap kartı gibi düz gri avatar (eğik sticker avatar kaldırıldı), sayaçlar koyu gruplu hücrede sistem yazısıyla (beyaz kutular kaldırıldı), "Zevklerim ve şehrim" satırı (onboarding'i mevcut seçimlerle açar).
- Akış sağ kenar düğmeleri Liquid Glass (seçiliyken renkli dolgu).
- Simülatörde akış, Kaydedilenler, Profil kontrol edildi. typecheck PASS, 43 test PASS.

## 2026-10-30 — API deploy: mekan sayıları canlı, bölge taşınmadı (VP-PERF-002)

- Deploy (ürün sahibi onayı): `/cities` mekan sayıları canlı (Paris 76, İstanbul 94); CDN önbelleği 5 dk + 24 sa stale.
- Fonksiyon bölgesi hâlâ iad1 (`x-vercel-id: fra1::iad1`, `vercel inspect` → `λ index [iad1]`). Denenenler: `apps/admin/vercel.json` regions ["fra1"], her API rotasında `export const preferredRegion = 'fra1'`, kök `vercel.json` (bu deploy "Building"de 0 ms takıldı, kaldırıldı; canlıda önceki sağlam sürüm). Sonuç: proje ayarındaki fonksiyon bölgesi kod ayarlarını eziyor → Vercel panelinde Settings → Functions → Function Region = Frankfurt (fra1) ürün sahibince değiştirilmeli; kod tarafı hazır.

## 2026-10-30 — API Frankfurt'ta (VP-PERF-003)

- Kök neden: proje "Fluid compute" modunda; fonksiyon bölgesini `resourceConfig.functionDefaultRegions` belirliyor ve panelde kaydedilen ayar bu alana geçmemişti (`vercel.json` regions ve `preferredRegion` da ezilmişti). Ürün sahibi onayıyla `vercel api PATCH /v9/projects/viral-places-api {"resourceConfig":{"functionDefaultRegions":["fra1"]}}` → bölge fra1, ardından deploy.
- Ara sorun: panelde derleme makinesi "Enhanced"e çekilmişti, derlemeler kurulumdan sonra takılıyordu; ürün sahibi Standard'a aldı, takılan 3 deploy silindi.
- Ölçüm (önbelleksiz, `x-vercel-id: cdg1::fra1`): mekan 1,1–1,7 sn → 0,43–0,48 sn; şehir listesi 0,9–2,5 sn → 0,48–0,79 sn; şehrin tüm haritası 2–2,7 sn → 0,53–0,80 sn.
