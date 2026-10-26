create table public.site_message_pools (
  id text primary key check (id ~ '^custom-[a-z0-9-]{1,70}$'),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  schedule text not null check (schedule in ('annual', 'once')),
  starts_on date not null,
  ends_on date not null,
  mode text not null default 'additive' check (mode in ('additive', 'exclusive')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (schedule = 'annual' or ends_on >= starts_on),
  check (starts_on between date '1000-01-01' and date '9999-12-31'
    and ends_on between date '1000-01-01' and date '9999-12-31')
);

create function public.valid_message_timezone(value text)
returns boolean language sql stable
set search_path = public, pg_temp
as $$ select exists (select from pg_catalog.pg_timezone_names where name = value); $$;

create table public.site_message_settings (
  id text primary key default 'primary' check (id = 'primary'),
  timezone text not null default 'America/Chicago' check (public.valid_message_timezone(timezone)),
  updated_at timestamptz not null default now()
);
insert into public.site_message_settings (id) values ('primary');

alter table public.site_message_pools enable row level security;
alter table public.site_message_settings enable row level security;
create policy "Public can read enabled message pools" on public.site_message_pools
  for select to anon using (enabled);
create policy "Authenticated users can manage message pools" on public.site_message_pools
  for all to authenticated using (true) with check (true);
create policy "Public can read the message calendar" on public.site_message_settings
  for select to anon using (true);
create policy "Authenticated users can read the message calendar" on public.site_message_settings
  for select to authenticated using (true);
create policy "Authenticated users can update the message calendar" on public.site_message_settings
  for update to authenticated using (true) with check (id = 'primary');
revoke all on public.site_message_pools, public.site_message_settings from anon, authenticated;
grant select on public.site_message_pools, public.site_message_settings to anon, authenticated;
grant insert, update, delete on public.site_message_pools to authenticated;
grant update on public.site_message_settings to authenticated;

create function public.valid_message_profile(value text)
returns boolean language sql stable
set search_path = public, pg_temp
as $$
  select value = any(array[
    'standard', 'new-year', 'christmas', 'halloween', 'birthday', 'valentines',
    'st-patricks', 'easter', 'earth-day', 'independence-day', 'pi-day', 'april-fools',
    '404-day', 'may-fourth', 'leap-day', 'thanksgiving', 'friday-the-13th'
  ]) or exists (select from public.site_message_pools where id = value);
$$;
alter table public.site_message_catalog drop constraint site_message_catalog_profile_check;
alter table public.site_message_catalog add constraint site_message_catalog_profile_check
  check (public.valid_message_profile(profile));
alter table public.site_message_catalog add column pool_id text
  references public.site_message_pools(id) on delete cascade;
create function public.set_message_pool_reference()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.pool_id := case when new.profile like 'custom-%' then new.profile else null end;
  return new;
end;
$$;
create trigger message_pool_reference before insert or update of profile, pool_id on public.site_message_catalog
  for each row execute function public.set_message_pool_reference();
alter policy "Public can read enabled message entries" on public.site_message_catalog
  using (enabled and public.valid_message_profile(profile));

create function public.manage_message_pool_identity()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.id <> old.id then
    raise exception 'Message pool IDs cannot be changed.';
  end if;
  return new;
end;
$$;
create trigger message_pool_identity before update on public.site_message_pools
  for each row execute function public.manage_message_pool_identity();

create or replace function public.content_backup_tables()
returns text[] language sql immutable
set search_path = public, pg_temp
as $$
  select array[
    'pronoun_profiles', 'site_blog_posts', 'site_changelog', 'site_creators', 'site_favorite_games',
    'site_hardware', 'site_hardware_machine_order', 'site_message_catalog', 'site_message_pools',
    'site_message_settings', 'site_now', 'site_resume_certifications', 'site_resume_education',
    'site_resume_entries', 'site_resume_profile', 'spotify_featured_playlists', 'spotify_featured_tracks'
  ]::text[];
$$;

create or replace function public.restore_site_content(p_backup jsonb)
returns jsonb language plpgsql security invoker
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
  singletons text[] := array['pronoun_profiles', 'site_now', 'site_resume_profile', 'site_message_settings'];
begin
  if p_backup is null or jsonb_typeof(p_backup) <> 'object'
    or octet_length(p_backup::text) > 10485760
    or p_backup->>'format' is distinct from 'shortbits-content'
    or p_backup->'version' is distinct from '1'::jsonb
    or jsonb_typeof(p_backup->'tables') is distinct from 'object'
  then raise exception 'Invalid content backup format or version.'; end if;
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

  -- Restore custom pool definitions before their messages; deletion cascades to the old catalog.
  foreach table_name in array array_prepend('site_message_pools', array_remove(expected_tables, 'site_message_pools')) loop
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
      execute format('insert into public.%1$I select * from jsonb_populate_recordset(null::public.%1$I, $1)', table_name)
        using p_backup->'tables'->table_name;
    end if;
  end loop;
  return jsonb_build_object('tables', cardinality(expected_tables), 'rows', rows_count);
end;
$$;
