-- Motor tabloları (§15 AI kanıtı, §16 eşleştirme, §16.4 Google cache, §17 cohort, §27.4 bütçe, §12 keşif, §18.3 iş/audit).
-- Tümü private şemada; RLS açık, politika yok → yalnız service_role/worker. Public projeksiyonlar worker tarafından yazılır.

-- 1) source_posts genişletmeleri: normalize kaydındaki yeni alanlar (hashtags, yer etiketi, thumbnail, erişilebilirlik, sağlayıcı)
alter table private.source_posts
  add column if not exists provider text,
  add column if not exists availability text not null default 'available' check (availability in ('available', 'private', 'deleted', 'geo_restricted', 'unknown')),
  add column if not exists hashtags text[] not null default '{}',
  add column if not exists location_tag jsonb,
  add column if not exists thumbnail_url text,
  add column if not exists platform_shortcode text,
  add column if not exists upload_country_hint char(2),
  add column if not exists media_duration_ms integer,
  add column if not exists download_url_present boolean not null default false,
  add column if not exists last_extracted_hash text,
  add column if not exists last_availability_check_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
create trigger source_posts_set_updated_at before update on private.source_posts for each row execute function private.set_updated_at();

-- 2) creator_monitoring: dispatcher alanları (§13.3)
alter table private.creator_monitoring
  add column if not exists provider text not null default 'scrapecreators' check (provider in ('scrapecreators', 'apify', 'ensembledata', 'instagram_graph', 'fixture')),
  add column if not exists consecutive_failures integer not null default 0,
  add column if not exists posts_last_30d integer not null default 0,
  add column if not exists last_polled_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists disabled_reason text;

-- 3) provider_runs: platform/hesap/istatistik
alter table private.provider_runs
  add column if not exists platform public.social_platform,
  add column if not exists account_id uuid references public.creator_accounts (id) on delete set null,
  add column if not exists posts_seen integer,
  add column if not exists posts_new integer,
  add column if not exists posts_edited integer,
  add column if not exists posts_rejected integer,
  add column if not exists coverage_gap boolean,
  add column if not exists error_code text;

-- 4) job_outbox: durum/lease (güvenilir tüketici, §13.5 madde 6–7)
alter table private.job_outbox
  add column if not exists status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed', 'dead')),
  add column if not exists lease_until timestamptz,
  add column if not exists run_after timestamptz not null default now(),
  add column if not exists last_error_detail text,
  add column if not exists updated_at timestamptz not null default now();
create index if not exists job_outbox_claim_idx on private.job_outbox (status, run_after) where status in ('pending', 'failed');
create index if not exists job_outbox_kind_idx on private.job_outbox (kind, status);
create trigger job_outbox_set_updated_at before update on private.job_outbox for each row execute function private.set_updated_at();

-- 5) review_tasks: karar alanları (§16.2 inceleme kuyruğu)
alter table private.review_tasks
  add column if not exists priority integer not null default 0,
  add column if not exists decision jsonb,
  add column if not exists decided_by uuid,
  add column if not exists decided_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
create index if not exists review_tasks_open_idx on private.review_tasks (status, priority desc, created_at) where status = 'open';
create trigger review_tasks_set_updated_at before update on private.review_tasks for each row execute function private.set_updated_at();

-- 6) AI çıkarım koşuları (§15.5 audit: prompt_version, model_id, input_hash, usage; aynı hash yeniden çalışmaz)
create table private.extraction_runs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references private.source_posts (id) on delete cascade,
  prompt_version text not null,
  model_id text not null,
  input_hash text not null,
  analysis_mode text not null check (analysis_mode in ('metadata_only', 'transcript', 'native_video', 'sampled_frames')),
  status text not null check (status in ('ok', 'invalid', 'refused', 'error', 'skipped')),
  skip_code text,
  output jsonb,
  issues jsonb not null default '[]'::jsonb,
  usage jsonb not null default '{}'::jsonb,
  estimated_cost_micro_usd bigint,
  attempts integer not null default 0,
  duration_ms integer,
  created_at timestamptz not null default now(),
  unique (post_id, input_hash)
);
create index extraction_runs_post_idx on private.extraction_runs (post_id, created_at desc);

