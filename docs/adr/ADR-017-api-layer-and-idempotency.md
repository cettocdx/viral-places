# ADR-017 — /api/v1 katmanı: Next.js route handler + Supabase RLS, idempotency ve hata zarfı

**Tarih:** 12 Eylül 2026 · **Durum:** Kabul edildi (M2) · **İlgili:** ADR-016, şartname §13.5, §19, §20, §25, §27

## Bağlam

Mobil uygulama M1'de yalnız fixture istemcisiyle çalışıyordu. M2 için gerçek bir HTTP sınırı gerekir: public okuma, kullanıcı kütüphanesi (kaydet/takip/plan), link import ve sağlayıcı webhook'u. Şartname üç şey ister: tek hata zarfı, idempotent yazma yolları ve mobilde asla service_role bulunmaması.

## Karar

1. **Next.js 16 App Router route handler'ları** (`apps/admin/src/app/api/v1/**/route.ts`). Sunucu bileşeni/SSR yok; yalnız `Request → Response`. Route'lar `route()` sarmalayıcısından geçer: `x-request-id` yansıtma/üretme, hata zarfı, süreç içi oran sınırı.
2. **Yetki DB'de kalır.** `me/*` uçları kullanıcı JWT'sini Supabase Auth ile doğrular (`auth.getUser`) ve aynı token'la PostgREST'e gider; RLS kullanıcı olarak çalışır. API katmanı sahiplik filtresi *eklemez*; RLS'e güvenir ve negatif testlerle kanıtlar.
3. **service_role tek yerde:** `POST /webhooks/apify`. Kullanıcı isteğinde hiçbir zaman kullanılmaz. Anahtar yalnız sunucu ortamında (`SUPABASE_SECRET_KEY`), mobilde yok.
4. **Idempotency:**
   - Webhook: `provider:runId:eventType` anahtarı; `public.accept_provider_event` (SECURITY DEFINER, yalnız service_role) inbox+outbox'ı tek transaction'da yazar; tekrar teslim aynı satırları döndürür.
   - Import: `Idempotency-Key` header'ı zorunlu (8–128); `public.submit_import_request` (SECURITY INVOKER) aynı anahtarda mevcut kaydı döndürür, 24 saatte 20 kota uygular.
   - Kaydet/takip: `ON CONFLICT DO NOTHING` (update policy bilinçli yok).
   - Plan: `expectedRevision`; PATCH koşullu update, öğe ekleme/sıralama DB fonksiyonları satır kilidi altında doğrular → 409.
5. **Hata zarfı** `{error:{code,message,retryable,requestId}}`; Postgres/PostgREST kodları eşlenir (42501→403, 23505→409, P0001 mesajına göre 409/422/429, PGRST116→404). Ham DB mesajı dışarı çıkmaz.
6. **Public projeksiyon tabloları** (`venue_scores`, `venue_summaries`, `venue_sources`) private ham veriden ayrıdır; RLS yalnız yayımlanmış mekanı açar; worker (service_role) yazar. Konum için `venue_locations_public` RPC (SECURITY DEFINER, published + süresi dolmamış).
7. **İstemci sözleşmesi** `packages/api-client`: her yanıt contracts Zod şemasından geçer; `EXPO_PUBLIC_API_BASE_URL` varsa mobil canlı istemciye geçer, DEMO etiketi yanıt içindeki `dataStatus`'tan türer.

## Sonuçlar

- Artı: tek yetki kaynağı (RLS), test edilebilir saf katman (route'lar süreç içinde çağrılır), üretim kaçağı yok (secret yalnız sunucu).
- Eksi: PostgREST üzerinden çoklu sorgu (detay ucu 5 paralel sorgu). Gerekirse M3'te `place_detail` tek RPC.
- Oran sınırı süreç içidir; çok instance'lı dağıtımda edge/KV tabanlı sınır **BLOCKED** (altyapı kararı).
- JWT doğrulaması her istekte Auth servisine gider; JWKS ile yerel doğrulama (jose) M3 iyileştirmesi.
