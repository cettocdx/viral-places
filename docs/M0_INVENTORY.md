# M0 — Hazırlık, sınırlar ve gerçek hesap envanteri

**Tarih:** 11 Eylül 2026 · **Ortam:** macOS (Darwin 25.6.0), kullanıcı geliştirme makinesi · **Kaynak:** [şartname §29 M0](../VIRAL_PLACES_MASTER_BUILD_SPEC_TR.md#s29)

## 1. Hedef repo incelemesi

Başlangıçta klasör bir git deposu değildi ve uygulama kodu içermiyordu: yalnız belge paketi (şartname, 12 `vp-*` skill, 3 PNG, config/prompt/script). Hiçbir mevcut dosya silinmedi veya ezilmedi; yeni dosyalar `apps/`, `packages/`, `docs/adr`, `docs/qa`, `scripts/sync-design-tokens.mjs` ve kök monorepo config'leri olarak eklendi. `create-expo-app` şablonunun ürettiği iç içe `.git`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, `App.tsx`, `index.ts` kaldırıldı (kök `AGENTS.md` otoritedir).

## 2. Araç zinciri

| Araç | Durum |
|---|---|
| Node | 22.23.1 (LTS; `.nvmrc`=22) |
| pnpm / npm / bun | 11.2.2 / 10.9.8 / 1.3.14 → **pnpm** seçildi (ADR-013) |
| Xcode / CocoaPods | 26.6 (17F113) / 1.17.0 |
| iOS Simulator runtime | iOS 26.5 (23F77); cihaz yoktu → `VP iPhone 17` oluşturuldu |
| Android SDK / emulator | **YOK** → Android doğrulaması BLOCKED |
| watchman | yok (opsiyonel) |
| Maestro | kurulu değil → native E2E NOT_RUN |
| Expo SDK | 57.0.22 (`expo-doctor` 21/21) |

## 3. Skill envanteri (gerçek durum)

| Skill | Durum | Kanıt |
|---|---|---|
| 12 `vp-*` proje skill'i | Pakette mevcut, tamamı okundu | `.agents/skills/*/SKILL.md` |
| Expo `expo-overview`, `expo-project-structure`, `expo-router`, `expo-design-system`, `expo-native-ui`, `expo-ui`, `expo-animation`, `expo-dev-client`, `expo-data-fetching` | **Okundu (fetch, kurulmadı)** — `raw.githubusercontent.com/expo/skills` commit `ea892a7d1421fea5ecdf8c00a4550867fdf8c423` (2026-09-10) | scratchpad'e indirildi; `docs/skills-lock.md` |
| Vercel `vercel-react-best-practices`, `web-design-guidelines` | Makinede `~/.agents/skills` altında kurulu; web admin işi olmadığından bu teslimde uygulanmadı | `ls ~/.agents/skills` |
| Supabase skill'leri | UNAVAILABLE (kurulmadı; M2'de gerekli) | — |
| `ai-sdk`, `nextjs`, `agent-browser*`, `deployments-cicd` | DISCOVERED (bu ortam plugin kataloğu); M3/M6 işi | — |
| Figma | Opsiyonel, kullanılmadı (PNG'lerden geliştirme) | ADR-011 |

## 4. Hesap ve anahtar envanteri

Ortam değişkenlerinde Google/Supabase/Apify/Gemini/Anthropic/Expo anahtarı **yok**. Hiçbir ücretli hesap açılmadı, hiçbir servise bağlanılmadı. Ayrıntılı durum: [DECISIONS_AND_BLOCKERS.md](DECISIONS_AND_BLOCKERS.md).

## 5. Sürüm ve lockfile stratejisi

pnpm 11 hoisted; `pnpm-lock.yaml` commit edilir; mobil bağımlılıklar `npx expo install`; `minimumReleaseAgeExclude` girdileri gözden geçirilir. TypeScript 6.0.3.

## 6. Veri işlem haritası (kod karşılığı)

§9.2 akışının M1'de kod olarak var olan parçaları: `packages/contracts` (public DTO), `packages/policy` (hak → gösterim modu, AI girdi planı), `packages/scoring` (deterministik endeks + kapılar), `packages/test-fixtures` (DEMO). Ingestion/AI/eşleştirme/DB katmanları M2–M4; şu an yalnız sözleşme düzeyinde.

## 7. Tasarım tokenları

`config/design-tokens.json` tek kaynak → `scripts/sync-design-tokens.mjs` → `packages/design-tokens/src/tokens.generated.ts`; test dosyası JSON ile eşitliği doğrular. Mobil `src/theme` yalnız bu paketi re-export eder.

## 8. Provider hak matrisi

`config/provider-rights.template.json` (12 işlem, deny-by-default) → `packages/policy` şeması. Testler: kayıt yok/expired/revoked → `unavailable`; download URL'si medya AI izni vermez.

## 9. Canlı maliyet limitleri

`config/pipeline-policy.example.json` içinde bütçe alanları `null`, `blockWhenUnset=true`, tüm canlı özellikler `false`. Bu teslimde değiştirilmedi; canlı ingestion yok.

## 10. M0 kabul kontrolü

- [x] Üç görsel mevcut ve okundu (Read ile açıldı).
- [x] Demo/production ayrımı net: bütün fixture `dataStatus='demo'`, UI'da DEMO rozeti/afişi.
- [x] Prod sırları yok (`.env` yok; `.env.example` boş anahtarlar).
- [x] Canlı ingestion ve auto-publish kapalı.
- [x] Eksik hesaplar listeli.