-- 7) Mention'lar (§16.3: video tekil, venue–post çoktan çoğa; her mention ayrı eşleşir)
create table private.place_mentions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references private.source_posts (id) on delete cascade,
  extraction_run_id uuid not null references private.extraction_runs (id) on delete cascade,
  mention_id text not null,
  raw_place_name text,
  city_hint text,
  country_hint text,
  address_hint text,
  branch_hint text,
  category_candidates text[] not null default '{}',
  recommendation text not null check (recommendation in ('recommend', 'neutral', 'avoid', 'unclear')),
  evidence jsonb not null default '[]'::jsonb,
  claims jsonb not null default '[]'::jsonb,
  family_attributes jsonb not null default '[]'::jsonb,
  suggested_items jsonb not null default '[]'::jsonb,
  uncertainty_reasons text[] not null default '{}',
  resolution_status text not null default 'unresolved' check (resolution_status in ('unresolved', 'review_required', 'auto_match', 'approved', 'rejected')),
  resolved_venue_id uuid references public.venues (id) on delete set null,
  candidate_place_id text,
  resolver_version text,
  resolution jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (extraction_run_id, mention_id)
);
create index place_mentions_status_idx on private.place_mentions (resolution_status, created_at);
create index place_mentions_post_idx on private.place_mentions (post_id);
create trigger place_mentions_set_updated_at before update on private.place_mentions for each row execute function private.set_updated_at();

-- 8) İzinli transkript (yalnız may_send_metadata_to_ai + sağlayıcı altyazısı; ses dosyası saklanmaz)
create table private.post_transcripts (
  post_id uuid primary key references private.source_posts (id) on delete cascade,
  source text not null check (source in ('tiktok_captions', 'provider_subtitles', 'asr')),
  language text,
  segments jsonb not null default '[]'::jsonb,
  rights_policy_id text references private.rights_policies (id),
  fetched_at timestamptz not null default now(),
  expires_at timestamptz
);

-- 9) Google Places cache (§16.4): place_id kalıcı olabilir; diğer alanlar expires_at ile sınırlı (≤30 gün)
create table private.google_places_cache (
  place_id text primary key,
  name text not null,
  formatted_address text,
  lat double precision,
  lng double precision,
  types text[] not null default '{}',
  business_status text,
  city text,
  neighborhood text,
  query_text text,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint google_cache_max_30d check (expires_at <= fetched_at + interval '30 days')
);
create index google_places_cache_expiry_idx on private.google_places_cache (expires_at);

-- 10) Cohort normalizasyon tabloları (§17.4): günlük sürüm; aynı gün taban kaymaz
create table private.normalization_cohorts (
  scope text not null,
  version text not null,
  velocities double precision[] not null,
  observations integer not null,
  built_at timestamptz not null default now(),
  primary key (scope, version)
);

-- 11) Skor koşusu audit'i (replay: girdi id/hash + asOf + sürümler)
create table private.venue_score_runs (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  as_of timestamptz not null,
  score_version text not null,
  normalization_version text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index venue_score_runs_venue_idx on private.venue_score_runs (venue_id, as_of desc);

-- 12) Bütçe defteri (§27.4): gün/ay toplamları + rezervasyonlar + maliyet olayları (birim açık)
create table private.budget_days (
  day date primary key,
  spent_micro_usd bigint not null default 0,
  new_posts integer not null default 0,
  video_minutes numeric(10,2) not null default 0,
  updated_at timestamptz not null default now()
);
create trigger budget_days_set_updated_at before update on private.budget_days for each row execute function private.set_updated_at();

