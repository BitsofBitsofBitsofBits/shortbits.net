-- Live hardware agent: per-machine device tokens (stored only as SHA-256 hashes),
-- public live status, and a service-role-only report function used by the
-- hardware-sync Edge Function.

alter table public.site_hardware
add column source_key text check (source_key is null or char_length(source_key) between 1 and 220);

create index site_hardware_machine_source_key_idx
on public.site_hardware (machine, source_key);

create table public.site_hardware_devices (
  id uuid primary key default gen_random_uuid(),
  machine text not null unique check (char_length(machine) between 1 and 60),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  last_specs_at timestamptz
);

alter table public.site_hardware_devices enable row level security;

create policy "Authenticated users can read hardware devices"
on public.site_hardware_devices
for select
to authenticated
using (true);

create policy "Authenticated users can create hardware devices"
on public.site_hardware_devices
for insert
to authenticated
with check (true);

create policy "Authenticated users can delete hardware devices"
on public.site_hardware_devices
for delete
to authenticated
using (true);

revoke all on table public.site_hardware_devices from anon, authenticated;
grant select, insert, delete on table public.site_hardware_devices to authenticated;

create table public.site_hardware_status (
  machine text primary key
    references public.site_hardware_devices (machine) on delete cascade on update cascade,
  cpu_percent smallint check (cpu_percent between 0 and 100),
  gpu_percent smallint check (gpu_percent between 0 and 100),
  memory_used_mb integer check (memory_used_mb >= 0),
  memory_total_mb integer check (memory_total_mb > 0),
  booted_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.site_hardware_status enable row level security;

create policy "Public can read hardware status"
on public.site_hardware_status
for select
to anon, authenticated
using (true);

revoke all on table public.site_hardware_status from anon, authenticated;
grant select on table public.site_hardware_status to anon, authenticated;

create or replace function public.hardware_agent_report(
  p_token_hash text,
  p_status jsonb,
  p_components jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.site_hardware_devices;
  v_now timestamptz := now();
  v_item jsonb;
  v_component text;
  v_name text;
  v_detail text;
  v_key text;
  v_seen text[] := '{}';
  v_next integer;
  v_position integer;
  v_synced integer := 0;
begin
  select * into v_device
  from public.site_hardware_devices
  where token_hash = p_token_hash;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_device.last_seen_at > v_now - interval '20 seconds' then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  update public.site_hardware_devices
  set last_seen_at = v_now
  where id = v_device.id;

  if p_status is not null then
    insert into public.site_hardware_status as status (
      machine, cpu_percent, gpu_percent, memory_used_mb, memory_total_mb, booted_at, updated_at
    )
    values (
      v_device.machine,
      (p_status ->> 'cpu_percent')::smallint,
      (p_status ->> 'gpu_percent')::smallint,
      (p_status ->> 'memory_used_mb')::integer,
      (p_status ->> 'memory_total_mb')::integer,
      (p_status ->> 'booted_at')::timestamptz,
      v_now
    )
    on conflict (machine) do update
    set cpu_percent = excluded.cpu_percent,
        gpu_percent = excluded.gpu_percent,
        memory_used_mb = excluded.memory_used_mb,
        memory_total_mb = excluded.memory_total_mb,
        booted_at = excluded.booted_at,
        updated_at = excluded.updated_at;
  end if;

  -- Spec syncs are accepted at most every five minutes per device.
  if p_components is null
    or jsonb_typeof(p_components) <> 'array'
    or v_device.last_specs_at > v_now - interval '5 minutes' then
    return jsonb_build_object('ok', true, 'machine', v_device.machine, 'specs', false);
  end if;

  perform pg_advisory_xact_lock(hashtext('public.site_hardware'));
  select coalesce(max(position), 0) into v_next from public.site_hardware;

  for v_item in select value from jsonb_array_elements(p_components) limit 60 loop
    v_component := left(btrim(coalesce(v_item ->> 'component', '')), 40);
    v_name := left(btrim(coalesce(v_item ->> 'name', '')), 160);
    v_detail := nullif(left(btrim(coalesce(v_item ->> 'detail', '')), 300), '');
    continue when v_component = '' or v_name = '';

    -- Identical parts (e.g. two of the same drive) get an occurrence suffix.
    v_key := v_component || '|' || v_name;
    v_key := v_key || '#' || (
      select count(*) from unnest(v_seen) as seen(key)
      where left(seen.key, char_length(v_key) + 1) = v_key || '#'
    )::text;
    v_seen := array_append(v_seen, v_key);

    update public.site_hardware
    set detail = v_detail, updated_at = v_now
    where machine = v_device.machine and source_key = v_key;
    if found then
      v_synced := v_synced + 1;
      continue;
    end if;

    -- Adopt a manually entered row for the same part instead of duplicating it.
    select position into v_position
    from public.site_hardware
    where machine = v_device.machine
      and source_key is null
      and component = v_component
      and name = v_name
    order by position
    limit 1;

    if v_position is not null then
      update public.site_hardware
      set source_key = v_key, detail = v_detail, updated_at = v_now
      where position = v_position;
    else
      v_next := v_next + 1;
      insert into public.site_hardware (
        position, machine, component, name, detail, enabled, source_key, updated_at
      )
      values (v_next, v_device.machine, v_component, v_name, v_detail, true, v_key, v_now);
    end if;
    v_synced := v_synced + 1;
  end loop;

  -- Parts that disappeared from the machine are removed; manual rows are kept.
  delete from public.site_hardware
  where machine = v_device.machine
    and source_key is not null
    and not (source_key = any (v_seen));

  update public.site_hardware_devices
  set last_specs_at = v_now
  where id = v_device.id;

  return jsonb_build_object('ok', true, 'machine', v_device.machine, 'specs', true, 'components', v_synced);
end;
$$;

revoke all on function public.hardware_agent_report(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.hardware_agent_report(text, jsonb, jsonb) to service_role;
