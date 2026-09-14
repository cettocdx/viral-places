-- RLS ve yetki matrisi (§18.5). Exposed şemada RLS açılmadan grant verilmez.
-- Kural: TO authenticated + sahiplik USING/WITH CHECK; auth.uid() (select) ile sarılır; user_metadata yetki sayılmaz.

alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.creators enable row level security;
alter table public.creator_accounts enable row level security;
alter table public.venues enable row level security;
alter table public.venue_aliases enable row level security;
alter table public.venue_external_ids enable row level security;
alter table public.collections enable row level security;
alter table public.saved_places enable row level security;
alter table public.creator_follows enable row level security;
alter table public.plans enable row level security;
alter table public.plan_items enable row level security;
alter table public.user_reports enable row level security;

-- Grants (Data API): yalnız gereken tablolar/işlemler.
grant usage on schema public to anon, authenticated;
grant select on public.cities, public.creators, public.creator_accounts, public.venues, public.venue_aliases to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.collections, public.saved_places, public.creator_follows, public.plans, public.plan_items to authenticated;
grant select, insert on public.user_reports to authenticated;
-- venue_external_ids (Google place_id) istemciye açılmaz.

-- profiles: yalnız kendi satırı
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Public okuma: yalnız yayımlanmış mekanlar ve aktif creator'lar (misafir dahil)
create policy cities_public_read on public.cities for select to anon, authenticated using (true);
create policy venues_public_read on public.venues for select to anon, authenticated using (status = 'published');
create policy venue_aliases_public_read on public.venue_aliases for select to anon, authenticated
  using (exists (select 1 from public.venues v where v.id = venue_aliases.venue_id and v.status = 'published'));
create policy creators_public_read on public.creators for select to anon, authenticated using (status = 'active');
create policy creator_accounts_public_read on public.creator_accounts for select to anon, authenticated
  using (exists (select 1 from public.creators c where c.id = creator_accounts.creator_id and c.status = 'active'));

-- collections
create policy collections_select_own on public.collections for select to authenticated using ((select auth.uid()) = owner_id);
create policy collections_insert_own on public.collections for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy collections_update_own on public.collections for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy collections_delete_own on public.collections for delete to authenticated using ((select auth.uid()) = owner_id);

-- saved_places: sahiplik + koleksiyon sahibiyle uyum + yalnız yayımlanmış mekan
create policy saved_select_own on public.saved_places for select to authenticated using ((select auth.uid()) = owner_id);
create policy saved_insert_own on public.saved_places for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid()))
    and exists (select 1 from public.venues v where v.id = venue_id and v.status = 'published')
  );
create policy saved_delete_own on public.saved_places for delete to authenticated using ((select auth.uid()) = owner_id);

-- creator_follows: uygulama içi takip
create policy follows_select_own on public.creator_follows for select to authenticated using ((select auth.uid()) = owner_id);
create policy follows_insert_own on public.creator_follows for insert to authenticated
  with check ((select auth.uid()) = owner_id and exists (select 1 from public.creators c where c.id = creator_id and c.status = 'active'));
create policy follows_delete_own on public.creator_follows for delete to authenticated using ((select auth.uid()) = owner_id);

-- plans / plan_items: plan sahibi
create policy plans_select_own on public.plans for select to authenticated using ((select auth.uid()) = owner_id);
create policy plans_insert_own on public.plans for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy plans_update_own on public.plans for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy plans_delete_own on public.plans for delete to authenticated using ((select auth.uid()) = owner_id);

create policy plan_items_select_own on public.plan_items for select to authenticated
  using (exists (select 1 from public.plans p where p.id = plan_items.plan_id and p.owner_id = (select auth.uid())));
create policy plan_items_insert_own on public.plan_items for insert to authenticated
  with check (
    exists (select 1 from public.plans p where p.id = plan_id and p.owner_id = (select auth.uid()))
    and exists (select 1 from public.venues v where v.id = venue_id and v.status = 'published')
  );
