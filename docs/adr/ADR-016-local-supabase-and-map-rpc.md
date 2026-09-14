# ADR-016 — Yerel Supabase, RLS matrisi ve harita RPC'si

**Tarih:** 11 Eylül 2026 · **Durum:** Kabul edildi (M2 başlangıcı) · **Kapsam:** §18, §19.3, §23

## Karar

- **Yerel Supabase (CLI 2.117 + Docker)** M2'nin ilk aşamasıdır. Bulut projesi ürün sahibinin hesabını gerektirir ve BLOCKED kalır; migration/RLS/test disiplini yerelde kurulur, bulut projesi gelince `supabase db push` ile taşınır.
- **Şema sınırları:** `public` (RLS + açık grant, yalnız son kullanıcı verisi), `private` (ingestion/hak/metrik/outbox/audit; anon/authenticated'a USAGE yok, RLS açık, politika yok), `geo` (`venue_locations` geography + kaynak/expiry; API'ye kapalı).
- **RLS kalıbı:** `TO authenticated` + `(select auth.uid()) = owner_id` USING/WITH CHECK; koleksiyon/plan sahibi ilişkili tablolarda ayrıca doğrulanır; yalnız `published` mekan kaydedilebilir/plana eklenebilir. `user_metadata` yetki için kullanılmaz.
- **Plan sırası:** `public.reorder_plan_items(plan, ids, expectedRevision)` SECURITY INVOKER; revision uyuşmazlığı `P0001 PLAN_REVISION_CONFLICT`.
- **Harita sorgusu:** `public.map_places(bbox, limit)` **SECURITY DEFINER** istisnası: `geo` şeması Data API'ye kapalı olduğundan anon/authenticated bu fonksiyon üzerinden yalnız `published` + süresi dolmamış konumları alır; `search_path=''`, sayısal girdi, limit 1–200. Supabase skill'inin uyarısı gereği kayıt altına alındı; `supabase db advisors` temiz.
- **Seed:** yalnız `data_mode='demo'` sentetik veri; production seed'ine giremez.

## Kanıt

`supabase/migrations/2026091115*.sql`, `supabase/seed.sql`, `supabase/tests/rls_negative.test.sql` (pgTAP 17 iddia), `npx supabase db advisors --local` → "No issues found".

## Açık

Bulut projesi, Auth e-posta akışı (mobil), misafir→hesap birleştirme, `packages/api-client`, admin uçları, `private` tablolar için worker rolü.
