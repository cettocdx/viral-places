-- Çekirdek public tablolar (§18.2). Tüm kimlikler UUID; platform kimlikleri text; zamanlar timestamptz.

-- profiles: id = auth.users.id; kullanıcı kendi satırını yönetir; rol alanı istemciden değiştirilemez.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  timezone text not null default 'Europe/Istanbul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();

-- Yeni auth kullanıcısı için profil satırı (SECURITY DEFINER zorunlu: auth.users tetikleyicisi; auth şeması dışına yazılmaz)
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  country_code char(2) not null,
  timezone text not null,
  center_lat double precision not null check (center_lat between -90 and 90),
  center_lng double precision not null check (center_lng between -180 and 180),
  coverage_status text not null default 'none' check (coverage_status in ('none', 'pilot', 'growing', 'covered')),
  data_mode public.data_mode not null default 'live',
  created_at timestamptz not null default now()
);

create table public.creators (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  claim_status public.claim_status not null default 'unclaimed',
  status text not null default 'active' check (status in ('active', 'paused', 'removed')),
  data_mode public.data_mode not null default 'live',
  created_at timestamptz not null default now()
);

create table public.creator_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  platform public.social_platform not null,
  platform_user_id text not null,
  handle text not null,
  canonical_url text not null,
  verification_kind text not null default 'none' check (verification_kind in ('none', 'platform_badge_observed', 'app_claimed')),
  observed_at timestamptz not null default now(),
  unique (platform, platform_user_id)
);
create index creator_accounts_creator_idx on public.creator_accounts (creator_id);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  own_name text not null,
  city_id uuid not null references public.cities (id),
  neighborhood text,
  primary_category public.category not null,
  status public.venue_status not null default 'draft',
  data_mode public.data_mode not null default 'live',
  family_supported boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index venues_city_status_idx on public.venues (city_id, status);
create index venues_status_category_idx on public.venues (status, primary_category);
create trigger venues_set_updated_at before update on public.venues for each row execute function private.set_updated_at();

create table public.venue_aliases (
  venue_id uuid not null references public.venues (id) on delete cascade,
  alias text not null,
  language text,
  source_ref text,
  primary key (venue_id, alias)
);

-- Google place_id ve diğer kimlikler; ayrı kaynak politikası (§16.4)
create table public.venue_external_ids (
  venue_id uuid not null references public.venues (id) on delete cascade,
  provider text not null check (provider in ('google_places')),
  external_id text not null,
  checked_at timestamptz not null default now(),
  primary key (venue_id, provider)
);

-- Kullanıcı kütüphanesi (§20)
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  visibility text not null default 'private' check (visibility = 'private'),
  created_at timestamptz not null default now()
);
create index collections_owner_idx on public.collections (owner_id);

create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, venue_id, collection_id)
);
create index saved_places_owner_idx on public.saved_places (owner_id);

create table public.creator_follows (
  owner_id uuid not null references auth.users (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, creator_id)
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  city_id uuid references public.cities (id),
  date_local date not null,
  timezone text not null,
  title text not null check (char_length(title) between 1 and 80),
  revision integer not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plans_owner_idx on public.plans (owner_id);
create trigger plans_set_updated_at before update on public.plans for each row execute function private.set_updated_at();

create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  position integer not null check (position >= 0),
  intended_time time,
  duration_minutes integer check (duration_minutes between 1 and 720),
  note text check (char_length(note) <= 500),
  unique (plan_id, venue_id),
  unique (plan_id, position) deferrable initially deferred
);
create index plan_items_plan_idx on public.plan_items (plan_id);

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  venue_id uuid references public.venues (id) on delete set null,
  reason text not null check (reason in ('wrong_place', 'rights', 'content', 'other')),
  text text check (char_length(text) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  created_at timestamptz not null default now()
);
create index user_reports_reporter_idx on public.user_reports (reporter_id);
