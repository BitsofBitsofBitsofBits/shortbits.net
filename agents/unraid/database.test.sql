\set ON_ERROR_STOP on
-- Isolated CI database only: bootstrap the existing hardware migrations.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create table public.site_hardware (
  position integer primary key, machine text, component text, name text,
  detail text, enabled boolean, updated_at timestamptz default now()
);
\ir ../../supabase/migrations/20261021050000_create_hardware_agent.sql
\ir ../../supabase/migrations/20261021060000_hardware_live_pulse.sql
\ir ../../supabase/migrations/20261022010000_hardware_nas_pulse.sql

create function pg_temp.assert_true(value boolean, message text) returns void
language plpgsql as $$
begin
  if value is not true then raise exception '%', message; end if;
end;
$$;

do $$
declare
  token text := 'sbhw_' || repeat('x', 43);
  status jsonb := '{"cpu_percent":5,"gpu_percent":null,"memory_total_mb":128000,"memory_used_mb":60000,"booted_at":"2026-10-22T02:42:00Z"}';
  nas jsonb := '{"array_state":"STARTED","storage_total_bytes":1024000,"storage_used_bytes":614400,"storage_free_bytes":409600,"network_rx_bytes_sec":null,"network_tx_bytes_sec":0,"drives":[{"status":"ok","temperature_c":null,"spinning":false,"errors":0}]}';
  result jsonb;
  before_seen timestamptz;
  bad jsonb;
begin
  insert into public.site_hardware_devices(machine, token_hash)
    values ('NAS test', encode(sha256(convert_to(token, 'UTF8')), 'hex'));
  result := public.hardware_agent_nas_pulse(token, status, nas);
  perform pg_temp.assert_true(result ->> 'ok' = 'true', 'Valid NAS pulse must succeed');
  perform pg_temp.assert_true(
    (select nas_metrics -> 'drives' -> 0 -> 'temperature_c' = 'null'::jsonb
      and nas_metrics -> 'network_rx_bytes_sec' = 'null'::jsonb
      and nas_metrics ? 'sampled_at'
      and cpu_percent = 5
      from public.site_hardware_status where machine = 'NAS test'), 'Store nulls and core readings');
  result := public.hardware_agent_nas_pulse(token, status, nas);
  perform pg_temp.assert_true(result ->> 'error' = 'rate_limited', 'Preserve pulse rate limit');

  update public.site_hardware_devices set last_seen_at = now() - interval '5 seconds';
  select last_seen_at into before_seen from public.site_hardware_devices where machine = 'NAS test';
  for bad in select value from jsonb_array_elements(jsonb_build_array(
    null, '[]'::jsonb, '"scalar"'::jsonb,
    nas || '{"hostname":"MUST_NOT_STORE"}',
    nas || '{"storage_used_bytes":2000000}',
    nas || '{"network_rx_bytes_sec":-1}',
    nas || '{"network_rx_bytes_sec":"123"}',
    nas || '{"drives":[null]}',
    nas || '{"drives":[{"status":"ok","temperature_c":36,"spinning":false,"errors":0}]}',
    nas || '{"drives":[{"status":"ok","temperature_c":null,"spinning":false,"errors":0,"serial":"MUST_NOT_STORE"}]}'
  )) loop
    result := public.hardware_agent_nas_pulse(token, status, bad);
    perform pg_temp.assert_true(result ->> 'error' = 'invalid_nas_status', 'Reject invalid/private NAS data');
  end loop;
  perform pg_temp.assert_true(
    (select last_seen_at = before_seen from public.site_hardware_devices where machine = 'NAS test'),
    'Rejected payloads must not refresh heartbeat');
  perform pg_temp.assert_true(
    (select nas_metrics::text not like '%MUST_NOT_STORE%' from public.site_hardware_status where machine = 'NAS test'),
    'Private fields must not be persisted');
  result := public.hardware_agent_nas_pulse('invalid', status, nas);
  perform pg_temp.assert_true(result ->> 'error' = 'invalid_token', 'Reject invalid token');
  result := public.hardware_agent_nas_pulse(token, '{"cpu_percent":"bad"}', nas);
  perform pg_temp.assert_true(result ->> 'error' = 'invalid_status', 'Reject malformed core status atomically');
  perform pg_temp.assert_true(
    (select last_seen_at = before_seen from public.site_hardware_devices where machine = 'NAS test'),
    'Core failure must not refresh heartbeat');

  perform public.hardware_watch();
  result := public.hardware_agent_nas_pulse(token, status, nas);
  perform pg_temp.assert_true(result ->> 'watched' = 'true', 'Preserve watch feedback');
  update public.site_hardware_devices set machine = 'NAS renamed' where machine = 'NAS test';
  perform pg_temp.assert_true(
    exists(select 1 from public.site_hardware_status where machine = 'NAS renamed' and nas_metrics is not null),
    'NAS status follows device rename');
  delete from public.site_hardware_devices where machine = 'NAS renamed';
  result := public.hardware_agent_nas_pulse(token, status, nas);
  perform pg_temp.assert_true(result ->> 'error' = 'invalid_token', 'Revoked token must fail');
  perform pg_temp.assert_true(not exists(select 1 from public.site_hardware_status), 'Revocation removes live data');
end;
$$;

-- Ensure the NAS path has not changed ordinary desktop pulses.
insert into public.site_hardware_devices(machine, token_hash)
values ('Desktop test', encode(sha256(convert_to('sbhw_' || repeat('y',43), 'UTF8')), 'hex'));
set role anon;
select public.hardware_agent_pulse('sbhw_' || repeat('y',43), '{"cpu_percent":0,"memory_total_mb":1024,"memory_used_mb":0}');
select machine, nas_metrics from public.site_hardware_status;
reset role;
select pg_temp.assert_true(
  (select cpu_percent = 0 and memory_used_mb = 0 and nas_metrics is null
   from public.site_hardware_status where machine = 'Desktop test'), 'Desktop zero readings remain valid');
select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.site_hardware_status', 'UPDATE'), 'Anonymous table writes remain forbidden');
