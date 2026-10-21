-- Device tokens created without a name are named by the agent's first spec
-- report (system model, or the device name for custom builds). Admins can also
-- rename devices; live status follows through the existing on-update cascade.

alter table public.site_hardware_devices
add column name_pending boolean not null default false;

create policy "Authenticated users can rename hardware devices"
on public.site_hardware_devices
for update
to authenticated
using (true)
with check (true);

grant update (machine, name_pending) on table public.site_hardware_devices to authenticated;

create or replace function public.hardware_agent_claim_name(
  p_token_hash text,
  p_machine text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.site_hardware_devices;
  v_base text;
  v_name text;
  v_existing text;
  v_suffix integer := 1;
begin
  select * into v_device
  from public.site_hardware_devices
  where token_hash = p_token_hash
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_base := left(btrim(regexp_replace(coalesce(p_machine, ''), '\s+', ' ', 'g')), 60);
  if not v_device.name_pending or v_base = '' then
    return jsonb_build_object('ok', true, 'machine', v_device.machine, 'renamed', false);
  end if;

  -- Reuse the exact spelling of a manually entered machine with the same name,
  -- so an earlier scan import of this PC is adopted instead of duplicated.
  select machine into v_existing
  from public.site_hardware
  where lower(machine) = lower(v_base)
  order by position
  limit 1;
  v_name := coalesce(v_existing, v_base);

  -- Never take over another agent's machine.
  while exists (
    select 1 from public.site_hardware_devices
    where lower(machine) = lower(v_name) and id <> v_device.id
  ) loop
    v_suffix := v_suffix + 1;
    v_name := left(v_base, 54) || ' (' || v_suffix || ')';
  end loop;

  update public.site_hardware
  set machine = v_name
  where machine = v_device.machine;

  update public.site_hardware_devices
  set machine = v_name, name_pending = false
  where id = v_device.id;

  return jsonb_build_object('ok', true, 'machine', v_name, 'renamed', true);
end;
$$;

revoke all on function public.hardware_agent_claim_name(text, text) from public, anon, authenticated;
grant execute on function public.hardware_agent_claim_name(text, text) to service_role;
