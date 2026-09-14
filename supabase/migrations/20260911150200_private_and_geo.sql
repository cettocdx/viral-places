-- private: ingestion/hak/işletim tabloları (§18.2–18.3, §14). geo: konum ve alan bazlı izinli cache (§16.4).

create table private.rights_policies (
  id text primary key,
  policy_version text not null,
  provider text,
  platform public.social_platform,
  approved_by text,
  approved_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  permissions jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table private.creator_monitoring (
  account_id uuid primary key references public.creator_accounts (id) on delete cascade,
  enabled boolean not null default false,
  next_poll_at timestamptz,
  watermark jsonb not null default '{}'::jsonb,
  poll_interval interval not null default interval '6 hours',
  rights_policy_id text references private.rights_policies (id),
  lease_until timestamptz,
  updated_at timestamptz not null default now()
);

create table private.provider_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  run_id text not null,
  status text not null default 'received',
  cost_micro_usd bigint,
  correlation_id uuid,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (provider, run_id)
);

-- Ham kaynak gönderi: platform/post unique; public projeksiyon ayrı (§13.4)
create table private.source_posts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.creator_accounts (id) on delete cascade,
  platform public.social_platform not null,
  platform_post_id text not null,
  canonical_url text not null,
  published_at timestamptz not null,
  observed_at timestamptz not null default now(),
  status text not null default 'discovered',
  content_hash text,
  caption text,
  language text,
  sponsored_status text not null default 'unknown' check (sponsored_status in ('declared', 'none_declared', 'unknown')),
  rights_policy_id text references private.rights_policies (id),
  provider_run_id uuid references private.provider_runs (id),
  schema_version text not null default '1.0',
  unique (platform, platform_post_id)
);
create index source_posts_account_published_idx on private.source_posts (account_id, published_at desc);

-- Metrik snapshot: overwrite yok; bigint sayaçlar (§17.3)
create table private.post_metrics (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references private.source_posts (id) on delete cascade,
  provider_run_id uuid references private.provider_runs (id),
  observed_at timestamptz not null default now(),
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  quality_flags text[] not null default '{}'
);
create index post_metrics_post_observed_idx on private.post_metrics (post_id, observed_at desc);

-- Onaylı venue–post ilişkisi; yalnız approved olanlar public projeksiyona çıkar (§16)
create table private.venue_post_links (
  venue_id uuid not null references public.venues (id) on delete cascade,
  post_id uuid not null references private.source_posts (id) on delete cascade,
  mention_id text not null,
  stance text not null check (stance in ('recommend', 'neutral', 'avoid', 'unclear')),
  resolution_status text not null default 'unresolved' check (resolution_status in ('unresolved', 'review_required', 'approved', 'rejected')),
  resolver_version text not null,
  decided_by uuid,
  decided_at timestamptz,
  primary key (venue_id, post_id, mention_id)
);

create table private.ingest_inbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  run_id text not null,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, run_id, event_type)
);

create table private.job_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null,
  idempotency_key text not null unique,
  correlation_id uuid,
  attempt_count integer not null default 0,
  next_retry_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table private.review_tasks (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  subject_ref jsonb not null,
  status text not null default 'open' check (status in ('open', 'decided', 'expired')),
  created_at timestamptz not null default now()
);

create table private.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  subject_ref jsonb not null,
  before jsonb,
  after jsonb,
  reason text,
  correlation_id uuid,
  created_at timestamptz not null default now()
);

-- geo: venue konumları; kaynak ve süre (Google koordinatında expires_at zorunlu)
create table geo.venue_locations (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  location extensions.geography(Point, 4326) not null,
  source_type text not null check (source_type in ('own_verified', 'creator_supplied', 'google_cache', 'synthetic')),
  source_ref text,
  expires_at timestamptz,
  observed_at timestamptz not null default now(),
  constraint google_cache_requires_expiry check (source_type <> 'google_cache' or expires_at is not null)
);
create index venue_locations_gix on geo.venue_locations using gist (location);

-- Deny-by-default: private/geo tablolarında RLS açık; politika yok → yalnız service_role/postgres.
alter table private.rights_policies enable row level security;
alter table private.creator_monitoring enable row level security;
alter table private.provider_runs enable row level security;
alter table private.source_posts enable row level security;
alter table private.post_metrics enable row level security;
alter table private.venue_post_links enable row level security;
alter table private.ingest_inbox enable row level security;
alter table private.job_outbox enable row level security;
alter table private.review_tasks enable row level security;
alter table private.audit_events enable row level security;
alter table geo.venue_locations enable row level security;
