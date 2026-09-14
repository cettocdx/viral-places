-- YEREL DEMO SEED — production seed'ine giremez (§10). Tamamı sentetik; data_mode='demo'.
insert into public.cities (id, slug, name, country_code, timezone, center_lat, center_lng, coverage_status, data_mode)
values ('00000000-0000-4000-8000-00000000c157', 'demo-city-ist', 'İstanbul', 'TR', 'Europe/Istanbul', 41.03, 28.98, 'pilot', 'demo');

insert into public.creators (id, display_name, claim_status, status, data_mode) values
  ('00000000-0000-4000-8000-0000000000a1', 'Demo Creator A', 'unclaimed', 'active', 'demo'),
  ('00000000-0000-4000-8000-0000000000b2', 'Demo Creator B', 'unclaimed', 'active', 'demo'),
  ('00000000-0000-4000-8000-0000000000c3', 'Demo Creator C', 'unclaimed', 'paused', 'demo');

insert into public.creator_accounts (creator_id, platform, platform_user_id, handle, canonical_url) values
  ('00000000-0000-4000-8000-0000000000a1', 'tiktok', '8000000000000000001', 'demo.creator.a', 'https://fixture.invalid/tiktok/@demo.creator.a'),
  ('00000000-0000-4000-8000-0000000000b2', 'tiktok', '8000000000000000002', 'demo.creator.b', 'https://fixture.invalid/tiktok/@demo.creator.b'),
  ('00000000-0000-4000-8000-0000000000c3', 'tiktok', '8000000000000000003', 'demo.creator.c', 'https://fixture.invalid/tiktok/@demo.creator.c');

insert into public.venues (id, own_name, city_id, neighborhood, primary_category, status, data_mode, family_supported) values
  ('00000000-0000-4000-8000-000000000001', 'Demo Kafe Karaköy', '00000000-0000-4000-8000-00000000c157', 'Karaköy', 'coffee', 'published', 'demo', false),
  ('00000000-0000-4000-8000-000000000002', 'Demo Lokanta Cihangir', '00000000-0000-4000-8000-00000000c157', 'Cihangir', 'food', 'published', 'demo', false),
  ('00000000-0000-4000-8000-000000000003', 'Demo Müze Sultanahmet', '00000000-0000-4000-8000-00000000c157', 'Sultanahmet', 'culture', 'published', 'demo', true),
  ('00000000-0000-4000-8000-000000000004', 'Demo Bar Beyoğlu', '00000000-0000-4000-8000-00000000c157', 'Beyoğlu', 'nightlife', 'published', 'demo', false),
  ('00000000-0000-4000-8000-000000000005', 'Demo Park Kafe Moda', '00000000-0000-4000-8000-00000000c157', 'Moda', 'family', 'published', 'demo', true),
  ('00000000-0000-4000-8000-000000000006', 'Demo Butik Nişantaşı', '00000000-0000-4000-8000-00000000c157', 'Nişantaşı', 'shopping', 'published', 'demo', false),
  ('00000000-0000-4000-8000-000000000007', 'Demo Seyir Terası Balat', '00000000-0000-4000-8000-00000000c157', 'Balat', 'sightseeing', 'published', 'demo', true),
  ('00000000-0000-4000-8000-000000000008', 'Demo Gizli Taslak (yayımlanmadı)', '00000000-0000-4000-8000-00000000c157', 'Kadıköy', 'food', 'review_required', 'demo', false);

