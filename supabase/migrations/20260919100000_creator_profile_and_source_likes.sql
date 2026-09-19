-- Ürün sahibi gereksinimi (19 Eylül 2026): mekan detayında creator, izlenme, beğeni, takipçi; creator profilinde
-- fotoğraf ve platform adresi. Ek kolonlar (geriye uyumlu). Değerler yalnız gözlemdir (platform_bio_observed / followers observed).
alter table public.creator_accounts
  add column if not exists avatar_url text,
  add column if not exists follower_count bigint,
  add column if not exists post_count bigint,
  add column if not exists bio text,
  add column if not exists profile_observed_at timestamptz;

comment on column public.creator_accounts.avatar_url is 'Platform avatarı (gözlemlenen URL; may_show_creator_profile hakkıyla gösterilir; sağlayıcı CDN süreli olabilir → poll ile tazelenir).';
comment on column public.creator_accounts.follower_count is 'Gözlemlenen takipçi sayısı (platformFollowers.count); null = bilinmiyor.';

alter table public.venue_sources
  add column if not exists likes bigint;

comment on column public.venue_sources.likes is 'Son gözlemdeki beğeni sayısı (private.post_metrics.likes); null = bilinmiyor (null ≠ 0).';
