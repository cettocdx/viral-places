-- Çakışma anahtarı dışarıdan verilebilir: bazı tabloların vekil kimliği var, eşleşme doğal anahtarla yapılır.
create or replace function public.sync_upsert(p_table regclass, p_rows jsonb, p_conflict text default null)
returns integer language plpgsql as $$
declare v_pk text; v_set text; v_sql text; v_count integer;
begin
  if p_conflict is null then
    select string_agg(quote_ident(a.attname), ', ' order by k.ord) into v_pk
    from pg_index i
    join lateral unnest(i.indkey) with ordinality as k(attnum, ord) on true
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
    where i.indrelid = p_table and i.indisprimary;
  else
    v_pk := p_conflict;
  end if;

  select string_agg(format('%1$I = excluded.%1$I', a.attname), ', ') into v_set
  from pg_attribute a
  where a.attrelid = p_table and a.attnum > 0 and not a.attisdropped
    and position(quote_ident(a.attname) in v_pk) = 0;

  v_sql := format('insert into %s select * from jsonb_populate_recordset(null::%s, $1) on conflict (%s) do update set %s',
                  p_table, p_table, v_pk, v_set);
  execute v_sql using p_rows;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
