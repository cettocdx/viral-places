-- Uygulama olayları (29.10.2026): anonim kullanım + hata kayıtları. Kişisel veri yok: kullanıcı kimliği yerine
-- cihazda üretilen rastgele kurulum kimliği; konum, ad, e-posta tutulmaz. Yalnız ekleme; okuma servis rolüyle.
create table if not exists public.app_events (
  id bigint generated always as identity primary key,
  install_id text not null check (length(install_id) between 8 and 64),
  name text not null check (name ~ '^[a-z_.]{2,48}$'),
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) < 4096),
  app_version text,
  platform text,
  created_at timestamptz not null default now()
);
create index if not exists app_events_name_time on public.app_events (name, created_at desc);
alter table public.app_events enable row level security;
drop policy if exists app_events_insert on public.app_events;
create policy app_events_insert on public.app_events for insert to anon, authenticated with check (true);
grant insert on public.app_events to anon, authenticated;
