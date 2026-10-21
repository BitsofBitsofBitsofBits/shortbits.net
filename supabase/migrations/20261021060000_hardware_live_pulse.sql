-- Near-live hardware status. Agents post lightweight status "pulses" straight to
-- PostgREST (no Edge Function invocation per update). Open HARDWARE.SYS windows
-- mark the hardware as watched, which tells agents to report every few seconds.

alter table public.site_hardware_devices
add column last_report_at timestamptz;

create table public.site_hardware_watch (
  id smallint primary key default 1 check (id = 1),
  watched_until timestamptz not null default now()
);

alter table public.site_hardware_watch enable row level security;
revoke all on table public.site_hardware_watch from anon, authenticated;

insert into public.site_hardware_watch (id) values (1);

-- Called by visitors while HARDWARE.SYS is open. Writes are throttled so any
-- number of viewers costs at most one update every ~15 seconds.
create or replace function public.hardware_watch()
returns void
language sql
security definer
set search_path = public
as $$
  update public.site_hardware_watch
  set watched_until = now() + interval '30 seconds'
  where id = 1 and watched_until < now() + interval '15 seconds';
$$;

revoke all on function public.hardware_watch() from public;
grant execute on function public.hardware_watch() to anon, authenticated;

create or replace function public.hardware_agent_pulse(p_token text, p_status jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.site_hardware_devices;
  v_now timestamptz := now();
  v_booted timestamptz;
  v_total integer;
  v_used integer;
  v_cpu smallint;
  v_gpu smallint;
begin
  if p_token is null or p_token !~ '^sbhw_[A-Za-z0-9_-]{43}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select * into v_device
  from public.site_hardware_devices
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_device.last_seen_at > v_now - interval '2 seconds' then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  if p_status is null or jsonb_typeof(p_status) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;

  begin
    v_booted := (p_status ->> 'booted_at')::timestamptz;
    if v_booted > v_now + interval '5 minutes' or v_booted < v_now - interval '365 days' then
      v_booted := null;
    end if;
    v_total := nullif(least(greatest(round((p_status ->> 'memory_total_mb')::numeric), 0), 100000000), 0);
    v_used := least(greatest(round((p_status ->> 'memory_used_mb')::numeric), 0), v_total);
    v_cpu := least(greatest(round((p_status ->> 'cpu_percent')::numeric), 0), 100);
    v_gpu := least(greatest(round((p_status ->> 'gpu_percent')::numeric), 0), 100);
    -- GREATEST/LEAST ignore nulls, so restore missing readings afterwards.
    if p_status ->> 'cpu_percent' is null then v_cpu := null; end if;
    if p_status ->> 'gpu_percent' is null then v_gpu := null; end if;
    if p_status ->> 'memory_used_mb' is null then v_used := null; end if;

    update public.site_hardware_devices
    set last_seen_at = v_now
    where id = v_device.id;

    insert into public.site_hardware_status as status (
      machine, cpu_percent, gpu_percent, memory_used_mb, memory_total_mb, booted_at, updated_at
    )
    values (
      v_device.machine,
      v_cpu,
      v_gpu,
      case when v_total is null then null else v_used end,
      v_total,
      v_booted,
      v_now
    )
    on conflict (machine) do update
    set cpu_percent = excluded.cpu_percent,
        gpu_percent = excluded.gpu_percent,
        memory_used_mb = excluded.memory_used_mb,
        memory_total_mb = excluded.memory_total_mb,
        booted_at = excluded.booted_at,
        updated_at = excluded.updated_at;
  exception when invalid_text_representation or numeric_value_out_of_range
    or invalid_datetime_format or datetime_field_overflow then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end;

  return jsonb_build_object(
    'ok', true,
    'watched', (select watched_until > v_now from public.site_hardware_watch where id = 1)
  );
end;
$$;

revoke all on function public.hardware_agent_pulse(text, jsonb) from public;
grant execute on function public.hardware_agent_pulse(text, jsonb) to anon, authenticated;

-- Spec reports through the Edge Function keep their own 20-second limit so the
-- frequent pulses (which update last_seen_at) don't block them.
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

  if v_device.last_report_at > v_now - interval '20 seconds' then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  update public.site_hardware_devices
  set last_seen_at = v_now, last_report_at = v_now
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
