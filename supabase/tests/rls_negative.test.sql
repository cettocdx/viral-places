-- pgTAP: A/B kullanıcı izolasyonu, misafir kısıtları, private erişim (§18.5 zorunlu negatif testler). `supabase test db` ile çalışır.
begin;
select plan(23);

-- Test kullanıcıları (auth.users'a doğrudan ekleme yalnız test ortamı)
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('11111111-1111-4111-8111-111111111111', 'a@test.invalid', '{}', '{}', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'b@test.invalid', '{}', '{}', 'authenticated', 'authenticated');

-- Profil tetikleyicisi çalıştı mı?
select is((select count(*)::int from public.profiles where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')), 2, 'yeni auth kullanıcıları için profil satırı oluşur');

-- A olarak koleksiyon + plan oluştur
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into public.collections (id, owner_id, title) values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'A koleksiyonu');
insert into public.plans (id, owner_id, city_id, date_local, timezone, title) values ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-00000000c157', '2026-09-13', 'Europe/Istanbul', 'A planı');
insert into public.plan_items (id, plan_id, venue_id, position) values
  ('aaaaaaaa-0000-4000-8000-000000000011', 'aaaaaaaa-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 0),
  ('aaaaaaaa-0000-4000-8000-000000000012', 'aaaaaaaa-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 1);
insert into public.saved_places (owner_id, venue_id, collection_id) values ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001');

select is((select count(*)::int from public.collections), 1, 'A kendi koleksiyonunu görür');
select throws_ok(
  $$ insert into public.collections (owner_id, title) values ('22222222-2222-4222-8222-222222222222', 'sahte') $$,
  '42501', null, 'A, owner_id=B ile koleksiyon oluşturamaz'
);
select throws_ok(
  $$ insert into public.saved_places (owner_id, venue_id, collection_id) values ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-000000000008', 'aaaaaaaa-0000-4000-8000-000000000001') $$,
  '42501', null, 'yayımlanmamış mekan kaydedilemez'
);
select is((select count(*)::int from public.venues), 7, 'A yalnız yayımlanmış 7 mekanı görür');
select is((select count(*)::int from public.map_places(28.9, 40.95, 29.1, 41.1, 100)), 7, 'map_places bbox içinde yalnız yayımlanmış mekanları döndürür');

-- Revision çakışması
select throws_ok(
  $$ select public.reorder_plan_items('aaaaaaaa-0000-4000-8000-000000000002', array['aaaaaaaa-0000-4000-8000-000000000012','aaaaaaaa-0000-4000-8000-000000000011']::uuid[], 99) $$,
  'P0001', 'PLAN_REVISION_CONFLICT', 'eski expectedRevision ile sıra değişimi reddedilir'
);
select is(public.reorder_plan_items('aaaaaaaa-0000-4000-8000-000000000002', array['aaaaaaaa-0000-4000-8000-000000000012','aaaaaaaa-0000-4000-8000-000000000011']::uuid[], 1), 2, 'doğru revision ile sıra değişir ve revision 2 olur');
select is((select position from public.plan_items where id = 'aaaaaaaa-0000-4000-8000-000000000012'), 0, 'yeni sıra uygulanır');

-- B olarak: A'nın verisi görünmez, değiştirilemez
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.collections), 0, 'B, A koleksiyonunu göremez');
select is((select count(*)::int from public.plans), 0, 'B, A planını göremez');
select is((select count(*)::int from public.saved_places), 0, 'B, A kayıtlarını göremez');
update public.plans set title = 'ele geçirildi' where id = 'aaaaaaaa-0000-4000-8000-000000000002';
select is((select count(*)::int from public.plans where title = 'ele geçirildi'), 0, 'B, A planını güncelleyemez (0 satır)');
select throws_ok(
  $$ select public.reorder_plan_items('aaaaaaaa-0000-4000-8000-000000000002', array['aaaaaaaa-0000-4000-8000-000000000011']::uuid[], 2) $$,
  'P0002', null, 'B, A planının sırasını değiştiremez (plan görünmez)'
);

-- Misafir (anon): yalnız yayımlanmış public veri; private/geo erişimi yok
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select count(*)::int from public.venues), 7, 'anon yayımlanmış mekanları okuyabilir');
select throws_ok($$ select count(*) from private.source_posts $$, '42501', null, 'anon private.source_posts okuyamaz');
select throws_ok($$ select count(*) from geo.venue_locations $$, '42501', null, 'anon geo.venue_locations okuyamaz');
select is((select count(*)::int from public.venue_scores), 7, 'anon yalnız yayımlanmış mekanların skorlarını görür');
select is((select count(*)::int from public.venue_sources where venue_id = '00000000-0000-4000-8000-000000000001'), 3, 'anon mekan kaynak projeksiyonunu okur');
select throws_ok($$ select public.accept_provider_event('apify','r','e','{}'::jsonb) $$, '42501', null, 'anon webhook kabul fonksiyonunu çağıramaz');
select throws_ok($$ select public.submit_import_request('https://www.tiktok.com/@x/video/1', 'anon-key-123') $$, '42501', null, 'anon import isteği gönderemez');
select is((select count(*)::int from public.venue_locations_public(array['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000008']::uuid[])), 1, 'konum RPC yalnız yayımlanmış mekanı döndürür');
select throws_ok($$ insert into public.import_requests (guest_session_id, normalized_url, idempotency_key) values ('g1', 'https://www.tiktok.com/@x/video/1', 'k1') $$, '42501', null, 'anon import kaydı oluşturamaz (kotalı misafir yolu backend üzerinden)');

select * from finish();
rollback;