create table private.budget_reservations (
  id uuid primary key default gen_random_uuid(),
  day date not null references private.budget_days (day),
  job_kind text not null,
  outbox_id uuid references private.job_outbox (id) on delete set null,
  estimated_micro_usd bigint not null,
  reserved_at timestamptz not null default now(),
  lease_until timestamptz not null,
  actual_micro_usd bigint,
  reconciled_at timestamptz
);
create index budget_reservations_open_idx on private.budget_reservations (day) where reconciled_at is null;

create table private.cost_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  provider text,
  unit_kind text not null,
  units numeric(12,4) not null,
  micro_usd bigint,
  ref jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now()
);
create index cost_events_observed_idx on private.cost_events (observed_at desc);

-- 13) Creator keşif adayları (§12): nereden bulunduğu ve zamanı kaydedilir; kişisel takipçi grafiği yok
create table private.creator_discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  platform public.social_platform not null,
  platform_creator_id text not null,
  handle text not null,
  canonical_url text not null,
  found_via text not null,
  found_at timestamptz not null default now(),
  sample_captions jsonb not null default '[]'::jsonb,
  fit jsonb,
  status text not null default 'new' check (status in ('new', 'reviewed', 'monitored', 'rejected')),
  notes text,
  unique (platform, platform_creator_id)
);

-- 14) Takedown / hak kaldırma istekleri (§14.3, bütçe kesicisinden bağımsız)
create table private.takedown_requests (
  id uuid primary key default gen_random_uuid(),
  subject_ref jsonb not null,
  reason text not null,
  requested_by text,
  status text not null default 'open' check (status in ('open', 'processing', 'done')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table private.extraction_runs enable row level security;
alter table private.place_mentions enable row level security;
alter table private.post_transcripts enable row level security;
alter table private.google_places_cache enable row level security;
alter table private.normalization_cohorts enable row level security;
alter table private.venue_score_runs enable row level security;
alter table private.budget_days enable row level security;
alter table private.budget_reservations enable row level security;
alter table private.cost_events enable row level security;
alter table private.creator_discovery_candidates enable row level security;
alter table private.takedown_requests enable row level security;

-- 15) Public: venue_scores pencere alanları (§17.6 windowStart/windowEnd); import → kaynak gönderi bağı
alter table public.venue_scores
  add column if not exists window_start timestamptz,
  add column if not exists window_end timestamptz;
alter table public.import_requests add column if not exists source_post_id uuid;

-- 16) İş kuyruğu RPC'leri (service_role): claim (SKIP LOCKED + lease), finish (retry/backoff/dead), enqueue (idempotent)
create or replace function public.claim_outbox_jobs(p_limit integer, p_lease_seconds integer, p_kinds text[] default null)
returns setof private.job_outbox
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  with cte as (
    select id from private.job_outbox
    where status in ('pending', 'failed')
      and run_after <= now()
      and (lease_until is null or lease_until < now())
      and (p_kinds is null or kind = any (p_kinds))
    order by run_after
    limit least(greatest(coalesce(p_limit, 1), 1), 100)
    for update skip locked
  )
  update private.job_outbox j
    set status = 'running', lease_until = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 60), 10)), attempt_count = attempt_count + 1
    from cte where j.id = cte.id
    returning j.*;
end;
$$;
revoke execute on function public.claim_outbox_jobs(integer, integer, text[]) from public, anon, authenticated;
grant execute on function public.claim_outbox_jobs(integer, integer, text[]) to service_role;

create or replace function public.finish_outbox_job(p_id uuid, p_ok boolean, p_error_code text default null, p_error_detail text default null, p_retry_after_seconds integer default null, p_max_attempts integer default 4)
returns private.job_outbox
language plpgsql security definer set search_path = ''
as $$
declare
  v_row private.job_outbox;