insert into geo.venue_locations (venue_id, location, source_type, source_ref, expires_at) values
  ('00000000-0000-4000-8000-000000000001', extensions.st_setsrid(extensions.st_makepoint(28.9769, 41.0242), 4326)::extensions.geography, 'synthetic', 'seed', null),
  ('00000000-0000-4000-8000-000000000002', extensions.st_setsrid(extensions.st_makepoint(28.9829, 41.0318), 4326)::extensions.geography, 'synthetic', 'seed', null),
  ('00000000-0000-4000-8000-000000000003', extensions.st_setsrid(extensions.st_makepoint(28.9765, 41.0075), 4326)::extensions.geography, 'synthetic', 'seed', null),
  ('00000000-0000-4000-8000-000000000004', extensions.st_setsrid(extensions.st_makepoint(28.9776, 41.0336), 4326)::extensions.geography, 'synthetic', 'seed', null),
  ('00000000-0000-4000-8000-000000000005', extensions.st_setsrid(extensions.st_makepoint(29.0258, 40.9835), 4326)::extensions.geography, 'synthetic', 'seed', null),
  ('00000000-0000-4000-8000-000000000006', extensions.st_setsrid(extensions.st_makepoint(28.9935, 41.0478), 4326)::extensions.geography, 'synthetic', 'seed', null),
  ('00000000-0000-4000-8000-000000000007', extensions.st_setsrid(extensions.st_makepoint(28.9488, 41.0295), 4326)::extensions.geography, 'synthetic', 'seed', null),
  ('00000000-0000-4000-8000-000000000008', extensions.st_setsrid(extensions.st_makepoint(29.0250, 40.9900), 4326)::extensions.geography, 'synthetic', 'seed', null);

-- DEMO skor/özet/kaynak projeksiyonları (packages/test-fixtures ile aynı sentetik değerler; deterministik motor çıktısı)
insert into public.venue_scores (venue_id, as_of, score_version, score, status, trending, eligible_posts, distinct_creators, accessible_views, metrics_coverage, baseline_partial, baseline_scope, components_json, reason_codes, last_successful_observation_at) values
  ('00000000-0000-4000-8000-000000000001', '2026-09-11T09:00:00Z', 'trend-v0-proposal', 82, 'ready', true, 5, 4, 276000, 0.9, false, 'DEMO: platform×yaş×şehir/kategori (sentetik)', '{"momentum":0.88,"diversity":0.6667,"freshness":0.95,"outperformance":0.8}', '{}', '2026-09-11T08:30:00Z'),
  ('00000000-0000-4000-8000-000000000002', '2026-09-11T09:00:00Z', 'trend-v0-proposal', 73, 'ready', false, 6, 4, 485000, 0.85, true, 'DEMO: platform×yaş×şehir/kategori (sentetik)', '{"momentum":0.74,"diversity":0.6667,"freshness":0.8,"outperformance":null}', '{baseline_partial}', '2026-09-11T06:00:00Z'),
  ('00000000-0000-4000-8000-000000000003', '2026-09-11T09:00:00Z', 'trend-v0-proposal', 51, 'ready', false, 4, 3, 58000, 0.75, false, 'DEMO: platform×yaş×şehir/kategori (sentetik)', '{"momentum":0.55,"diversity":0.5,"freshness":0.6,"outperformance":0.2}', '{}', '2026-09-11T03:00:00Z'),
  ('00000000-0000-4000-8000-000000000004', '2026-09-11T09:00:00Z', 'trend-v0-proposal', null, 'insufficient_data', false, 4, 1, 900000, 1, false, null, '{"momentum":0.9,"diversity":0.1667,"freshness":1,"outperformance":0.9}', '{only_one_independent_creator}', '2026-09-11T08:00:00Z'),
  ('00000000-0000-4000-8000-000000000005', '2026-09-11T09:00:00Z', 'trend-v0-proposal', 63, 'stale', false, 3, 3, 31000, 0.7, true, 'DEMO: platform×yaş×şehir/kategori (sentetik)', '{"momentum":0.7,"diversity":0.5,"freshness":0.7,"outperformance":null}', '{baseline_partial,observation_stale}', '2026-09-10T03:00:00Z'),
  ('00000000-0000-4000-8000-000000000006', '2026-09-11T09:00:00Z', 'trend-v0-proposal', null, 'insufficient_data', false, 2, 2, 12000, 0, false, null, '{"momentum":null,"diversity":0.3333,"freshness":0.5,"outperformance":null}', '{too_few_posts,momentum_coverage_low,momentum_missing}', '2026-09-11T07:00:00Z'),
  ('00000000-0000-4000-8000-000000000007', '2026-09-11T09:00:00Z', 'trend-v0-proposal', 71, 'ready', false, 4, 3, 306000, 0.8, false, 'DEMO: platform×yaş×şehir/kategori (sentetik)', '{"momentum":0.8,"diversity":0.5,"freshness":0.9,"outperformance":0.6}', '{}', '2026-09-11T05:00:00Z');

