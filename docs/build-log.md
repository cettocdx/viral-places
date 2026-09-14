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
