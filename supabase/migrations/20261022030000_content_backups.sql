create function public.content_backup_tables()
returns text[]
language sql immutable
set search_path = public, pg_temp
as $$
  select array[
    'pronoun_profiles', 'site_blog_posts', 'site_changelog', 'site_favorite_games',
    'site_hardware', 'site_hardware_machine_order', 'site_now',
    'site_resume_certifications', 'site_resume_education', 'site_resume_entries',
    'site_resume_profile', 'spotify_featured_playlists', 'spotify_featured_tracks'
  ]::text[];
$$;

create function public.export_site_content()
returns jsonb
language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
declare
  table_name text;
  rows jsonb;
  tables jsonb := '{}'::jsonb;
begin
  foreach table_name in array public.content_backup_tables() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I t', table_name)
      into rows;
    tables := tables || jsonb_build_object(table_name, rows);
  end loop;
  return jsonb_build_object(
    'format', 'shortbits-content', 'version', 1,
    'exportedAt', now(), 'tables', tables
  );
end;
$$;

create function public.restore_site_content(p_backup jsonb)
returns jsonb
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  table_name text;
  row_data jsonb;
  columns text[];
  assignments text;
  rows_count integer := 0;
  affected_rows integer;
  actual_keys text[];
  expected_tables text[] := public.content_backup_tables();
  singletons text[] := array['pronoun_profiles', 'site_now', 'site_resume_profile'];
begin
  if p_backup is null or jsonb_typeof(p_backup) <> 'object'
    or octet_length(p_backup::text) > 10485760
    or p_backup->>'format' is distinct from 'shortbits-content'
    or p_backup->'version' is distinct from '1'::jsonb
    or jsonb_typeof(p_backup->'tables') is distinct from 'object'
  then
    raise exception 'Invalid content backup format or version.';
  end if;
  select array_agg(key order by key) into actual_keys from jsonb_object_keys(p_backup) key;
  if actual_keys is distinct from array['exportedAt', 'format', 'tables', 'version'] then
    raise exception 'Unexpected content backup fields.';
  end if;
  select array_agg(key order by key) into actual_keys from jsonb_object_keys(p_backup->'tables') key;
  if actual_keys is distinct from expected_tables then
    raise exception 'The backup must contain exactly the supported content tables.';
  end if;

  foreach table_name in array expected_tables loop
    if jsonb_typeof(p_backup->'tables'->table_name) is distinct from 'array' then
      raise exception 'Invalid rows for %.', table_name;
    end if;
    rows_count := rows_count + jsonb_array_length(p_backup->'tables'->table_name);
    if rows_count > 10000 then raise exception 'Backup exceeds 10000 rows.'; end if;
    if table_name = any(singletons) and (
      jsonb_array_length(p_backup->'tables'->table_name) <> 1
      or p_backup->'tables'->table_name->0->>'id' is distinct from 'primary'
    ) then raise exception 'Invalid singleton content for %.', table_name; end if;

    select array_agg(a.attname::text order by a.attname) into columns
      from pg_catalog.pg_attribute a
      where a.attrelid = format('public.%I', table_name)::regclass
        and a.attnum > 0 and not a.attisdropped;
    for row_data in select value from jsonb_array_elements(p_backup->'tables'->table_name) loop
      if jsonb_typeof(row_data) <> 'object' then raise exception 'Invalid row for %.', table_name; end if;
      select array_agg(key order by key) into actual_keys from jsonb_object_keys(row_data) key;
      if actual_keys is distinct from columns then
        raise exception 'Backup schema does not match %. Export a backup from the current version.', table_name;
      end if;
    end loop;
    execute format('lock table public.%I in share row exclusive mode', table_name);
  end loop;

  foreach table_name in array expected_tables loop
    if table_name = any(singletons) then
      select string_agg(format('%1$I = restored.%1$I', a.attname), ', ' order by a.attnum)
        into assignments from pg_catalog.pg_attribute a
        where a.attrelid = format('public.%I', table_name)::regclass
          and a.attnum > 0 and not a.attisdropped and a.attname <> 'id';
      execute format(
        'update public.%1$I target set %2$s from jsonb_populate_record(null::public.%1$I, $1) restored where target.id = ''primary''',
        table_name, assignments
      ) using p_backup->'tables'->table_name->0;
      get diagnostics affected_rows = row_count;
      if affected_rows <> 1 then raise exception 'Primary content row is missing from %.', table_name; end if;
    else
      execute format('delete from public.%I', table_name);
      execute format(
        'insert into public.%1$I select * from jsonb_populate_recordset(null::public.%1$I, $1)',
        table_name
      ) using p_backup->'tables'->table_name;
    end if;
  end loop;
  return jsonb_build_object('tables', cardinality(expected_tables), 'rows', rows_count);
end;
$$;

revoke all on function public.content_backup_tables() from public, anon;
revoke all on function public.export_site_content() from public, anon;
revoke all on function public.restore_site_content(jsonb) from public, anon;
grant execute on function public.content_backup_tables() to authenticated;
grant execute on function public.export_site_content() to authenticated;
grant execute on function public.restore_site_content(jsonb) to authenticated;
