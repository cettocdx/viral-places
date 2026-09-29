-- Doğru kişiler (ürün sahibi, 21.09.2026): yalnız onaylı içerik üreticilerinin mekan önerileri yayına girer.
-- Aday listesini betik puanlar, ürün sahibi onay ekranından onaylar/reddeder.
create table if not exists private.creator_vetting (
  account_id uuid primary key references public.creator_accounts(id) on delete cascade,
  verdict text not null default 'candidate' check (verdict in ('candidate', 'approved', 'rejected')),
  kind text,
  istanbul_focused boolean,
  recommends_venues boolean,
  score numeric,
  recommend_posts integer not null default 0,
  total_posts integer not null default 0,
  reason text,
  sample_captions jsonb not null default '[]'::jsonb,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creator_vetting_verdict_idx on private.creator_vetting (verdict, score desc);

-- Onay ekranı için: adaylar hesap bilgileriyle (service_role, admin token arkasında)
create or replace function public.admin_list_creator_candidates(p_verdict text default 'candidate', p_limit integer default 200)
returns table (account_id uuid, handle text, display_name text, avatar_url text, follower_count bigint, verdict text, kind text,
               istanbul_focused boolean, recommends_venues boolean, score numeric, recommend_posts integer, total_posts integer,
               reason text, sample_captions jsonb)
language sql stable security definer set search_path = ''
as $$
  select v.account_id, a.handle, c.display_name, a.avatar_url, a.follower_count::bigint, v.verdict, v.kind, v.istanbul_focused,
         v.recommends_venues, v.score, v.recommend_posts, v.total_posts, v.reason, v.sample_captions
  from private.creator_vetting v join public.creator_accounts a on a.id = v.account_id
  join public.creators c on c.id = a.creator_id
  where v.verdict = coalesce(p_verdict, 'candidate')
  order by v.score desc nulls last
  limit least(greatest(coalesce(p_limit, 200), 1), 500)
$$;
revoke execute on function public.admin_list_creator_candidates(text, integer) from public, anon, authenticated;
grant execute on function public.admin_list_creator_candidates(text, integer) to service_role;

create or replace function public.admin_decide_creator(p_account_id uuid, p_verdict text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_verdict not in ('approved', 'rejected', 'candidate') then raise exception 'VERDICT_INVALID'; end if;
  update private.creator_vetting set verdict = p_verdict, decided_by = 'owner', decided_at = now(), updated_at = now()
  where account_id = p_account_id;
end $$;
revoke execute on function public.admin_decide_creator(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_decide_creator(uuid, text) to service_role;