create policy plan_items_update_own on public.plan_items for update to authenticated
  using (exists (select 1 from public.plans p where p.id = plan_items.plan_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.plans p where p.id = plan_id and p.owner_id = (select auth.uid())));
create policy plan_items_delete_own on public.plan_items for delete to authenticated
  using (exists (select 1 from public.plans p where p.id = plan_items.plan_id and p.owner_id = (select auth.uid())));

-- user_reports: kullanıcı yalnız kendi raporunu görür/oluşturur
create policy reports_select_own on public.user_reports for select to authenticated using ((select auth.uid()) = reporter_id);
create policy reports_insert_own on public.user_reports for insert to authenticated with check ((select auth.uid()) = reporter_id);

-- Plan revision: expectedRevision ile atomik sıra değişimi (§19.4). SECURITY INVOKER; RLS geçerli.
create or replace function public.reorder_plan_items(p_plan_id uuid, p_ordered_item_ids uuid[], p_expected_revision integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_revision integer;
  v_count integer;
begin
  select revision into v_revision from public.plans where id = p_plan_id for update;
  if v_revision is null then
    raise exception 'PLAN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_revision <> p_expected_revision then
    raise exception 'PLAN_REVISION_CONFLICT' using errcode = 'P0001', detail = format('expected %s actual %s', p_expected_revision, v_revision);
  end if;
  select count(*) into v_count from public.plan_items where plan_id = p_plan_id;
  if v_count <> coalesce(array_length(p_ordered_item_ids, 1), 0) then
    raise exception 'PLAN_ITEMS_MISMATCH' using errcode = 'P0001';
  end if;
  update public.plan_items pi
    set position = ord.idx - 1
    from unnest(p_ordered_item_ids) with ordinality as ord(item_id, idx)
    where pi.id = ord.item_id and pi.plan_id = p_plan_id;
  if not found and v_count > 0 then
    raise exception 'PLAN_ITEMS_MISMATCH' using errcode = 'P0001';
  end if;
  update public.plans set revision = revision + 1 where id = p_plan_id returning revision into v_revision;
  return v_revision;
end;
$$;
revoke execute on function public.reorder_plan_items(uuid, uuid[], integer) from public, anon;
grant execute on function public.reorder_plan_items(uuid, uuid[], integer) to authenticated;

-- Harita sorgusu (§19.3): bbox içinde yayımlanmış, geçerli konumlu mekanlar.
-- SECURITY DEFINER gerekçesi: geo şeması Data API'ye kapalı; bu fonksiyon yalnız yayımlanmış venue + süresi dolmamış
-- konumu döndürür, kullanıcı girdisi sayısal bbox'tır; search_path boş; body içinde ek filtre var. (Skill: bilinçli istisna, kayıtlı.)
create or replace function public.map_places(p_west double precision, p_south double precision, p_east double precision, p_north double precision, p_limit integer default 100)
returns table (
  id uuid,
  name text,
  neighborhood text,
  city_id uuid,
  category public.category,
  lat double precision,
  lng double precision,
  location_origin text,
  location_expires_at timestamptz,
  family_supported boolean,
  data_mode public.data_mode
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.own_name, v.neighborhood, v.city_id, v.primary_category,
         extensions.st_y(l.location::extensions.geometry), extensions.st_x(l.location::extensions.geometry),
         l.source_type, l.expires_at, v.family_supported, v.data_mode
  from public.venues v
  join geo.venue_locations l on l.venue_id = v.id
  where v.status = 'published'
    and (l.expires_at is null or l.expires_at > now())
    and p_south between -90 and 90 and p_north between -90 and 90
    and p_west between -180 and 180 and p_east between -180 and 180
    and extensions.st_intersects(
      l.location,
      extensions.st_makeenvelope(p_west, p_south, p_east, p_north, 4326)::extensions.geography
    )
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;
revoke execute on function public.map_places(double precision, double precision, double precision, double precision, integer) from public;
grant execute on function public.map_places(double precision, double precision, double precision, double precision, integer) to anon, authenticated;
