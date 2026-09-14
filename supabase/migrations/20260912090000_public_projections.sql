-- Public projeksiyonlar (§18.2 venue_scores/venue_summaries/media, §19 DTO'lar, §14.2 gösterim modu).
-- Kaynak: private tablolar; burada yalnız yayımlanabilir, hakları uygun alanlar.

create table public.venue_scores (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  as_of timestamptz not null,
  score_version text not null,
  normalization_version text not null default 'cohort-v0-proposal',
  score integer check (score between 0 and 100),
  status text not null check (status in ('ready', 'insufficient_data', 'stale', 'withheld')),
  trending boolean not null default false,
  window_days integer not null default 7,
  eligible_posts integer not null default 0,
  distinct_creators integer not null default 0,
  accessible_views bigint,
  metrics_coverage numeric(4,3) check (metrics_coverage between 0 and 1),
  baseline_partial boolean not null default false,
  baseline_scope text,
  components_json jsonb not null default '{}'::jsonb,
  reason_codes text[] not null default '{}',
  last_successful_observation_at timestamptz,
  evidence_snapshot_ids uuid[] not null default '{}'
);

create table public.venue_summaries (
  venue_id uuid not null references public.venues (id) on delete cascade,
  locale text not null check (locale in ('tr', 'en')),
  claims_json jsonb not null default '[]'::jsonb,
  source_version text not null,
  model_version text,
  generated_at timestamptz,
  expires_at timestamptz,
  primary key (venue_id, locale)
);

-- Kaynak gönderi public projeksiyonu: yalnız onaylı bağlantı + izinli gösterim modu (ham özel alan yok)
create table public.venue_sources (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  source_post_id uuid not null,
  creator_id uuid not null references public.creators (id) on delete cascade,
  platform public.social_platform not null,
  published_at timestamptz not null,
  observed_at timestamptz not null,
  views bigint,
  sponsored_status text not null check (sponsored_status in ('declared', 'none_declared', 'unknown')),
  stance text not null check (stance in ('recommend', 'neutral', 'avoid', 'unclear')),
  render_mode public.render_mode not null default 'unavailable',
  source_url text,
  thumbnail_url text,
  rights_policy_id text not null default 'deny-by-default',
  rights_expires_at timestamptz,
  rank integer not null default 0,
  unique (venue_id, source_post_id)
);
create index venue_sources_venue_rank_idx on public.venue_sources (venue_id, rank);

-- Kullanıcı link import istekleri (§19.2 POST /imports): kota + idempotency; işleme BLOCKED iken bile durum izlenir.
create table public.import_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  guest_session_id text,
  normalized_url text not null,
  idempotency_key text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'resolved', 'unresolved', 'blocked', 'failed')),
  result_venue_id uuid references public.venues (id),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint import_owner_or_guest check (owner_id is not null or guest_session_id is not null)
);
create unique index import_requests_idem_idx on public.import_requests (coalesce(owner_id::text, guest_session_id), idempotency_key);
create index import_requests_owner_idx on public.import_requests (owner_id, created_at desc);
create trigger import_requests_set_updated_at before update on public.import_requests for each row execute function private.set_updated_at();

alter table public.venue_scores enable row level security;
alter table public.venue_summaries enable row level security;
alter table public.venue_sources enable row level security;
alter table public.import_requests enable row level security;

grant select on public.venue_scores, public.venue_summaries, public.venue_sources to anon, authenticated;
grant select, insert on public.import_requests to authenticated;

create policy venue_scores_public_read on public.venue_scores for select to anon, authenticated
  using (exists (select 1 from public.venues v where v.id = venue_scores.venue_id and v.status = 'published'));
create policy venue_summaries_public_read on public.venue_summaries for select to anon, authenticated
  using (exists (select 1 from public.venues v where v.id = venue_summaries.venue_id and v.status = 'published'));
create policy venue_sources_public_read on public.venue_sources for select to anon, authenticated
  using (exists (select 1 from public.venues v where v.id = venue_sources.venue_id and v.status = 'published'));
create policy imports_select_own on public.import_requests for select to authenticated using ((select auth.uid()) = owner_id);
create policy imports_insert_own on public.import_requests for insert to authenticated with check ((select auth.uid()) = owner_id and guest_session_id is null);

-- Yayımlanmamış mekana ait projeksiyonlar anon'a görünmez; worker (service_role) yazar.
