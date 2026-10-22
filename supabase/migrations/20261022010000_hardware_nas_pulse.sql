-- NAS readings share device ownership, renaming, revocation and heartbeat state.
alter table public.site_hardware_status add column nas_metrics jsonb;

create or replace function public.hardware_agent_nas_pulse(
  p_token text, p_status jsonb, p_nas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_machine text;
  v_result jsonb;
  v_key text;
  v_value jsonb;
  v_number numeric;
  v_disk jsonb;
  v_disks jsonb := '[]'::jsonb;
  v_nas jsonb;
begin
  if p_token is null or p_token !~ '^sbhw_[A-Za-z0-9_-]{43}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  select machine into v_machine from public.site_hardware_devices
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if p_nas is null or jsonb_typeof(p_nas) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_nas_status');
  end if;
  if octet_length(p_nas::text) > 16384
    or (select count(*) from jsonb_object_keys(p_nas)) <> 7
    or not (p_nas ?& array['array_state', 'storage_total_bytes', 'storage_used_bytes',
      'storage_free_bytes', 'network_rx_bytes_sec', 'network_tx_bytes_sec', 'drives'])
    or coalesce(p_nas ->> 'array_state', '') not in ('STARTED', 'STOPPED', 'STARTING', 'STOPPING')
    or jsonb_typeof(p_nas -> 'drives') <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'invalid_nas_status');
  end if;
  if jsonb_array_length(p_nas -> 'drives') > 60 then
    return jsonb_build_object('ok', false, 'error', 'invalid_nas_status');
  end if;
  foreach v_key in array array['storage_total_bytes', 'storage_used_bytes', 'storage_free_bytes',
      'network_rx_bytes_sec', 'network_tx_bytes_sec'] loop
    v_value := p_nas -> v_key;
    if jsonb_typeof(v_value) = 'null' and v_key like 'network_%' then
      continue;
    end if;
    if jsonb_typeof(v_value) <> 'number' then
      return jsonb_build_object('ok', false, 'error', 'invalid_nas_status');
    end if;
    v_number := v_value::text::numeric;
    if v_number < 0 or v_number > 8192000000000000 or trunc(v_number) <> v_number
      or (v_key like 'network_%' and v_number > 1000000000000) then
      return jsonb_build_object('ok', false, 'error', 'invalid_nas_status');
    end if;
  end loop;
  if abs((p_nas ->> 'storage_total_bytes')::numeric
    - (p_nas ->> 'storage_used_bytes')::numeric
    - (p_nas ->> 'storage_free_bytes')::numeric) > 2048
    or (p_nas ->> 'storage_used_bytes')::numeric > (p_nas ->> 'storage_total_bytes')::numeric
    or (p_nas ->> 'storage_free_bytes')::numeric > (p_nas ->> 'storage_total_bytes')::numeric then
    return jsonb_build_object('ok', false, 'error', 'invalid_nas_status');
  end if;
  for v_disk in select value from jsonb_array_elements(p_nas -> 'drives') loop
    if jsonb_typeof(v_disk) <> 'object' then
      return jsonb_build_object('ok', false, 'error', 'invalid_nas_status');
    end if;
    if (select count(*) from jsonb_object_keys(v_disk)) <> 4
      or not (v_disk ?& array['status', 'temperature_c', 'spinning', 'errors'])
      or coalesce(v_disk ->> 'status', '') not in ('ok', 'error', 'unknown')
      or jsonb_typeof(v_disk -> 'spinning') not in ('boolean', 'null') then
      return jsonb_build_object('ok', false, 'error', 'invalid_nas_status');
    end if;
    v_value := v_disk -> 'temperature_c';
    if jsonb_typeof(v_value) <> 'null' then
      if jsonb_typeof(v_value) <> 'number' then
        return jsonb_build_object('ok', false, 'error', 'invalid_nas_status');
      end if;
      v_number := v_value::text::numeric;
      if v_number < -20 or v_number > 125 or (v_disk ->> 'spinning') is distinct from 'true' then
        return jsonb_build_object('ok', false, 'error', 'invalid_nas_status');
      end if;
    end if;
    v_value := v_disk -> 'errors';
    if jsonb_typeof(v_value) <> 'null' then
      if jsonb_typeof(v_value) <> 'number' then
        return jsonb_build_object('ok', false, 'error', 'invalid_nas_status');
      end if;
      v_number := v_value::text::numeric;
      if v_number < 0 or v_number > 9007199254740991 or trunc(v_number) <> v_number then
        return jsonb_build_object('ok', false, 'error', 'invalid_nas_status');
      end if;
    end if;
    v_disks := v_disks || jsonb_build_array(jsonb_build_object(
      'status', v_disk -> 'status', 'temperature_c', v_disk -> 'temperature_c',
      'spinning', v_disk -> 'spinning', 'errors', v_disk -> 'errors'));
  end loop;

  v_result := public.hardware_agent_pulse(p_token, p_status);
  if (v_result ->> 'ok')::boolean is not true then
    return v_result;
  end if;
  v_nas := jsonb_build_object(
    'array_state', p_nas -> 'array_state',
    'storage_total_bytes', p_nas -> 'storage_total_bytes',
    'storage_used_bytes', p_nas -> 'storage_used_bytes',
    'storage_free_bytes', p_nas -> 'storage_free_bytes',
    'network_rx_bytes_sec', p_nas -> 'network_rx_bytes_sec',
    'network_tx_bytes_sec', p_nas -> 'network_tx_bytes_sec',
    'drives', v_disks, 'sampled_at', now());
  update public.site_hardware_status set nas_metrics = v_nas where machine = v_machine;
  return v_result;
end;
$$;

revoke all on function public.hardware_agent_nas_pulse(text, jsonb, jsonb) from public;
grant execute on function public.hardware_agent_nas_pulse(text, jsonb, jsonb) to anon, authenticated;
