-- API destek fonksiyonları (§19, §13.5, §27). Her SECURITY DEFINER istisnası gerekçesiyle kayıtlıdır (ADR-016 eki).

-- 1) Yayımlanmış mekan konumları (detay/kütüphane DTO'ları için). geo şeması Data API'ye kapalı;
--    fonksiyon yalnız published + süresi dolmamış konum döndürür; girdi uuid listesi (≤200).
create or replace function public.venue_locations_public(p_ids uuid[])
returns table (venue_id uuid, lat double precision, lng double precision, location_origin text, location_expires_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select l.venue_id, extensions.st_y(l.location::extensions.geometry), extensions.st_x(l.location::extensions.geometry), l.source_type, l.expires_at
  from geo.venue_locations l
  join public.venues v on v.id = l.venue_id
  where v.status = 'published'
    and (l.expires_at is null or l.expires_at > now())
    and l.venue_id = any (p_ids)
    and coalesce(array_length(p_ids, 1), 0) <= 200
$$;
revoke execute on function public.venue_locations_public(uuid[]) from public;
grant execute on function public.venue_locations_public(uuid[]) to anon, authenticated;

-- 2) Kullanıcı link import isteği (§19.2 POST /imports): idempotent + 24 saatte 20 kota. SECURITY INVOKER; RLS geçerli.
create or replace function public.submit_import_request(p_normalized_url text, p_idempotency_key text)
returns public.import_requests
language plpgsql security invoker set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.import_requests;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 128 then
    raise exception 'IDEMPOTENCY_KEY_INVALID' using errcode = '22023';
  end if;
  select * into v_row from public.import_requests where owner_id = v_uid and idempotency_key = p_idempotency_key;
  if found then
    return v_row;
  end if;
  select count(*) into v_count from public.import_requests where owner_id = v_uid and created_at > now() - interval '24 hours';
  if v_count >= 20 then
    raise exception 'IMPORT_QUOTA_EXCEEDED' using errcode = 'P0001', detail = '20/24h';
  end if;
  insert into public.import_requests (owner_id, normalized_url, idempotency_key, status)
    values (v_uid, p_normalized_url, p_idempotency_key, 'blocked')  -- işleme hattı canlı sağlayıcı olmadan BLOCKED (§32)
    returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.submit_import_request(text, text) from public, anon;
grant execute on function public.submit_import_request(text, text) to authenticated;

-- 3) Sağlayıcı webhook kabulü (§13.5): inbox + outbox tek transaction; tekrar teslim yeni satır üretmez.
--    SECURITY DEFINER gerekçesi: private şema Data API'ye kapalı; yalnız service_role çağırabilir; girdi şema-doğrulanmış payload.
create or replace function public.accept_provider_event(p_provider text, p_run_id text, p_event_type text, p_payload jsonb)
returns table (inbox_id uuid, outbox_id uuid, inserted boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_inbox uuid;
  v_outbox uuid;
  v_key text := p_provider || ':' || p_run_id || ':' || p_event_type;
begin
  if p_provider not in ('apify', 'ensembledata') then
    raise exception 'PROVIDER_UNKNOWN' using errcode = '22023';
  end if;
  if pg_column_size(p_payload) > 65536 then
    raise exception 'PAYLOAD_TOO_LARGE' using errcode = '22023';
  end if;
  insert into private.ingest_inbox (provider, run_id, event_type, payload)
    values (p_provider, p_run_id, p_event_type, p_payload)
    on conflict (provider, run_id, event_type) do nothing
    returning id into v_inbox;
  if v_inbox is null then
    select i.id, o.id into v_inbox, v_outbox
      from private.ingest_inbox i left join private.job_outbox o on o.idempotency_key = v_key
      where i.provider = p_provider and i.run_id = p_run_id and i.event_type = p_event_type;
    return query select v_inbox, v_outbox, false;
    return;
  end if;
  insert into private.job_outbox (kind, payload, idempotency_key, correlation_id)
    values ('ingest.provider_event', jsonb_build_object('inboxId', v_inbox, 'provider', p_provider, 'runId', p_run_id, 'eventType', p_event_type), v_key, v_inbox)
    returning id into v_outbox;
  return query select v_inbox, v_outbox, true;
end;
$$;
revoke execute on function public.accept_provider_event(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.accept_provider_event(text, text, text, jsonb) to service_role;

-- 4) Plan öğesi ekleme: pozisyon = sondaki+1, tek ifade (yarış koşulu için plan satırı kilitlenir)
create or replace function public.append_plan_item(p_plan_id uuid, p_venue_id uuid, p_expected_revision integer)
returns public.plan_items
language plpgsql security invoker set search_path = ''
as $$
declare
  v_revision integer;
  v_item public.plan_items;
begin
  select revision into v_revision from public.plans where id = p_plan_id for update;
  if v_revision is null then
    raise exception 'PLAN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_revision <> p_expected_revision then
    raise exception 'PLAN_REVISION_CONFLICT' using errcode = 'P0001', detail = format('expected %s actual %s', p_expected_revision, v_revision);
  end if;
  insert into public.plan_items (plan_id, venue_id, position)
    select p_plan_id, p_venue_id, coalesce(max(position) + 1, 0) from public.plan_items where plan_id = p_plan_id
    returning * into v_item;
  update public.plans set revision = revision + 1 where id = p_plan_id;
  return v_item;
end;
$$;
revoke execute on function public.append_plan_item(uuid, uuid, integer) from public, anon;
grant execute on function public.append_plan_item(uuid, uuid, integer) to authenticated;
