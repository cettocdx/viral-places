# ADR-013 — Paket yöneticisi ve monorepo düzeni

**Tarih:** 11 Eylül 2026 · **Durum:** Kabul edildi (M0) · **Kapsam:** §10 repo/paket sınırları

## Bağlam

Şartname tek monorepo ve sürüm kilidi ister (§10) ama paket yöneticisini sabitlemez. Geliştirme makinesinde Node 22.23.1, pnpm 11.2.2, npm 10.9.8 ve bun 1.3.14 mevcut.

## Karar

- **pnpm 11 + workspaces**, `nodeLinker: hoisted` (pnpm-workspace.yaml). Expo'nun monorepo belgeleri pnpm için hoisted düzeni önerir; ilk denemede izole düzen `expo-doctor` duplicate uyarısı verdi, hoisted ile 21/21 kontrol geçti.
- Node sürümü `.nvmrc` = 22; `engines` alanında `>=22 <23`. Lockfile (`pnpm-lock.yaml`) commit edilir.
- Mobil bağımlılıklar yalnız `npx expo install` ile eklenir; "latest kur" kuralı yok.
- Paket sınırları: `packages/domain` (saf), `packages/contracts` (Zod), `packages/design-tokens` (config JSON'dan üretilir), `packages/scoring` (saf, ağ yok), `packages/policy` (deny-by-default haklar), `packages/test-fixtures` (yalnız sentetik DEMO), `apps/mobile` (Expo SDK 57 / Expo Router). `apps/admin` ve `apps/workers` M2/M3'te açılır.

## Alternatifler

- npm workspaces: çalışır fakat pnpm'in disk/hız avantajı ve `minimumReleaseAge` güvenlik seçeneği yok.
- bun: mevcut ama Expo skill/doküman örnekleri pnpm/npm/yarn odaklı; sürpriz riski.

## Sonuçlar

`npx expo install` `pnpm-workspace.yaml`'a `minimumReleaseAgeExclude` girdileri ekler; bu dosya izlenir ve gözden geçirilir. TypeScript 6.0 ile `exactOptionalPropertyTypes` paketlerde açık, mobil uygulamada üçüncü taraf RN prop tipleri nedeniyle kapalı.
