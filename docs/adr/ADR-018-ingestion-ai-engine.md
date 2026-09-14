# ADR-018 — Veri/AI motoru: sağlayıcı adaptörleri, outbox worker, çıkarım ve eşleştirme

**Tarih:** 13 Eylül 2026 · **Durum:** Kabul (kod yazıldı; canlı sağlayıcı ve DB koşusu NOT_RUN) · **İlgili:** §12, §13, §15, §16, §17, §27.4; ADR-016/017; docs/research/social-data-access.md

## Bağlam
M2 sonunda webhook kabulü, inbox/outbox ve saf normalize/dedupe/planlayıcı/eşleştirici modülleri vardı; tüketici, adaptör, AI çağrısı, cohort normalizasyonu ve inceleme akışı yoktu. Araştırma (13.09) TikTok/Instagram için resmi API'lerin izinsiz creator'da yetersiz kaldığını, ScrapeCreators'ın birincil, Apify'ın yedek olduğunu gösterdi.

## Kararlar
1. **Adaptör sözleşmesi** `SocialSourceAdapter` (§13.2) `packages/pipeline/src/adapters/types.ts` içinde; uygulamalar: `ScrapeCreatorsAdapter` (birincil), `ApifyAdapter` (webhook + `collectRun`), `EnsembleDataAdapter`, `InstagramGraphAdapter` (resmi Business Discovery), `FixtureAdapter` (demo). Sağlayıcı JSON'u normalize sınırında (`normalizeTikTokAweme`, `normalizeApifyInstagram`, `normalizeGraphInstagram`, `normalizeInstagramRaw`) durur; büyük kimlikler `safeJsonParse` ile string kalır; hassas olmayan-tamsayı kimlikler `id_precision_lost` ile reddedilir.
2. **NormalizedPost genişletmesi:** `locationTag` (açık yer etiketi, §16.1 hiyerarşinin tepesi), `hashtags`, `thumbnailUrl`, `platformShortcode`; `provider` enum'una `instagram_graph`, `scrapecreators` eklendi.
3. **Worker** `apps/worker`: Node döngüsü, `postgres` ile doğrudan bağlantı, `claim_outbox_jobs` (FOR UPDATE SKIP LOCKED + lease) / `finish_outbox_job` (backoff, dead-letter) / `enqueue_job` (idempotent) RPC'leri. İş türleri: `poll.dispatch`, `poll.account`, `metrics.refresh`, `ingest.provider_event`, `post.extract`, `mention.resolve`, `venue.refresh`, `cohorts.build`, `import.process`, `maintenance.daily`. Trigger.dev kararı alındığında aynı iş sözleşmesi task'lara taşınır.
4. **AI çıkarımı** Anthropic SDK `messages.parse` + `zodOutputFormat(PlaceMentionExtraction)`; varsayılan model `claude-opus-5`, adaptive thinking, efor `medium` (env). System talimatı ile güvenilmeyen kaynak zarfı ayrı mesajlarda; tool/ağ yok; `validateExtraction` kanıt aralıklarını Unicode code point ile kaynakta doğrular; **tek** onarım denemesi; prompt_version/model_id/input_hash/usage `private.extraction_runs`'a yazılır; aynı hash yeniden çalışmaz. `refusal` stop reason inceleme görevine düşer.
5. **Girdiler:** yalnız `may_send_metadata_to_ai` ile caption/hashtag/yer etiketi; TikTok otomatik altyazısı (ScrapeCreators) `transcript` modu olarak; **native video / sampled frames yolu kapalı** (medya hakkı ve indirme yok).
6. **Eşleştirme:** kendi kayıtlar → gerekirse Google Places Text Search (New), en dar alan maskesi, yalnız coğrafi ipucu varsa; cache `private.google_places_cache` ≤30 gün (CHECK), koordinat `geo.venue_locations` `google_cache` + `expires_at`; `place_id` `venue_external_ids`'de kalıcı. Auto-publish policy ile kapalı → `review_required` → `private.review_tasks` → `decide_review_task` RPC (mention + link + audit + `venue.refresh`). İnsan onayı + geçerli konum → venue `published`.
7. **Skor:** `scoreVenue` (saf): uygun küme filtresi, snapshot çiftinden hız, cohort yüzdelik (günlük `normalization_cohorts`, platform×yaş×şehir/kategori → global fallback), D/F/O, `computeViralScore` kapıları; `public.venue_scores` + `private.venue_score_runs` (replay). Admin skor yazamaz.
8. **Bütçe:** `reserveBudget` (saf) + `budget_days/budget_reservations/cost_events`; limit veya birim fiyat bilinmiyorsa ücretli iş yok; rezervasyon lease TTL; hak silme muaf.
9. **Admin API:** `/api/v1/admin/{review-tasks, review-tasks/{id}/decision, creators, jobs, budget}`; geçici `ADMIN_API_TOKEN` (x-admin-token, sabit zamanlı karşılaştırma); token yoksa 503. Rol modeli M6.

## Sonuçlar / açık işler
- NOT_RUN: migration + pgTAP (`supabase/tests/engine.test.sql`), worker'ın gerçek DB ile koşusu, canlı sağlayıcı çağrıları, Claude çağrısı — Docker (harici disk) ve hesaplar/anahtarlar yok.
- Idempotency-Key + body hash 409 (§19.4) hâlâ açık; çok-instance oran sınırı açık; Instagram Graph için App Review gerekli.