begin
  select * into v_row from private.job_outbox where id = p_id for update;
  if not found then
    raise exception 'JOB_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_ok then
    update private.job_outbox set status = 'done', finished_at = now(), lease_until = null, last_error_code = null where id = p_id returning * into v_row;
  elsif p_retry_after_seconds is null or v_row.attempt_count >= p_max_attempts then
    update private.job_outbox set status = 'dead', finished_at = now(), lease_until = null, last_error_code = p_error_code, last_error_detail = left(p_error_detail, 2000) where id = p_id returning * into v_row;
  else
    update private.job_outbox set status = 'failed', lease_until = null, last_error_code = p_error_code, last_error_detail = left(p_error_detail, 2000),
      run_after = now() + make_interval(secs => p_retry_after_seconds), next_retry_at = now() + make_interval(secs => p_retry_after_seconds)
      where id = p_id returning * into v_row;
  end if;
  return v_row;
end;
$$;
revoke execute on function public.finish_outbox_job(uuid, boolean, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.finish_outbox_job(uuid, boolean, text, text, integer, integer) to service_role;

create or replace function public.enqueue_job(p_kind text, p_payload jsonb, p_idempotency_key text, p_correlation_id uuid default null, p_run_after timestamptz default now())
returns table (job_id uuid, inserted boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_kind is null or char_length(p_kind) not between 3 and 64 then
    raise exception 'JOB_KIND_INVALID' using errcode = '22023';
  end if;
  if pg_column_size(p_payload) > 65536 then
    raise exception 'PAYLOAD_TOO_LARGE' using errcode = '22023';
  end if;
  insert into private.job_outbox (kind, payload, idempotency_key, correlation_id, run_after)
    values (p_kind, coalesce(p_payload, '{}'::jsonb), p_idempotency_key, p_correlation_id, coalesce(p_run_after, now()))
    on conflict (idempotency_key) do nothing
    returning id into v_id;
  if v_id is null then
    select id into v_id from private.job_outbox where idempotency_key = p_idempotency_key;
    return query select v_id, false;
  else
    return query select v_id, true;
  end if;
end;
$$;
revoke execute on function public.enqueue_job(text, jsonb, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.enqueue_job(text, jsonb, text, uuid, timestamptz) to service_role;

-- 17) Admin inceleme kararı (§16.2 review): mention + link + audit tek transaction; admin skoru elle yükseltemez (skor tablosuna dokunmaz)
create or replace function public.decide_review_task(p_task_id uuid, p_decision text, p_venue_id uuid, p_actor uuid, p_reason text default null)
returns private.review_tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_task private.review_tasks;
  v_mention private.place_mentions;
  v_post_id uuid;
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'DECISION_INVALID' using errcode = '22023';
  end if;
  select * into v_task from private.review_tasks where id = p_task_id for update;
  if not found then
    raise exception 'REVIEW_TASK_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_task.status <> 'open' then
    raise exception 'REVIEW_TASK_CLOSED' using errcode = 'P0001';
  end if;
  if v_task.kind = 'mention_resolution' then
    select * into v_mention from private.place_mentions where id = (v_task.subject_ref->>'mentionId')::uuid for update;
    if not found then
      raise exception 'MENTION_NOT_FOUND' using errcode = 'P0002';
    end if;
    v_post_id := v_mention.post_id;
    if p_decision = 'approve' then
      if p_venue_id is null then
        raise exception 'VENUE_REQUIRED' using errcode = '22023';
      end if;
      update private.place_mentions set resolution_status = 'approved', resolved_venue_id = p_venue_id where id = v_mention.id;
      insert into private.venue_post_links (venue_id, post_id, mention_id, stance, resolution_status, resolver_version, decided_by, decided_at)
        values (p_venue_id, v_post_id, v_mention.mention_id, v_mention.recommendation, 'approved', coalesce(v_mention.resolver_version, 'manual'), p_actor, now())
        on conflict (venue_id, post_id, mention_id) do update set resolution_status = 'approved', decided_by = p_actor, decided_at = now(), stance = excluded.stance;
    else
      update private.place_mentions set resolution_status = 'rejected' where id = v_mention.id;
      update private.venue_post_links set resolution_status = 'rejected', decided_by = p_actor, decided_at = now() where post_id = v_post_id and mention_id = v_mention.mention_id;
    end if;
  end if;
  update private.review_tasks set status = 'decided', decision = jsonb_build_object('decision', p_decision, 'venueId', p_venue_id, 'reason', p_reason), decided_by = p_actor, decided_at = now()
    where id = p_task_id returning * into v_task;
  insert into private.audit_events (actor_id, action, subject_ref, after, reason, correlation_id)
    values (p_actor, 'review.' || p_decision, v_task.subject_ref, v_task.decision, p_reason, p_task_id);
  -- onay sonrası bağımlı projeksiyonlar (skor/özet/kaynak) worker tarafından yeniden üretilir
  if p_decision = 'approve' and p_venue_id is not null then
    insert into private.job_outbox (kind, payload, idempotency_key, correlation_id)
      values ('venue.refresh', jsonb_build_object('venueId', p_venue_id, 'reason', 'review_approved'), 'venue.refresh:' || p_venue_id::text || ':' || p_task_id::text, p_task_id)
      on conflict (idempotency_key) do nothing;
  end if;
  return v_task;
end;
$$;
revoke execute on function public.decide_review_task(uuid, text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.decide_review_task(uuid, text, uuid, uuid, text) to service_role;

-- 18) Süresi dolan Google cache alanlarını temizle (§16.4); place_id kalır, koordinat/adres silinir
create or replace function public.purge_expired_places_cache()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_n integer;
begin
  with upd as (
    update private.google_places_cache set lat = null, lng = null, formatted_address = null, city = null, neighborhood = null where expires_at <= now() and lat is not null returning 1
  ) select count(*) into v_n from upd;
  update geo.venue_locations set expires_at = expires_at where false; -- no-op; geo satırları venue.refresh işinde ele alınır
  return v_n;
end;
$$;
revoke execute on function public.purge_expired_places_cache() from public, anon, authenticated;
grant execute on function public.purge_expired_places_cache() to service_role;

-- 19) Admin okuma/yazma RPC'leri (service_role; API tarafında ADMIN_API_TOKEN). private şema Data API'ye kapalı olduğundan RPC zorunlu.
create or replace function public.admin_list_review_tasks(p_status text default 'open', p_limit integer default 50)
returns table (id uuid, kind text, subject_ref jsonb, status text, priority integer, created_at timestamptz, decision jsonb, decided_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.kind, t.subject_ref, t.status, t.priority, t.created_at, t.decision, t.decided_at
  from private.review_tasks t
  where t.status = coalesce(p_status, 'open')
  order by t.priority desc, t.created_at
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;
revoke execute on function public.admin_list_review_tasks(text, integer) from public, anon, authenticated;
grant execute on function public.admin_list_review_tasks(text, integer) to service_role;

create or replace function public.admin_upsert_monitored_creator(p_platform text, p_platform_user_id text, p_handle text, p_display_name text, p_rights_policy_id text, p_provider text, p_enabled boolean, p_actor uuid)
returns table (creator_id uuid, account_id uuid, enabled boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_creator uuid;
  v_account uuid;
  v_rights private.rights_policies;
begin
  select * into v_rights from private.rights_policies where id = p_rights_policy_id;
  if not found or v_rights.approved_by is null or v_rights.approved_at is null or (v_rights.revoked_at is not null and v_rights.revoked_at <= now()) or (v_rights.expires_at is not null and v_rights.expires_at <= now()) then
    raise exception 'RIGHTS_POLICY_NOT_APPROVED' using errcode = 'P0001';
  end if;
  select creator_id, id into v_creator, v_account from public.creator_accounts where platform = p_platform::public.social_platform and platform_user_id = p_platform_user_id;
  if v_account is null then
    insert into public.creators (display_name, claim_status, status, data_mode) values (coalesce(p_display_name, p_handle), 'unclaimed', 'active', 'live') returning id into v_creator;
    insert into public.creator_accounts (creator_id, platform, platform_user_id, handle, canonical_url)
      values (v_creator, p_platform::public.social_platform, p_platform_user_id, p_handle, case when p_platform = 'tiktok' then 'https://www.tiktok.com/@' || p_handle else 'https://www.instagram.com/' || p_handle || '/' end)
      returning id into v_account;
  else
    update public.creator_accounts set handle = p_handle where id = v_account;
  end if;
  insert into private.creator_monitoring (account_id, enabled, next_poll_at, rights_policy_id, provider)
    values (v_account, p_enabled, case when p_enabled then now() else null end, p_rights_policy_id, p_provider)
    on conflict (account_id) do update set enabled = excluded.enabled, rights_policy_id = excluded.rights_policy_id, provider = excluded.provider, next_poll_at = case when excluded.enabled then coalesce(private.creator_monitoring.next_poll_at, now()) else null end, disabled_reason = null, updated_at = now();
  insert into private.audit_events (actor_id, action, subject_ref, after) values (p_actor, 'creator.monitoring.upsert', jsonb_build_object('accountId', v_account), jsonb_build_object('enabled', p_enabled, 'provider', p_provider, 'rightsPolicyId', p_rights_policy_id));
  return query select v_creator, v_account, p_enabled;
end;
$$;
revoke execute on function public.admin_upsert_monitored_creator(text, text, text, text, text, text, boolean, uuid) from public, anon, authenticated;
grant execute on function public.admin_upsert_monitored_creator(text, text, text, text, text, text, boolean, uuid) to service_role;

create or replace function public.admin_list_monitored_creators()
returns table (account_id uuid, creator_id uuid, platform public.social_platform, handle text, enabled boolean, provider text, next_poll_at timestamptz, last_polled_at timestamptz, posts_last_30d integer, consecutive_failures integer, last_error_code text, disabled_reason text, rights_policy_id text)
language sql stable security definer set search_path = ''
as $$
  select m.account_id, a.creator_id, a.platform, a.handle, m.enabled, m.provider, m.next_poll_at, m.last_polled_at, m.posts_last_30d, m.consecutive_failures, m.last_error_code, m.disabled_reason, m.rights_policy_id
  from private.creator_monitoring m join public.creator_accounts a on a.id = m.account_id order by a.handle
$$;
revoke execute on function public.admin_list_monitored_creators() from public, anon, authenticated;
grant execute on function public.admin_list_monitored_creators() to service_role;

create or replace function public.admin_job_stats()
returns table (kind text, status text, count bigint, oldest timestamptz)
language sql stable security definer set search_path = ''
as $$
  select kind, status, count(*), min(created_at) from private.job_outbox group by kind, status order by kind, status
$$;
revoke execute on function public.admin_job_stats() from public, anon, authenticated;
grant execute on function public.admin_job_stats() to service_role;

create or replace function public.admin_budget_day(p_day date)
returns table (spent_usd numeric, reserved_open_usd numeric, new_posts integer, video_minutes numeric, cost_events bigint, ai_usd numeric, provider_usd numeric)
language sql stable security definer set search_path = ''
as $$
  select
    coalesce((select spent_micro_usd from private.budget_days where day = p_day), 0)::numeric / 1e6,
    coalesce((select sum(estimated_micro_usd) from private.budget_reservations where day = p_day and reconciled_at is null and lease_until > now()), 0)::numeric / 1e6,
    coalesce((select new_posts from private.budget_days where day = p_day), 0),
    coalesce((select video_minutes from private.budget_days where day = p_day), 0),
    (select count(*) from private.cost_events where observed_at::date = p_day),
    coalesce((select sum(micro_usd) from private.cost_events where observed_at::date = p_day and kind like 'ai.%'), 0)::numeric / 1e6,
    coalesce((select sum(micro_usd) from private.cost_events where observed_at::date = p_day and kind like 'provider.%'), 0)::numeric / 1e6
$$;
revoke execute on function public.admin_budget_day(date) from public, anon, authenticated;
grant execute on function public.admin_budget_day(date) to service_role;