insert into public.venue_summaries (venue_id, locale, claims_json, source_version, model_version, generated_at) values
  ('00000000-0000-4000-8000-000000000001', 'tr', '[{"claimType":"try","text":"DEMO: Kaynak gönderide filtre kahve ve tarçınlı çörek öneriliyor.","evidenceIds":["demo-ev-001"],"sourcePostIds":["demo-post-001"],"lastVerifiedAt":"2026-09-10T13:00:00Z","expiresAt":null},{"claimType":"atmosphere","text":"DEMO: İki kaynak sakin ve küçük bir mekan olduğunu söylüyor.","evidenceIds":["demo-ev-002","demo-ev-003"],"sourcePostIds":["demo-post-001","demo-post-002"],"lastVerifiedAt":"2026-09-10T13:00:00Z","expiresAt":null}]', 'demo-1', 'DEMO-fixture (model çalışmadı)', '2026-09-10T13:00:00Z');

insert into public.venue_sources (venue_id, source_post_id, creator_id, platform, published_at, observed_at, views, sponsored_status, stance, render_mode, source_url, rights_policy_id, rank) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1', 'tiktok', '2026-09-10T12:00:00Z', '2026-09-11T08:30:00Z', 184000, 'none_declared', 'recommend', 'link_only', 'https://fixture.invalid/tiktok/demo.creator.a/video/demo-post-001', 'demo-link-only', 0),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000b2', 'tiktok', '2026-09-09T09:00:00Z', '2026-09-11T08:30:00Z', 92000, 'unknown', 'recommend', 'link_only', 'https://fixture.invalid/tiktok/demo.creator.b/video/demo-post-002', 'demo-link-only', 1),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000c3', 'tiktok', '2026-09-08T18:00:00Z', '2026-09-11T08:30:00Z', null, 'unknown', 'recommend', 'unavailable', null, 'deny-by-default', 2);

-- Hak kayıtları (§14): demo sentetik veri için onaylı; kullanıcı importu deny-by-default (onay bekler). Teknik erişim hak değildir.
insert into private.rights_policies (id, policy_version, provider, platform, approved_by, approved_at, expires_at, permissions, notes) values
  ('demo-synthetic', '1.0', 'fixture', null, 'seed-demo', now(), null,
   '{"may_collect_metadata": true, "may_send_metadata_to_ai": true, "may_store_metrics": true, "may_download_media": false, "may_send_media_to_ai": false, "may_create_derived_summary": true, "may_store_thumbnail": false, "may_display_embed": false, "may_rehost_video": false, "may_show_creator_profile": true, "may_show_source_link": true, "may_retain_derived_data": true}'::jsonb,
   'Yalnız sentetik fixture verisi; canlı sağlayıcıya uygulanmaz.'),
  ('user-import', '1.0', null, null, null, null, null, '{}'::jsonb, 'Kullanıcı link importu: hukuki onay olmadan hiçbir işlem izni yok (deny-by-default).')
on conflict (id) do nothing;

-- Demo izleme satırları: fixture adaptörü, dataMode=demo iken ücretsiz; canlı ingestion policy ile kapalı.
insert into private.creator_monitoring (account_id, enabled, next_poll_at, rights_policy_id, provider)
select a.id, true, now(), 'demo-synthetic', 'fixture' from public.creator_accounts a where a.platform_user_id in ('8000000000000000001', '8000000000000000002')
on conflict (account_id) do nothing;
