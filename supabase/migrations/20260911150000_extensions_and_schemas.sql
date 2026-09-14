-- Viral Places — M2 temel: uzantılar, şema sınırları, ortak yardımcılar (şartname §18.1, §18.5).
-- public: yalnız son kullanıcıya uygun veriler (RLS + açık grant). private: ingestion/hak/maliyet/audit.
-- geo: coğrafi veri ve alan bazlı izinli cache; Data API'ye açılmaz.

create extension if not exists postgis with schema extensions;

create schema if not exists private;
create schema if not exists geo;

-- Deny-by-default: anon/authenticated bu şemalara doğrudan erişemez.
revoke all on schema private from public, anon, authenticated;
revoke all on schema geo from public, anon, authenticated;
grant usage on schema private to service_role;
grant usage on schema geo to service_role;

-- Ortak enumlar (domain paketindeki string birlikleriyle birebir).
create type public.category as enum ('food', 'coffee', 'nightlife', 'family', 'culture', 'sightseeing', 'shopping');
create type public.venue_status as enum ('draft', 'review_required', 'published', 'hidden', 'takedown');
create type public.data_mode as enum ('demo', 'live');
create type public.social_platform as enum ('tiktok', 'instagram');
create type public.render_mode as enum ('official_embed', 'licensed_native', 'link_only', 'unavailable');
create type public.claim_status as enum ('unclaimed', 'pending', 'claimed');

-- updated_at tetikleyicisi
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
