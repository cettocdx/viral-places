-- Çok şehir (ürün sahibi, 02.10.2026): İstanbul'dan sonra Paris, Milano, Londra, Barselona, Roma.
-- Şehir tanımı tek yerde: ad + Google'ın döndürdüğü yazımlar (aliases) + kapsama yarıçapı. Kod şehir adı sabitlemez.

alter table public.cities
  add column if not exists aliases text[] not null default '{}',
  add column if not exists radius_km numeric not null default 35 check (radius_km > 0 and radius_km <= 200),
  add column if not exists default_language text not null default 'tr';

update public.cities set aliases = array['istanbul', 'i̇stanbul', 'stambul', 'constantinople'], radius_km = 60, default_language = 'tr'
where slug in ('demo-city-ist', 'istanbul') or lower(name) in ('istanbul', 'i̇stanbul');

-- Sabit kimlikler: yerel, bulut ve fixture'lar aynı şehri aynı kimlikle görür.
insert into public.cities (id, slug, name, country_code, timezone, center_lat, center_lng, coverage_status, data_mode, aliases, radius_km, default_language) values
  ('00000000-0000-4000-8000-0000000c1001', 'paris',     'Paris',     'FR', 'Europe/Paris',  48.8566,  2.3522, 'none', 'live', array['paris'], 25, 'fr'),
  ('00000000-0000-4000-8000-0000000c1002', 'milano',    'Milano',    'IT', 'Europe/Rome',   45.4642,  9.1900, 'none', 'live', array['milano', 'milan', 'mailand'], 25, 'it'),
  ('00000000-0000-4000-8000-0000000c1003', 'london',    'Londra',    'GB', 'Europe/London', 51.5072, -0.1276, 'none', 'live', array['london', 'londra', 'londres'], 35, 'en'),
  ('00000000-0000-4000-8000-0000000c1004', 'barcelona', 'Barselona', 'ES', 'Europe/Madrid', 41.3874,  2.1686, 'none', 'live', array['barcelona', 'barselona', 'barcelone'], 20, 'es'),
  ('00000000-0000-4000-8000-0000000c1005', 'roma',      'Roma',      'IT', 'Europe/Rome',   41.9028, 12.4964, 'none', 'live', array['roma', 'rome', 'rom'], 25, 'it')
on conflict (id) do nothing;

-- Ad/yazım ile şehir: büyük-küçük harf ve Türkçe noktalı I farkı gözetmeden.
create or replace function public.city_by_name(p_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.cities c
  where lower(c.name) = lower(trim(p_name)) or c.slug = lower(trim(p_name))
     or lower(trim(p_name)) = any (c.aliases)
  limit 1;
$$;

-- Noktanın düştüğü şehir: kapsama yarıçapı içindeki en yakın şehir; yoksa null.
create or replace function public.city_for_point(p_lat double precision, p_lng double precision)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.cities c
  where extensions.st_dwithin(
    extensions.st_makepoint(c.center_lng, c.center_lat)::extensions.geography,
    extensions.st_makepoint(p_lng, p_lat)::extensions.geography,
    c.radius_km * 1000)
  order by extensions.st_distance(
    extensions.st_makepoint(c.center_lng, c.center_lat)::extensions.geography,
    extensions.st_makepoint(p_lng, p_lat)::extensions.geography)
  limit 1;
$$;

grant execute on function public.city_by_name(text) to anon, authenticated, service_role;
grant execute on function public.city_for_point(double precision, double precision) to anon, authenticated, service_role;

-- Creator'ın ana şehri: eşleştirmede şehir ipucu yedeği ve şehir başına kapsam sayımı buradan.
alter table private.creator_vetting add column if not exists home_city_id uuid references public.cities(id);
update private.creator_vetting set home_city_id = (select public.city_by_name('istanbul'))
where istanbul_focused is true and home_city_id is null;
create index if not exists creator_vetting_home_city_idx on private.creator_vetting (home_city_id) where verdict = 'approved';
