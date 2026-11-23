create table public.changelog_publications (
  release_id text primary key,
  request jsonb not null,
  effective_version text not null,
  source_commit text not null,
  run_url text not null,
  published_at timestamptz not null,
  positions integer[] not null
);
alter table public.changelog_publications enable row level security;
revoke all on public.changelog_publications from public, anon, authenticated, service_role;
grant select on public.changelog_publications to service_role;

create function public.publish_site_changelog(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  note jsonb;
  normalized_notes jsonb := '[]'::jsonb;
  normalized_request jsonb;
  note_title text;
  note_summary text;
  requested_version text;
  effective_version text;
  version_pattern constant text := '^(0|[1-9][0-9]{0,3})[.](0|[1-9][0-9]{0,3})([.](0|[1-9][0-9]{0,3}))?$';
  current_parts integer[];
  requested_parts integer[];
  parts text[];
  prior public.changelog_publications%rowtype;
  last_position bigint;
  allocated integer[];
  publication_time timestamptz;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 65536 then
    raise exception using errcode = '22023', message = 'Invalid publication';
  end if;
  if not (p_payload ?& array['release_id', 'notes', 'source_commit', 'run_url'])
    or exists (select 1 from jsonb_object_keys(p_payload) k
      where k not in ('release_id', 'notes', 'version', 'source_commit', 'run_url'))
    or jsonb_typeof(p_payload->'release_id') is distinct from 'string'
    or (p_payload->>'release_id') !~ '^[a-z0-9][a-z0-9._-]{0,99}$'
    or jsonb_typeof(p_payload->'source_commit') is distinct from 'string'
    or (p_payload->>'source_commit') !~ '^[a-f0-9]{40}$'
    or jsonb_typeof(p_payload->'run_url') is distinct from 'string'
    or char_length(p_payload->>'run_url') > 300
    or (p_payload->>'run_url') !~ '^https://github[.]com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/actions/runs/[1-9][0-9]*$'
    or jsonb_typeof(p_payload->'notes') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Invalid publication';
  end if;
  if jsonb_array_length(p_payload->'notes') not between 1 and 20 then
    raise exception using errcode = '22023', message = 'Invalid notes';
  end if;
  for note in select value from jsonb_array_elements(p_payload->'notes') loop
    if jsonb_typeof(note) <> 'object' then
      raise exception using errcode = '22023', message = 'Invalid note';
    end if;
    if not (note ?& array['title', 'summary']) or (select count(*) from jsonb_object_keys(note)) <> 2
      or jsonb_typeof(note->'title') is distinct from 'string'
      or jsonb_typeof(note->'summary') is distinct from 'string' then
      raise exception using errcode = '22023', message = 'Invalid note';
    end if;
    note_title := btrim(note->>'title');
    note_summary := btrim(note->>'summary');
    if char_length(note_title) not between 1 and 80 or char_length(note_summary) not between 1 and 800
      or note_title ~ '[[:cntrl:]]' or note_summary ~ '[[:cntrl:]]'
      or note_title ~ U&'[\007F-\009F]' or note_summary ~ U&'[\007F-\009F]'
      or exists (select 1 from jsonb_array_elements(normalized_notes) n where n->>'title' = note_title) then
      raise exception using errcode = '22023', message = 'Invalid note text';
    end if;
    normalized_notes := normalized_notes || jsonb_build_array(jsonb_build_object('title', note_title, 'summary', note_summary));
  end loop;
  normalized_request := jsonb_build_object('notes', normalized_notes);
  if p_payload ? 'version' then
    if jsonb_typeof(p_payload->'version') is distinct from 'string' or (p_payload->>'version') !~ version_pattern then
      raise exception using errcode = '22023', message = 'Invalid requested version';
    end if;
    parts := string_to_array(p_payload->>'version', '.');
    requested_parts := array[parts[1]::integer, parts[2]::integer, coalesce(parts[3], '0')::integer];
    requested_version := requested_parts[1] || '.' || requested_parts[2]
      || case when requested_parts[3] > 0 then '.' || requested_parts[3] else '' end;
    normalized_request := normalized_request || jsonb_build_object('version', requested_version);
  end if;

  -- This conflicts with Admin INSERT/UPDATE/DELETE locks, not just other publisher calls.
  lock table public.site_changelog in share row exclusive mode;
  select * into prior from public.changelog_publications where release_id = p_payload->>'release_id';
  if found then
    if prior.request <> normalized_request then
      raise exception using errcode = '23505', message = 'Release ID conflict';
    end if;
    return jsonb_build_object('ok', true, 'release_id', prior.release_id, 'version', prior.effective_version,
      'published_at', prior.published_at, 'positions', prior.positions, 'idempotent', true);
  end if;

  select v into current_parts from (
    select array[m[1]::integer, m[2]::integer, coalesce(m[4], '0')::integer] as v
    from public.site_changelog c
    cross join lateral regexp_match(c.title,
      '^shortbits[.]net (0|[1-9][0-9]{0,3})[.](0|[1-9][0-9]{0,3})([.](0|[1-9][0-9]{0,3}))?($| - )') m
    where c.enabled and m is not null
    union all
    select array[split_part(l.effective_version, '.', 1)::integer,
      split_part(l.effective_version, '.', 2)::integer,
      coalesce(nullif(split_part(l.effective_version, '.', 3), ''), '0')::integer]
    from public.changelog_publications l
  ) established order by v desc limit 1;
  if current_parts is null then
    raise exception using errcode = '55000', message = 'No established site version';
  end if;
  if requested_parts is not null then
    if requested_parts <> current_parts
      and requested_parts <> array[current_parts[1], current_parts[2], current_parts[3] + 1]
      and requested_parts <> array[current_parts[1], current_parts[2] + 1, 0]
      and requested_parts <> array[current_parts[1] + 1, 0, 0] then
      raise exception using errcode = '22023', message = 'Requested version must be current or next patch, minor or major';
    end if;
    current_parts := requested_parts;
  end if;
  effective_version := current_parts[1] || '.' || current_parts[2]
    || case when current_parts[3] > 0 then '.' || current_parts[3] else '' end;
  select coalesce(max(position), 0) into last_position from public.site_changelog;
  if last_position + jsonb_array_length(normalized_notes) > 2147483647 then
    raise exception using errcode = '22003', message = 'Changelog position limit reached';
  end if;
  publication_time := clock_timestamp();
  select array_agg((last_position + ordinal)::integer order by ordinal) into allocated
    from jsonb_array_elements(normalized_notes) with ordinality n(value, ordinal);
  insert into public.site_changelog(position, entry_date, title, summary, enabled, updated_at)
    select (last_position + ordinal)::integer, (publication_time at time zone 'UTC')::date,
      'shortbits.net ' || effective_version || ' - ' || (value->>'title'), value->>'summary', true, publication_time
    from jsonb_array_elements(normalized_notes) with ordinality n(value, ordinal);
  insert into public.changelog_publications(release_id, request, effective_version, source_commit, run_url, published_at, positions)
    values (p_payload->>'release_id', normalized_request, effective_version, p_payload->>'source_commit',
      p_payload->>'run_url', publication_time, allocated);
  return jsonb_build_object('ok', true, 'release_id', p_payload->>'release_id', 'version', effective_version,
    'published_at', publication_time, 'positions', allocated, 'idempotent', false);
end;
$$;
revoke all on function public.publish_site_changelog(jsonb) from public, anon, authenticated;
grant execute on function public.publish_site_changelog(jsonb) to service_role;
