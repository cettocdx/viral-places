-- İleri düzeltme (forward-fix): admin_upsert_monitored_creator, RETURNS TABLE'daki creator_id/account_id OUT
-- parametreleri ile creator_accounts kolonları çakıştığı için "column reference creator_id is ambiguous" hatası
-- veriyordu (20260913120000); aynı çakışma "on conflict (account_id)" için de geçerliydi. Çözüm: #variable_conflict use_column
-- (gövdede kolon adı değişkene göre önceliklidir) + okuma sorgusunda tablo takma adı; davranış değişmedi.
-- Kanıt: 19 Eylül 2026, ilk gerçek creator kaydında admin API 500 (INTERNAL) döndü; psql ile aynı hata yeniden üretildi.

create or replace function public.admin_upsert_monitored_creator(p_platform text, p_platform_user_id text, p_handle text, p_display_name text, p_rights_policy_id text, p_provider text, p_enabled boolean, p_actor uuid)
returns table (creator_id uuid, account_id uuid, enabled boolean)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_creator uuid;
  v_account uuid;
  v_rights private.rights_policies;
begin
  select * into v_rights from private.rights_policies rp where rp.id = p_rights_policy_id;
  if not found or v_rights.approved_by is null or v_rights.approved_at is null or (v_rights.revoked_at is not null and v_rights.revoked_at <= now()) or (v_rights.expires_at is not null and v_rights.expires_at <= now()) then
    raise exception 'RIGHTS_POLICY_NOT_APPROVED' using errcode = 'P0001';
  end if;
  select ca.creator_id, ca.id into v_creator, v_account
    from public.creator_accounts ca
    where ca.platform = p_platform::public.social_platform and ca.platform_user_id = p_platform_user_id;
  if v_account is null then
    insert into public.creators (display_name, claim_status, status, data_mode) values (coalesce(p_display_name, p_handle), 'unclaimed', 'active', 'live') returning id into v_creator;
    insert into public.creator_accounts (creator_id, platform, platform_user_id, handle, canonical_url)
      values (v_creator, p_platform::public.social_platform, p_platform_user_id, p_handle, case when p_platform = 'tiktok' then 'https://www.tiktok.com/@' || p_handle else 'https://www.instagram.com/' || p_handle || '/' end)
      returning id into v_account;
  else
    update public.creator_accounts ca set handle = p_handle where ca.id = v_account;
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
