-- Motor katmanı negatif testleri (§18.5): private tablolar anon/authenticated'a kapalı; iş/inceleme RPC'leri yalnız service_role.
-- Çalıştırma: npx supabase test db   (Docker + yerel stack gerekir; 13.09 tesliminde NOT_RUN — Docker harici diskte)
begin;
select plan(18);

-- 1) Yeni private tablolar RLS açık ve politika yok
select ok((select relrowsecurity from pg_class where oid = 'private.extraction_runs'::regclass), 'extraction_runs RLS açık');
select ok((select relrowsecurity from pg_class where oid = 'private.place_mentions'::regclass), 'place_mentions RLS açık');
select ok((select relrowsecurity from pg_class where oid = 'private.google_places_cache'::regclass), 'google_places_cache RLS açık');
select ok((select relrowsecurity from pg_class where oid = 'private.budget_reservations'::regclass), 'budget_reservations RLS açık');
select is((select count(*) from pg_policies where schemaname = 'private' and tablename in ('extraction_runs', 'place_mentions', 'google_places_cache', 'budget_days', 'budget_reservations', 'cost_events', 'creator_discovery_candidates', 'takedown_requests')), 0::bigint, 'private motor tablolarında politika yok (deny-by-default)');

-- 2) anon/authenticated RPC'leri çalıştıramaz
select ok(not has_function_privilege('anon', 'public.claim_outbox_jobs(integer, integer, text[])', 'execute'), 'anon claim_outbox_jobs çalıştıramaz');
select ok(not has_function_privilege('authenticated', 'public.enqueue_job(text, jsonb, text, uuid, timestamptz)', 'execute'), 'authenticated enqueue_job çalıştıramaz');
select ok(not has_function_privilege('authenticated', 'public.decide_review_task(uuid, text, uuid, uuid, text)', 'execute'), 'authenticated decide_review_task çalıştıramaz');
select ok(not has_function_privilege('anon', 'public.admin_list_review_tasks(text, integer)', 'execute'), 'anon admin_list_review_tasks çalıştıramaz');
select ok(has_function_privilege('service_role', 'public.claim_outbox_jobs(integer, integer, text[])', 'execute'), 'service_role claim_outbox_jobs çalıştırabilir');

-- 3) Kuyruk davranışı (service_role/postgres olarak): enqueue idempotent; claim lease koyar; finish retry→failed→dead
select is((select inserted from public.enqueue_job('venue.refresh', '{"venueId":"00000000-0000-4000-8000-000000000001"}'::jsonb, 'test:enqueue:1')), true, 'ilk enqueue inserted=true');
select is((select inserted from public.enqueue_job('venue.refresh', '{"venueId":"00000000-0000-4000-8000-000000000001"}'::jsonb, 'test:enqueue:1')), false, 'aynı idempotency key ikinci satır açmaz');
select is((select count(*) from public.claim_outbox_jobs(10, 60, array['venue.refresh'])), 1::bigint, 'claim yalnız bir iş döner (ikincisi kilitli/lease)');
select is((select status from public.finish_outbox_job((select id from private.job_outbox where idempotency_key = 'test:enqueue:1'), false, 'provider_timeout', null, 60, 4)), 'failed', 'retry ile failed durumuna geçer');

-- 4) Google cache 30 gün sınırı
select throws_ok($$insert into private.google_places_cache (place_id, name, fetched_at, expires_at) values ('x', 'y', now(), now() + interval '31 days')$$, '23514', null, 'google cache 30 günü aşamaz');

-- 4) admin_upsert_monitored_creator: onaylı hak kaydıyla gerçek upsert çalışır (regresyon: 20260919090000 — OUT parametre/kolon adı çakışması)
insert into private.rights_policies (id, policy_version, provider, platform, approved_by, approved_at, permissions, notes)
  values ('test-approved', '1.0', 'scrapecreators', 'tiktok', 'pgtap', now(), '{"may_collect_metadata": true}'::jsonb, 'test');
select lives_ok($$select * from public.admin_upsert_monitored_creator('tiktok', 'test-user-1', 'testhandle', 'Test', 'test-approved', 'scrapecreators', true, '00000000-0000-0000-0000-000000000000')$$, 'onaylı hak kaydıyla creator upsert hata vermez');
select is((select count(*) from private.creator_monitoring m join public.creator_accounts a on a.id = m.account_id where a.platform_user_id = 'test-user-1' and m.enabled and m.provider = 'scrapecreators'), 1::bigint, 'izleme satırı scrapecreators/enabled ile oluştu');

-- 5) Bütçe rezervasyon kimliği metindir (worker "poll-<uuid>" gibi bileşik kimlik üretir; regresyon: 20260919091000)
select is((select data_type from information_schema.columns where table_schema = 'private' and table_name = 'budget_reservations' and column_name = 'id'), 'text', 'budget_reservations.id text tipinde');

select * from finish();
rollback;
